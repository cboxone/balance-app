/* ==========================================================
   pages/sales/Devis.js — module Devis
   Extrait des lignes 2284-2410 du fichier d'origine.
   Même pattern de migration que pages/Clients.js (voir sa note d'en-tête).
   ========================================================== */
import { state, saveState } from '../../core/state.js';
import { uid, todayISO, fmtMoney, fmtDate, esc } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { openModal, closeModal } from '../../components/Modal.js';
import { guardDelete } from '../../core/auth.js';
import { renderLayout } from '../../components/Layout.js';
import { goView } from '../../router.js';
import { belongsToActiveMagasin, multiMagasin, magasinName, currentMagasinFilter, magasinSelectOptions, defaultMagasin } from '../../core/sites.js';
import { clientName } from '../Clients.js';
import { docTotals, lineAmounts, renderTotalsBlock } from './shared.js';
import { openInvoiceModal } from './Invoices.js';

let draftDevis = null;

export function devisTotal(d){ return docTotals(d).ttc; }
export function devisEffectiveStatus(d){
  if(d.status==='Envoyé' && d.validUntil<todayISO()) return 'Expiré';
  return d.status;
}
export function devisStatusBadge(d){
  const status = devisEffectiveStatus(d);
  const cls = status==='Facturé' ? 'badge-good' : status==='Refusé' || status==='Expiré' ? 'badge-warn' : status==='Accepté' ? 'badge-good' : 'badge-neutral';
  return `<span class="badge ${cls}">${status}</span>`;
}

export function renderDevisTab(){
  const list = state.devis.filter(belongsToActiveMagasin).sort((a,b)=>b.date.localeCompare(a.date));
  return `
    <div class="toolbar"><div style="flex:1;"></div><button class="btn btn-primary" onclick="openDevisModal()">+ Nouveau devis</button></div>
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        ${list.length ? `<table><thead><tr><th>N°</th><th>Client</th>${multiMagasin()?'<th>Magasin</th>':''}<th>Date</th><th>Validité</th><th class="tright">Montant</th><th>Statut</th><th></th></tr></thead><tbody>
          ${list.map(d=>{
            const eff = devisEffectiveStatus(d);
            return `<tr>
            <td class="mono">${d.number}</td>
            <td>${esc(clientName(d.clientId))}</td>
            ${multiMagasin()?`<td>${esc(magasinName(d.magasinId))}</td>`:''}
            <td>${fmtDate(d.date)}</td>
            <td>${fmtDate(d.validUntil)}</td>
            <td class="tright mono">${fmtMoney(devisTotal(d))}</td>
            <td>${devisStatusBadge(d)}</td>
            <td><div class="row-actions">
              ${eff==='Expiré' ? `<button class="btn btn-sm btn-ghost" onclick="renewDevis('${d.id}')">Renouveler (30j)</button>` : d.status!=='Facturé' ? `<button class="btn btn-sm btn-ghost" onclick="transformDevisToInvoice('${d.id}')">Transformer en facture</button>`:''}
              <button class="icon-btn" onclick="openPrintable('devis','${d.id}')" title="Imprimer / PDF">🖶</button>
              <button class="icon-btn" onclick="deleteDevis('${d.id}')" title="Supprimer">✕</button>
            </div></td>
          </tr>`;}).join('')}
        </tbody></table>` : `<div class="empty"><div class="display">Aucun devis</div>Créez un devis, puis transformez-le en facture en un clic une fois accepté.</div>`}
      </div>
    </div>
  `;
}

function nextDevisNumber(){ state.counters.devis++; return (state.settings.prefixDevis||"D")+"-"+String(state.counters.devis).padStart(4,'0'); }

