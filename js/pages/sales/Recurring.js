/* ==========================================================
   pages/sales/Recurring.js — module Abonnements / facturation récurrente
   Extrait des lignes 1817-2019 du fichier d'origine.
   Même pattern de migration que pages/Clients.js (voir sa note d'en-tête).
   ========================================================== */
import { state, currentUser, sectorCfg, saveState } from '../../core/state.js';
import { uid, todayISO, addDaysISO, fmtMoney, fmtDate, esc } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { openModal, closeModal } from '../../components/Modal.js';
import { guardDelete } from '../../core/auth.js';
import { logStockMovement } from '../../core/audit.js';
import { renderLayout } from '../../components/Layout.js';
import { goView } from '../../router.js';
import { multiMagasin, currentMagasinFilter, magasinSelectOptions, defaultMagasin, magasinStock } from '../../core/sites.js';
import { pushJournalEntry, getOrCreateLettre } from '../../core/accounting-engine.js';
import { clientName } from '../Clients.js';
import { docTotals, lineAmounts, renderTotalsBlock } from './shared.js';
import { nextInvoiceNumber } from './Invoices.js';

let draftRecurring = null;

export function frequencyLabel(f){ return {mensuel:"Mensuelle", trimestriel:"Trimestrielle", annuel:"Annuelle"}[f] || f; }
export function nextDateForFrequency(dateISO, frequency){
  const d = new Date(dateISO+'T00:00:00');
  if(frequency==='trimestriel') d.setMonth(d.getMonth()+3);
  else if(frequency==='annuel') d.setMonth(d.getMonth()+12);
  else d.setMonth(d.getMonth()+1);
  return d.toISOString().slice(0,10);
}

export function renderRecurringTab(){
  const list = [...(state.recurringInvoices||[])].sort((a,b)=>(a.nextDate||'').localeCompare(b.nextDate||''));
  return `
    <div class="toolbar"><div style="flex:1;"></div><button class="btn btn-primary" onclick="openRecurringModal()">+ Nouvel abonnement</button></div>
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        ${list.length ? `<table><thead><tr><th>Client</th><th>Description</th><th>Fréquence</th><th class="tright">Montant TTC</th><th>Prochaine facture</th><th>Statut</th><th></th></tr></thead><tbody>
          ${list.map(sub=>{
            const totals = docTotals({items: sub.items});
            return `<tr>
              <td>${esc(clientName(sub.clientId))}</td>
              <td>${esc(sub.label)||'—'}</td>
              <td>${esc(frequencyLabel(sub.frequency))}</td>
              <td class="tright mono">${fmtMoney(totals.ttc)}</td>
              <td>${sub.active?fmtDate(sub.nextDate):'—'}</td>
              <td><span class="badge ${sub.active?'badge-good':'badge-neutral'}">${sub.active?'Actif':'En pause'}</span>${(sub.history&&sub.history.length)?`<div style="font-size:.68rem;color:var(--ink-soft);margin-top:3px;">${sub.history.length} facture(s) émise(s)</div>`:''}</td>
              <td><div class="row-actions">
                ${sub.active ? `<button class="btn btn-sm btn-ghost" onclick="generateRecurringNow('${sub.id}')">Générer maintenant</button>` : ''}
                <button class="icon-btn" onclick="toggleRecurringActive('${sub.id}')" title="${sub.active?'Mettre en pause':'Réactiver'}">${sub.active?'⏸':'▶'}</button>
                <button class="icon-btn" onclick="openRecurringModal('${sub.id}')" title="Modifier">✎</button>
                <button class="icon-btn" onclick="deleteRecurring('${sub.id}')" title="Supprimer">✕</button>
              </div></td>
            </tr>`;
          }).join('')}
        </tbody></table>` : `<div class="empty"><div class="display">Aucun abonnement</div>Créez un abonnement pour facturer automatiquement un client chaque mois, trimestre ou année.</div>`}
      </div>
    </div>
    <p style="font-size:.76rem;color:var(--ink-soft);margin-top:14px;">Les factures dues sont générées automatiquement à la connexion. Une échéance manquée (application non ouverte à temps) est rattrapée automatiquement dès la prochaine connexion. « Générer maintenant » permet de forcer l'émission avant l'échéance prévue.</p>
  `;
}

