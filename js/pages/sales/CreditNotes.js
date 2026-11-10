/* ==========================================================
   pages/sales/CreditNotes.js — module Avoirs clients
   Extrait des lignes 2412-2535 du fichier d'origine.
   Même pattern de migration que pages/Clients.js (voir sa note d'en-tête).
   ========================================================== */
import { state, sectorCfg, saveState } from '../../core/state.js';
import { uid, todayISO, fmtMoney, fmtDate, esc } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { openModal, closeModal } from '../../components/Modal.js';
import { guardDelete } from '../../core/auth.js';
import { logStockMovement, removeStockMovements } from '../../core/audit.js';
import { renderLayout } from '../../components/Layout.js';
import { belongsToActiveMagasin, multiMagasin, magasinName, magasinStock } from '../../core/sites.js';
import { blockIfLocked, pushJournalEntry, removeGeneratedEntries, getOrCreateLettre } from '../../core/accounting-engine.js';
import { clientName } from '../Clients.js';
import { docTotals, renderTotalsBlock } from './shared.js';

let draftCreditNote = null;

export function creditNoteTotal(n){ return docTotals(n).ttc; }

export function renderCreditNotesTab(){
  const list = state.creditNotes.filter(belongsToActiveMagasin).sort((a,b)=>b.date.localeCompare(a.date));
  return `
    <div class="panel">
      <div class="panel-head"><h3>Avoirs</h3></div>
      <div class="panel-body" style="padding:0;">
        ${list.length ? `<table><thead><tr><th>N°</th><th>Client</th><th>Facture liée</th>${multiMagasin()?'<th>Magasin</th>':''}<th>Date</th><th class="tright">Montant</th><th>Statut</th><th></th></tr></thead><tbody>
          ${list.map(n=>{
            const inv = state.invoices.find(i=>i.id===n.invoiceId);
            return `<tr>
            <td class="mono">${n.number}</td>
            <td>${esc(clientName(n.clientId))}</td>
            <td class="mono">${inv?inv.number:'—'}</td>
            ${multiMagasin()?`<td>${esc(magasinName(n.magasinId))}</td>`:''}
            <td>${fmtDate(n.date)}</td>
            <td class="tright mono">-${fmtMoney(creditNoteTotal(n))}</td>
            <td><span class="badge ${n.status==='Remboursé'?'badge-good':'badge-brass'}">${n.status}</span>${n.restocked?'<div style="font-size:.68rem;color:var(--ink-soft);margin-top:3px;">Stock remis à jour</div>':''}</td>
            <td><div class="row-actions">
              ${n.status!=='Remboursé' ? `<button class="btn btn-sm btn-ghost" onclick="markCreditNoteRefunded('${n.id}')">Marquer remboursé</button>`:''}
              <button class="icon-btn" onclick="openPrintable('avoir','${n.id}')" title="Imprimer / PDF">🖶</button>
              ${n.status==='Remboursé' ? `<button class="icon-btn" disabled title="Avoir remboursé — verrouillé" style="opacity:.35;cursor:not-allowed;">✕</button>` : `<button class="icon-btn" onclick="deleteCreditNote('${n.id}')" title="Supprimer">✕</button>`}
            </div></td>
          </tr>`;}).join('')}
        </tbody></table>` : `<div class="empty"><div class="display">Aucun avoir</div>Un avoir s'émet depuis une facture payée (icône ↩ dans l'onglet Factures).</div>`}
      </div>
    </div>
  `;
}

function nextCreditNoteNumber(){ state.counters.creditNote++; return (state.settings.prefixCreditNote||"A")+"-"+String(state.counters.creditNote).padStart(4,'0'); }