export function openDevisModal(){
  if(!state.clients.length){ showToast("Ajoutez d'abord un client"); goView('clients'); return; }
  if(!state.products.length){ showToast("Ajoutez d'abord un article"); goView('products'); return; }
  const validUntil = new Date(); validUntil.setDate(validUntil.getDate()+30);
  const defaultMagasinId = currentMagasinFilter() || (defaultMagasin() && defaultMagasin().id);
  draftDevis = { clientId:state.clients[0].id, magasinId:defaultMagasinId, validUntil:validUntil.toISOString().slice(0,10), items:[{productId:state.products[0].id, qty:1, price:state.products[0].price, discount:0}] };
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>Nouveau devis</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="field-row">
        <div class="field"><label>Client</label><select id="f-client" onchange="draftDevis.clientId=this.value">
          ${state.clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select></div>
        <div class="field"><label>Valable jusqu'au</label><input id="f-valid" type="date" value="${draftDevis.validUntil}" onchange="draftDevis.validUntil=this.value"></div>
      </div>
      ${multiMagasin() ? `<div class="field"><label>Magasin</label><select id="f-magasin" onchange="draftDevis.magasinId=this.value">${magasinSelectOptions(draftDevis.magasinId)}</select></div>` : ''}
      <label style="display:block;font-size:.74rem;font-weight:600;color:var(--ink-soft);margin-bottom:8px;text-transform:uppercase;letter-spacing:.03em;">Articles</label>
      <div id="devis-lines"></div>
      <button class="btn btn-ghost btn-sm" onclick="addDevisLine()">+ Ajouter une ligne</button>
      <div id="devis-totals-block"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveDevis()">Créer le devis</button>
    </div>
  `;
  renderDevisLines();
  openModal();
}

export function renderDevisLines(){
  const el = document.getElementById('devis-lines');
  el.innerHTML = `<div class="line-item" style="margin-bottom:2px;"><div></div><div style="font-size:.62rem;color:var(--ink-soft);text-transform:uppercase;">Qté</div><div style="font-size:.62rem;color:var(--ink-soft);text-transform:uppercase;">Remise%</div><div></div><div></div></div>` +
    draftDevis.items.map((it,idx)=>`
    <div class="line-item">
      <select onchange="devisLineProduct(${idx}, this.value)">
        ${state.products.map(p=>`<option value="${p.id}" ${p.id===it.productId?'selected':''}>${esc(p.name)}</option>`).join('')}
      </select>
      <input type="number" min="1" value="${it.qty}" onchange="devisLineQty(${idx}, this.value)">
      <input type="number" min="0" max="100" value="${it.discount||0}" onchange="devisLineDiscount(${idx}, this.value)">
      <div class="line-total">${fmtMoney(lineAmounts(it).ht)}</div>
      <button class="icon-btn" onclick="removeDevisLine(${idx})">✕</button>
    </div>
  `).join('');
  document.getElementById('devis-totals-block').innerHTML = renderTotalsBlock(draftDevis.items);
}
export function addDevisLine(){ draftDevis.items.push({productId:state.products[0].id, qty:1, price:state.products[0].price, discount:0}); renderDevisLines(); }
export function removeDevisLine(idx){
  if(draftDevis.items.length===1){ showToast("Le devis doit contenir au moins une ligne"); return; }
  draftDevis.items.splice(idx,1); renderDevisLines();
}
export function devisLineProduct(idx, pid){
  const p = state.products.find(x=>x.id===pid);
  draftDevis.items[idx].productId = pid; draftDevis.items[idx].price = p.price;
  renderDevisLines();
}
export function devisLineQty(idx, v){ draftDevis.items[idx].qty = Math.max(1, Number(v)||1); renderDevisLines(); }
export function devisLineDiscount(idx, v){ draftDevis.items[idx].discount = Math.min(100, Math.max(0, Number(v)||0)); renderDevisLines(); }

export function saveDevis(){
  const items = draftDevis.items.map(it=>{
    const p = state.products.find(x=>x.id===it.productId);
    return {productId:it.productId, name:p.name, qty:it.qty, price:it.price, discount:it.discount||0};
  });
  const magasinId = draftDevis.magasinId || (defaultMagasin() && defaultMagasin().id);
  state.devis.push({ id:uid('dev'), number:nextDevisNumber(), clientId:draftDevis.clientId, magasinId, date:todayISO(), validUntil:draftDevis.validUntil, status:"Envoyé", items });
  saveState(); closeModal(); renderLayout(); showToast("Devis créé");
}

export function transformDevisToInvoice(id){
  const d = state.devis.find(x=>x.id===id);
  if(!d) return;
  if(devisEffectiveStatus(d)==='Expiré'){ showToast("Ce devis a expiré — renouvelez-le avant de le transformer"); return; }
  d.status = "Accepté";
  openInvoiceModal(d);
}
export function renewDevis(id){
  const d = state.devis.find(x=>x.id===id);
  if(!d) return;
  const nv = new Date(); nv.setDate(nv.getDate()+30);
  d.validUntil = nv.toISOString().slice(0,10);
  d.status = "Envoyé";
  saveState(); renderLayout(); showToast("Devis renouvelé pour 30 jours");
}
export function deleteDevis(id){
  if(!guardDelete()) return;
  if(!confirm("Supprimer ce devis ?")) return;
  state.devis = state.devis.filter(d=>d.id!==id);
  saveState(); renderLayout(); showToast("Supprimé");
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, {
  openDevisModal, saveDevis, addDevisLine, removeDevisLine, devisLineProduct, devisLineQty, devisLineDiscount,
  transformDevisToInvoice, renewDevis, deleteDevis,
  get draftDevis(){ return draftDevis; }, set draftDevis(v){ draftDevis=v; }
});