export function openRecurringModal(id){
  if(!state.clients.length){ showToast("Ajoutez d'abord un client"); goView('clients'); return; }
  if(!state.products.length){ showToast("Ajoutez d'abord un article"); goView('products'); return; }
  const sub = id ? state.recurringInvoices.find(x=>x.id===id) : null;
  draftRecurring = sub
    ? {clientId:sub.clientId, magasinId:sub.magasinId, label:sub.label, frequency:sub.frequency, dueDays:sub.dueDays, startDate:sub.nextDate, items:sub.items.map(it=>({...it}))}
    : {clientId:state.clients[0].id, magasinId: currentMagasinFilter() || (defaultMagasin() && defaultMagasin().id), label:"", frequency:'mensuel', dueDays:30, startDate:todayISO(), items:[{productId:state.products[0].id, qty:1, price:state.products[0].price, discount:0}]};
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>${id?"Modifier l'abonnement":'Nouvel abonnement'}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="field"><label>Description (facultatif)</label><input id="f-label" value="${esc(draftRecurring.label||'')}" placeholder="Ex : Abonnement maintenance mensuelle"></div>
      <div class="field-row">
        <div class="field"><label>Client</label><select id="f-client" onchange="draftRecurring.clientId=this.value">
          ${state.clients.map(c=>`<option value="${c.id}" ${c.id===draftRecurring.clientId?'selected':''}>${esc(c.name)}</option>`).join('')}
        </select></div>
        <div class="field"><label>Fréquence</label><select id="f-frequency" onchange="draftRecurring.frequency=this.value">
          <option value="mensuel" ${draftRecurring.frequency==='mensuel'?'selected':''}>Mensuelle</option>
          <option value="trimestriel" ${draftRecurring.frequency==='trimestriel'?'selected':''}>Trimestrielle</option>
          <option value="annuel" ${draftRecurring.frequency==='annuel'?'selected':''}>Annuelle</option>
        </select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>${id?'Prochaine facture':'Première facture'}</label><input id="f-start" type="date" value="${draftRecurring.startDate}" onchange="draftRecurring.startDate=this.value"></div>
        <div class="field"><label>Délai de paiement (jours)</label><input id="f-duedays" type="number" min="0" value="${draftRecurring.dueDays}" onchange="draftRecurring.dueDays=Math.max(0,Number(this.value)||0)"></div>
      </div>
      ${multiMagasin() ? `<div class="field"><label>Magasin</label><select id="f-magasin" onchange="draftRecurring.magasinId=this.value">${magasinSelectOptions(draftRecurring.magasinId)}</select></div>` : ''}
      <label style="display:block;font-size:.74rem;font-weight:600;color:var(--ink-soft);margin-bottom:8px;text-transform:uppercase;letter-spacing:.03em;">Articles facturés à chaque échéance</label>
      <div id="recurring-lines"></div>
      <button class="btn btn-ghost btn-sm" onclick="addRecurringLine()">+ Ajouter une ligne</button>
      <div id="recurring-totals-block"></div>
      <p style="font-size:.76rem;color:var(--ink-soft);margin-top:10px;">Chaque facture générée reprendra exactement ces articles, quantités et prix, même si le tarif de l'article change entre-temps dans le catalogue.</p>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveRecurring('${id||''}')">${id?'Enregistrer':"Créer l'abonnement"}</button>
    </div>
  `;
  renderRecurringLines();
  openModal();
}

export function renderRecurringLines(){
  const el = document.getElementById('recurring-lines');
  el.innerHTML = `<div class="line-item" style="margin-bottom:2px;"><div></div><div style="font-size:.62rem;color:var(--ink-soft);text-transform:uppercase;">Qté</div><div style="font-size:.62rem;color:var(--ink-soft);text-transform:uppercase;">Remise%</div><div></div><div></div></div>` +
    draftRecurring.items.map((it,idx)=>`
    <div class="line-item">
      <select onchange="recurringLineProduct(${idx}, this.value)">
        ${state.products.map(p=>`<option value="${p.id}" ${p.id===it.productId?'selected':''}>${esc(p.name)}</option>`).join('')}
      </select>
      <input type="number" min="1" value="${it.qty}" onchange="recurringLineQty(${idx}, this.value)">
      <input type="number" min="0" max="100" value="${it.discount||0}" onchange="recurringLineDiscount(${idx}, this.value)">
      <div class="line-total">${fmtMoney(lineAmounts(it).ht)}</div>
      <button class="icon-btn" onclick="removeRecurringLine(${idx})">✕</button>
    </div>
  `).join('');
  document.getElementById('recurring-totals-block').innerHTML = renderTotalsBlock(draftRecurring.items);
}
export function addRecurringLine(){ draftRecurring.items.push({productId:state.products[0].id, qty:1, price:state.products[0].price, discount:0}); renderRecurringLines(); }
export function removeRecurringLine(idx){
  if(draftRecurring.items.length===1){ showToast("L'abonnement doit contenir au moins une ligne"); return; }
  draftRecurring.items.splice(idx,1); renderRecurringLines();
}
export function recurringLineProduct(idx, pid){
  const p = state.products.find(x=>x.id===pid);
  draftRecurring.items[idx].productId = pid; draftRecurring.items[idx].price = p.price;
  renderRecurringLines();
}
export function recurringLineQty(idx, v){ draftRecurring.items[idx].qty = Math.max(1, Number(v)||1); renderRecurringLines(); }
export function recurringLineDiscount(idx, v){ draftRecurring.items[idx].discount = Math.min(100, Math.max(0, Number(v)||0)); renderRecurringLines(); }

export function saveRecurring(id){
  const label = document.getElementById('f-label').value.trim();
  if(!draftRecurring.startDate){ showToast("Renseignez une date"); return; }
  if(id){
    const sub = state.recurringInvoices.find(x=>x.id===id);
    Object.assign(sub, {clientId:draftRecurring.clientId, magasinId:draftRecurring.magasinId, label, frequency:draftRecurring.frequency, dueDays:draftRecurring.dueDays, nextDate:draftRecurring.startDate, items:draftRecurring.items.map(it=>({...it}))});
  } else {
    state.recurringInvoices.push({
      id:uid('rec'), clientId:draftRecurring.clientId, magasinId:draftRecurring.magasinId, label,
      frequency:draftRecurring.frequency, dueDays:draftRecurring.dueDays, nextDate:draftRecurring.startDate,
      items:draftRecurring.items.map(it=>({...it})), active:true, createdAt:todayISO(), history:[]
    });
  }
  saveState(); closeModal(); renderLayout(); showToast(id?"Abonnement modifié":"Abonnement créé");
}
export function toggleRecurringActive(id){
  const sub = state.recurringInvoices.find(x=>x.id===id);
  if(!sub) return;
  sub.active = !sub.active;
  saveState(); renderLayout(); showToast(sub.active?"Abonnement réactivé":"Abonnement mis en pause");
}
export function deleteRecurring(id){
  if(!guardDelete()) return;
  if(!confirm("Supprimer cet abonnement ? Les factures déjà générées ne seront pas supprimées.")) return;
  state.recurringInvoices = state.recurringInvoices.filter(x=>x.id!==id);
  saveState(); renderLayout(); showToast("Supprimé");
}
export function generateRecurringNow(id){
  const sub = state.recurringInvoices.find(x=>x.id===id);
  if(!sub) return;
  const inv = generateInvoiceFromRecurring(sub, todayISO());
  if(inv){
    sub.nextDate = nextDateForFrequency(todayISO(), sub.frequency);
    saveState(); renderLayout(); showToast("Facture "+inv.number+" générée");
  } else {
    showToast("Impossible de générer la facture (client ou articles introuvables)");
  }
}
export function generateInvoiceFromRecurring(sub, dateStr){
  const client = state.clients.find(c=>c.id===sub.clientId);
  if(!client){ sub.active = false; return null; }
  const cfg = sectorCfg();
  const magasinId = sub.magasinId || (defaultMagasin() && defaultMagasin().id);
  const items = sub.items
    .filter(it=>state.products.some(p=>p.id===it.productId))
    .map(it=>{ const p = state.products.find(x=>x.id===it.productId); return {productId:it.productId, name:p.name, qty:it.qty, price:it.price, discount:it.discount||0}; });
  if(!items.length) return null;
  if(cfg.stock){
    for(const it of items){
      const p = state.products.find(x=>x.id===it.productId);
      if(p){ p.stockByMagasin = p.stockByMagasin||{}; p.stockByMagasin[magasinId] = magasinStock(p,magasinId) - it.qty; }
    }
  }
  const dueDate = addDaysISO(dateStr, sub.dueDays||30);
  const newInvoice = {
    id:uid('inv'), number:nextInvoiceNumber(), clientId:sub.clientId, magasinId,
    date:dateStr, dueDate, status:"En attente", delivered:false, reminders:[], payments:[],
    createdBy:(currentUser?currentUser.name:"Facturation automatique"), items, recurringId:sub.id
  };
  state.invoices.push(newInvoice);
  const t = docTotals(newInvoice);
  const tiersClient = {type:'client', id:newInvoice.clientId, name:clientName(newInvoice.clientId)};
  const jLines = [{account:"411", label:"Client "+clientName(newInvoice.clientId), debit:t.ttc, credit:0, tiers:tiersClient, lettre:getOrCreateLettre('invoice',newInvoice.id)}, {account:"707", label:"Vente "+newInvoice.number, debit:0, credit:t.ht}];
  if(t.tva>0.5) jLines.push({account:"4431", label:"TVA collectée "+newInvoice.number, debit:0, credit:t.tva});
  pushJournalEntry("VE", newInvoice.date, "Facture "+newInvoice.number+" — "+clientName(newInvoice.clientId)+" (abonnement)", jLines, {type:'invoice', id:newInvoice.id});
  if(cfg.stock){
    items.forEach(it=>{ if(it.productId) logStockMovement(newInvoice.date, it.productId, magasinId, -it.qty, 'vente', "Vente "+newInvoice.number+" (abonnement)", 'invoice', newInvoice.id); });
    const cogs = items.reduce((s,it)=>{ const p = state.products.find(x=>x.id===it.productId); return s + (p?(p.cost||0):0)*it.qty; }, 0);
    if(cogs>0.5){
      pushJournalEntry("VE", newInvoice.date, "Coût des marchandises vendues — "+newInvoice.number,
        [{account:"6031", label:"Sortie de stock "+newInvoice.number, debit:cogs, credit:0}, {account:"311", label:"Stock — "+newInvoice.number, debit:0, credit:cogs}],
        {type:'invoice', id:newInvoice.id});
    }
  }
  sub.history = sub.history||[];
  sub.history.push({date:dateStr, invoiceId:newInvoice.id, invoiceNumber:newInvoice.number});
  sub.lastGeneratedDate = dateStr;
  return newInvoice;
}
export function generateDueRecurringInvoices(){
  if(!state.recurringInvoices || !state.recurringInvoices.length) return;
  const today = todayISO();
  let count = 0;
  state.recurringInvoices.forEach(sub=>{
    if(!sub.active) return;
    let guard = 0;
    while(sub.nextDate && sub.nextDate<=today && guard<36){
      const inv = generateInvoiceFromRecurring(sub, sub.nextDate);
      sub.nextDate = nextDateForFrequency(sub.nextDate, sub.frequency);
      if(inv) count++;
      guard++;
    }
  });
  if(count){ saveState(); showToast(count+" facture(s) récurrente(s) générée(s) automatiquement"); }
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, {
  openRecurringModal, addRecurringLine, removeRecurringLine, recurringLineProduct, recurringLineQty, recurringLineDiscount,
  saveRecurring, toggleRecurringActive, deleteRecurring, generateRecurringNow,
  get draftRecurring(){ return draftRecurring; }, set draftRecurring(v){ draftRecurring=v; }
});