export function openCreditNoteModal(invoiceId){
  const inv = state.invoices.find(i=>i.id===invoiceId);
  if(!inv) return;
  const cfg = sectorCfg();
  draftCreditNote = { invoiceId, clientId:inv.clientId, magasinId:inv.magasinId, reason:"", items:inv.items.map(it=>({productId:it.productId,name:it.name,qty:it.qty,price:it.price})) };
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>Avoir sur facture ${inv.number}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="field"><label>Motif</label><input id="f-reason" placeholder="Retour marchandise, geste commercial…"></div>
      <label style="display:block;font-size:.74rem;font-weight:600;color:var(--ink-soft);margin-bottom:8px;text-transform:uppercase;">Articles concernés (modifiez les quantités si l'avoir est partiel)</label>
      <div id="creditnote-lines"></div>
      <div id="creditnote-totals-block"></div>
      ${cfg.stock ? `<label style="display:flex;align-items:center;gap:8px;font-size:.85rem;margin-top:14px;cursor:pointer;">
        <input type="checkbox" id="f-restock" style="width:16px;height:16px;">
        Remettre ces articles en stock (retour physique de marchandise)
      </label>
      <p style="font-size:.76rem;color:var(--ink-soft);margin:4px 0 0;">Ne cochez que si la marchandise revient réellement dans votre stock. Laissez décoché pour un simple geste commercial ou une remise sur facture.</p>` : ''}
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveCreditNote()">Émettre l'avoir</button>
    </div>
  `;
  renderCreditNoteLines();
  openModal();
}

export function renderCreditNoteLines(){
  const el = document.getElementById('creditnote-lines');
  el.innerHTML = draftCreditNote.items.map((it,idx)=>`
    <div class="line-item" style="grid-template-columns:1fr 70px 100px;">
      <div style="font-size:.85rem;padding:8px 0;">${esc(it.name)}</div>
      <input type="number" min="0" value="${it.qty}" onchange="draftCreditNote.items[${idx}].qty=Math.max(0,Number(this.value)||0); renderCreditNoteLines();">
      <div class="line-total">${fmtMoney(it.qty*it.price)}</div>
    </div>
  `).join('');
  document.getElementById('creditnote-totals-block').innerHTML = renderTotalsBlock(draftCreditNote.items);
}

export function saveCreditNote(){
  const items = draftCreditNote.items.filter(it=>it.qty>0);
  if(!items.length){ showToast("Renseignez au moins une quantité"); return; }
  const cfg = sectorCfg();
  const restockEl = document.getElementById('f-restock');
  const restock = !!(restockEl && restockEl.checked);
  if(restock && cfg.stock){
    items.forEach(it=>{
      if(!it.productId) return;
      const p = state.products.find(x=>x.id===it.productId);
      if(p){ p.stockByMagasin = p.stockByMagasin||{}; p.stockByMagasin[draftCreditNote.magasinId] = magasinStock(p,draftCreditNote.magasinId) + it.qty; }
    });
  }
  const newNote = {
    id:uid('avr'), number:nextCreditNoteNumber(), invoiceId:draftCreditNote.invoiceId, clientId:draftCreditNote.clientId,
    magasinId:draftCreditNote.magasinId, date:todayISO(), reason:document.getElementById('f-reason').value.trim(), restocked:restock, status:"Émis", items
  };
  state.creditNotes.push(newNote);
  const t = docTotals(newNote);
  const jLines = [{account:"709", label:"Avoir "+newNote.number, debit:t.ht, credit:0}];
  if(t.tva>0.5) jLines.push({account:"4431", label:"TVA sur avoir "+newNote.number, debit:t.tva, credit:0});
  jLines.push({account:"411", label:"Client "+clientName(newNote.clientId), debit:0, credit:t.ttc, tiers:{type:'client', id:newNote.clientId, name:clientName(newNote.clientId)}, lettre:getOrCreateLettre('invoice',newNote.invoiceId)});
  pushJournalEntry("VE", newNote.date, "Avoir "+newNote.number+" — "+clientName(newNote.clientId), jLines, {type:'creditNote', id:newNote.id});
  if(restock && cfg.stock){
    items.forEach(it=>{
      if(it.productId) logStockMovement(newNote.date, it.productId, newNote.magasinId, it.qty, 'retour_client', "Avoir "+newNote.number, 'creditNote', newNote.id);
    });
    const cogsBack = items.reduce((s,it)=>{ if(!it.productId) return s; const p = state.products.find(x=>x.id===it.productId); return s + (p?(p.cost||0):0)*it.qty; }, 0);
    if(cogsBack>0.5){
      pushJournalEntry("VE", newNote.date, "Retour en stock — "+newNote.number,
        [{account:"311", label:"Retour stock "+newNote.number, debit:cogsBack, credit:0}, {account:"6031", label:"Annulation sortie "+newNote.number, debit:0, credit:cogsBack}],
        {type:'creditNote', id:newNote.id});
    }
  }
  saveState(); closeModal(); renderLayout(); showToast(restock ? "Avoir émis — stock remis à jour" : "Avoir émis");
}

export function markCreditNoteRefunded(id){
  const n = state.creditNotes.find(x=>x.id===id);
  n.status = "Remboursé";
  state.treasury.push({id:uid('trs'), date:todayISO(), label:"Remboursement "+n.number, type:"out", category:"autre", method:"Espèces", magasinId:n.magasinId, amount:creditNoteTotal(n), generatedFrom:{type:'creditNote', id:n.id}});
  pushJournalEntry("BQ", todayISO(), "Remboursement "+n.number+" — "+clientName(n.clientId),
    [{account:"411", label:"Client "+clientName(n.clientId), debit:creditNoteTotal(n), credit:0, tiers:{type:'client', id:n.clientId, name:clientName(n.clientId)}, lettre:getOrCreateLettre('invoice',n.invoiceId)}, {account:"571", label:"Caisse", debit:0, credit:creditNoteTotal(n)}],
    {type:'creditNoteRefund', id:n.id});
  saveState(); renderLayout(); showToast("Avoir marqué remboursé");
}

export function deleteCreditNote(id){
  if(!guardDelete()) return;
  const n = state.creditNotes.find(x=>x.id===id);
  if(n && blockIfLocked(n.date)) return;
  if(n && n.status==='Remboursé'){ showToast("Un avoir déjà remboursé ne peut plus être supprimé (traçabilité comptable)"); return; }
  if(!confirm("Supprimer cet avoir ?")) return;
  state.creditNotes = state.creditNotes.filter(n=>n.id!==id);
  removeGeneratedEntries('creditNote', id);
  removeStockMovements('creditNote', id);
  saveState(); renderLayout(); showToast("Supprimé");
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, {
  openCreditNoteModal, saveCreditNote, renderCreditNoteLines, markCreditNoteRefunded, deleteCreditNote,
  get draftCreditNote(){ return draftCreditNote; }, set draftCreditNote(v){ draftCreditNote=v; }
});
