/* ==========================================================
   pages/Purchases.js — module Achats (commandes fournisseurs + avoirs fournisseurs)
   Extrait des lignes 2716-3141 du fichier d'origine.
   Même pattern de migration que pages/Clients.js (voir sa note d'en-tête) :
   templates HTML inchangés, fonctions exposées sur window pour les onclick="".
   ========================================================== */
import { state, currentUser, sectorCfg, saveState } from '../core/state.js';
import { uid, todayISO, fmtMoney, fmtDate, esc } from '../core/utils.js';
import { showToast } from '../components/Toast.js';
import { openModal, closeModal } from '../components/Modal.js';
import { guardDelete } from '../core/auth.js';
import { logStockMovement, removeStockMovements } from '../core/audit.js';
import { renderLayout } from '../components/Layout.js';
import { goView } from '../router.js';
import {
  belongsToActiveMagasin, multiMagasin, magasinName, currentMagasinFilter, magasinSelectOptions,
  defaultMagasin, magasinStock, stockShortfalls, confirmOrBlockStock
} from '../core/sites.js';
import {
  blockIfLocked, pushJournalEntry, removeGeneratedEntries, getOrCreateLettre,
  treasuryAccountForMethod, accountShort
} from '../core/accounting-engine.js';
import { productVatRate } from './Products.js';
import { supplierName, openSupplierDetail, openSupplierModal } from './Suppliers.js';

let draftPurchase = null;
let draftReception = null;
let draftSupplierCreditNote = null;

export function purchaseLineAmounts(item){
  const p = item.productId ? state.products.find(x=>x.id===item.productId) : null;
  const rate = p ? productVatRate(p) : 0;
  const ht = item.qty*item.cost;
  const tva = ht*rate/100;
  return {ht, tva, ttc:ht+tva, rate};
}
export function purchaseTotal(pur){ return pur.items.reduce((s,it)=>s+purchaseLineAmounts(it).ttc,0); }
export function purchasePaid(pur){ return (pur.payments||[]).reduce((s,p)=>s+p.amount,0); }
export function purchaseBalance(pur){ return Math.max(0, Math.round(purchaseTotal(pur) - purchasePaid(pur) - supplierCreditNotesTotal(pur.id))); }
export function purchasePaymentStatus(pur){
  const paid = purchasePaid(pur), total = purchaseTotal(pur);
  if(total>0 && paid >= total - 0.5) return "Payé";
  if(paid>0) return "Partiel";
  if(pur.dueDate && pur.dueDate < todayISO()) return "En retard";
  return "Non payé";
}
export function purchaseOrderedQty(pur){ return pur.items.reduce((s,it)=>s+it.qty,0); }
export function purchaseReceivedQty(pur){ return pur.items.reduce((s,it)=>s+(it.receivedQty||0),0); }
export function purchaseReceptionStatus(pur){
  const ordered = purchaseOrderedQty(pur), received = purchaseReceivedQty(pur);
  if(received<=0) return "Commandée";
  if(received>=ordered) return "Reçue";
  return "Partiellement reçue";
}
export function purchaseIsLateDelivery(pur){ return purchaseReceptionStatus(pur)!=='Reçue' && pur.expectedDate && pur.expectedDate < todayISO(); }

export function renderPurchases(){
  const tab = state.purchasesTab || 'commandes';
  const tabs = [['commandes','Commandes'],['avoirs','Avoirs fournisseurs']];
  const body = tab==='avoirs' ? renderSupplierCreditNotesTab() : renderPurchaseOrdersTab();
  return `
    <div class="toolbar" style="gap:4px;margin-bottom:6px;">
      ${tabs.map(([k,l])=>`<button class="btn btn-sm ${tab===k?'btn-primary':'btn-ghost'}" onclick="state.purchasesTab='${k}'; window.renderLayout();">${l}</button>`).join('')}
    </div>
    ${body}
  `;
}

function renderPurchaseOrdersTab(){
  const q = (window.__purchaseSearch||"").toLowerCase();
  const list = state.purchases.filter(belongsToActiveMagasin)
    .filter(p=>!q || (p.number||'').toLowerCase().includes(q) || p.supplier.toLowerCase().includes(q))
    .sort((a,b)=>b.date.localeCompare(a.date));
  const duePayable = state.purchases.filter(belongsToActiveMagasin).reduce((s,p)=>s+purchaseBalance(p),0);
  return `
    ${duePayable>0 ? `<div class="kpi" style="margin-bottom:14px;max-width:280px;"><div class="kpi-label">Total dû aux fournisseurs</div><div class="kpi-value" style="color:var(--rust);">${fmtMoney(duePayable)}</div></div>` : ''}
    <div class="toolbar">
      <input class="search" placeholder="Rechercher n° ou fournisseur…" value="${esc(window.__purchaseSearch||'')}" oninput="window.__purchaseSearch=this.value; window.renderLayout()">
      <button class="btn btn-primary" onclick="openPurchaseModal()">+ Nouvelle commande</button>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        ${list.length ? `<table><thead><tr><th>N°</th><th>Fournisseur</th>${multiMagasin()?'<th>Magasin</th>':''}<th>Date</th><th>Articles</th><th class="tright">Montant</th><th>Réception</th><th>Paiement</th><th></th></tr></thead><tbody>
          ${list.map(p=>{
            const total = purchaseTotal(p);
            const bal = purchaseBalance(p);
            const payStatus = purchasePaymentStatus(p);
            const payCls = payStatus==='Payé' ? 'badge-good' : payStatus==='Partiel' ? 'badge-brass' : payStatus==='En retard' ? 'badge-warn' : 'badge-neutral';
            const recStatus = purchaseReceptionStatus(p);
            const recCls = recStatus==='Reçue' ? 'badge-good' : recStatus==='Partiellement reçue' ? 'badge-brass' : 'badge-neutral';
            const late = purchaseIsLateDelivery(p);
            const locked = purchaseReceivedQty(p)>0 || purchasePaid(p)>0;
            return `<tr>
              <td class="mono">${p.number||'—'}</td>
              <td><button class="icon-btn" style="border:none;padding:0;font-weight:600;color:var(--indigo);background:none;" onclick="openSupplierDetail('${p.supplierId||''}')">${esc(p.supplier)}</button></td>
              ${multiMagasin()?`<td>${esc(magasinName(p.magasinId))}</td>`:''}
              <td>${fmtDate(p.date)}</td>
              <td>${p.items.map(it=>esc(it.name)+' ×'+it.qty).join(', ')}</td>
              <td class="tright mono">${fmtMoney(total)}</td>
              <td><span class="badge ${recCls}">${recStatus}</span>${recStatus==='Partiellement reçue'?`<div style="font-size:.68rem;color:var(--ink-soft);margin-top:3px;">${purchaseReceivedQty(p)}/${purchaseOrderedQty(p)} unités</div>`:''}${late?`<div style="font-size:.68rem;color:var(--rust);margin-top:3px;">Livraison attendue le ${fmtDate(p.expectedDate)}</div>`:''}</td>
              <td><span class="badge ${payCls}">${payStatus}</span>${payStatus==='Partiel'?`<div style="font-size:.68rem;color:var(--ink-soft);margin-top:3px;">Reste : ${fmtMoney(bal)}</div>`:''}</td>
              <td><div class="row-actions">
                ${recStatus!=='Reçue' ? `<button class="btn btn-sm btn-ghost" onclick="openReceptionModal('${p.id}')">Réceptionner</button>`:''}
                ${bal>0 ? `<button class="btn btn-sm btn-ghost" onclick="openSupplierPaymentModal('${p.id}')">Payer</button>` : ''}
                ${purchaseReceivedQty(p)>0 ? `<button class="icon-btn" onclick="openSupplierCreditNoteModal('${p.id}')" title="Créer un avoir fournisseur">↩</button>` : ''}
                ${!locked ? `<button class="icon-btn" onclick="deletePurchase('${p.id}')">✕</button>` : `<button class="icon-btn" disabled title="Commande partiellement/totalement reçue ou réglée — verrouillée pour la traçabilité" style="opacity:.35;cursor:not-allowed;">✕</button>`}
              </div></td>
            </tr>`;
          }).join('')}
        </tbody></table>` : `<div class="empty"><div class="display">Aucune commande</div>Passez votre première commande fournisseur ici.</div>`}
      </div>
    </div>
  `;
}

function supplierCreditNoteTotal(n){ return n.items.reduce((s,it)=>s+purchaseLineAmounts(it).ttc,0); }
function supplierCreditNotesTotal(purchaseId){
  return state.supplierCreditNotes.filter(n=>n.purchaseId===purchaseId).reduce((s,n)=>s+supplierCreditNoteTotal(n),0);
}

function renderSupplierCreditNotesTab(){
  const list = state.supplierCreditNotes.filter(belongsToActiveMagasin).sort((a,b)=>b.date.localeCompare(a.date));
  return `
    <div class="panel">
      <div class="panel-head"><h3>Avoirs fournisseurs</h3></div>
      <div class="panel-body" style="padding:0;">
        ${list.length ? `<table><thead><tr><th>N°</th><th>Fournisseur</th><th>Commande liée</th><th>Date</th><th class="tright">Montant</th><th>Retour physique</th><th></th></tr></thead><tbody>
          ${list.map(n=>{
            const pur = state.purchases.find(p=>p.id===n.purchaseId);
            return `<tr>
            <td class="mono">${n.number}</td>
            <td><button class="icon-btn" style="border:none;padding:0;font-weight:600;color:var(--indigo);background:none;" onclick="openSupplierDetail('${n.supplierId||''}')">${esc(n.supplier)}</button></td>
            <td class="mono">${pur?pur.number:'—'}</td>
            <td>${fmtDate(n.date)}</td>
            <td class="tright mono">-${fmtMoney(supplierCreditNoteTotal(n))}</td>
            <td>${n.restocked ? '<span class="badge badge-good">Oui — stock ajusté</span>' : '<span class="badge badge-neutral">Non — remise seule</span>'}</td>
            <td><div class="row-actions"><button class="icon-btn" onclick="deleteSupplierCreditNote('${n.id}')" title="Supprimer">✕</button></div></td>
          </tr>`;}).join('')}
        </tbody></table>` : `<div class="empty"><div class="display">Aucun avoir fournisseur</div>Un avoir s'émet depuis une commande reçue (icône ↩ dans l'onglet Commandes).</div>`}
      </div>
    </div>
  `;
}

function nextSupplierCreditNoteNumber(){ state.counters.supplierCreditNote++; return (state.settings.prefixSupplierCreditNote||"AF")+"-"+String(state.counters.supplierCreditNote).padStart(4,'0'); }

export function openSupplierCreditNoteModal(purchaseId){
  const pur = state.purchases.find(p=>p.id===purchaseId);
  if(!pur) return;
  const cfg = sectorCfg();
  draftSupplierCreditNote = {
    purchaseId, supplierId:pur.supplierId, supplier:pur.supplier, magasinId:pur.magasinId, reason:"",
    items: pur.items.filter(it=>(it.receivedQty||0)>0).map(it=>({productId:it.productId, name:it.name, qty:it.receivedQty, cost:it.cost}))
  };
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>Avoir fournisseur — ${pur.number||''}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="field"><label>Motif</label><input id="f-reason" placeholder="Marchandise défectueuse, remise obtenue…"></div>
      <label style="display:block;font-size:.74rem;font-weight:600;color:var(--ink-soft);margin-bottom:8px;text-transform:uppercase;">Articles concernés (modifiez les quantités si l'avoir est partiel)</label>
      <div id="supplier-creditnote-lines"></div>
      <div id="supplier-creditnote-total" style="text-align:right;font-weight:700;margin-top:8px;"></div>
      ${cfg.stock ? `<label style="display:flex;align-items:center;gap:8px;font-size:.85rem;margin-top:14px;cursor:pointer;">
        <input type="checkbox" id="f-restock" style="width:16px;height:16px;">
        Marchandise physiquement retournée au fournisseur (retire du stock)
      </label>
      <p style="font-size:.76rem;color:var(--ink-soft);margin:4px 0 0;">Laissez décoché s'il s'agit d'une simple remise ou d'un geste commercial sans retour de marchandise.</p>` : ''}
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveSupplierCreditNote()">Émettre l'avoir</button>
    </div>
  `;
  renderSupplierCreditNoteLines();
  openModal();
}

export function renderSupplierCreditNoteLines(){
  const el = document.getElementById('supplier-creditnote-lines');
  el.innerHTML = draftSupplierCreditNote.items.map((it,idx)=>`
    <div class="line-item" style="grid-template-columns:1fr 70px 100px;">
      <div style="font-size:.85rem;padding:8px 0;">${esc(it.name)}</div>
      <input type="number" min="0" value="${it.qty}" onchange="draftSupplierCreditNote.items[${idx}].qty=Math.max(0,Number(this.value)||0); renderSupplierCreditNoteLines();">
      <div class="line-total">${fmtMoney(it.qty*it.cost)}</div>
    </div>
  `).join('');
  document.getElementById('supplier-creditnote-total').textContent = "Total : " + fmtMoney(draftSupplierCreditNote.items.reduce((s,it)=>s+it.qty*it.cost,0));
}

export function saveSupplierCreditNote(){
  const items = draftSupplierCreditNote.items.filter(it=>it.qty>0);
  if(!items.length){ showToast("Renseignez au moins une quantité"); return; }
  const cfg = sectorCfg();
  const restockEl = document.getElementById('f-restock');
  const restock = !!(restockEl && restockEl.checked);
  if(restock && cfg.stock){
    const neededByProduct = {};
    items.forEach(it=>{ if(it.productId) neededByProduct[it.productId] = (neededByProduct[it.productId]||0) + it.qty; });
    if(!confirmOrBlockStock(stockShortfalls(neededByProduct, draftSupplierCreditNote.magasinId))) return;
  }
  const newNote = {
    id:uid('safr'), number:nextSupplierCreditNoteNumber(), purchaseId:draftSupplierCreditNote.purchaseId,
    supplierId:draftSupplierCreditNote.supplierId, supplier:draftSupplierCreditNote.supplier, magasinId:draftSupplierCreditNote.magasinId,
    date:todayISO(), reason:document.getElementById('f-reason').value.trim(), restocked:restock, items
  };
  state.supplierCreditNotes.push(newNote);
  let stockHT=0, chargeHT=0, tva=0;
  items.forEach(it=>{
    const amounts = purchaseLineAmounts(it);
    const p = it.productId ? state.products.find(x=>x.id===it.productId) : null;
    if(restock && p && cfg.stock){
      stockHT += amounts.ht;
      p.stockByMagasin = p.stockByMagasin||{};
      p.stockByMagasin[newNote.magasinId] = magasinStock(p,newNote.magasinId) - it.qty;
      logStockMovement(newNote.date, p.id, newNote.magasinId, -it.qty, 'retour_fournisseur', "Avoir fournisseur "+newNote.number, 'supplierCreditNote', newNote.id);
    } else {
      chargeHT += amounts.ht;
    }
    tva += amounts.tva;
  });
  const totalTTC = stockHT+chargeHT+tva;
  const jLines = [];
  if(stockHT>0) jLines.push({account:"311", label:"Retour fournisseur "+newNote.supplier, debit:0, credit:stockHT});
  if(chargeHT>0) jLines.push({account:"609", label:"Avoir "+newNote.supplier, debit:0, credit:chargeHT});
  if(tva>0.5) jLines.push({account:"4452", label:"Annulation TVA déductible — "+newNote.number, debit:0, credit:tva});
  jLines.push({account:"401", label:"Fournisseur "+newNote.supplier, debit:totalTTC, credit:0, tiers:{type:'supplier', id:newNote.supplierId, name:newNote.supplier}, lettre:getOrCreateLettre('purchase',newNote.purchaseId)});
  pushJournalEntry("AC", newNote.date, "Avoir fournisseur "+newNote.number+" — "+newNote.supplier, jLines, {type:'supplierCreditNote', id:newNote.id});
  saveState(); closeModal(); renderLayout(); showToast(restock ? "Avoir émis — stock ajusté" : "Avoir émis");
}

export function deleteSupplierCreditNote(id){
  if(!guardDelete()) return;
  const n = state.supplierCreditNotes.find(x=>x.id===id);
  if(n && blockIfLocked(n.date)) return;
  if(!confirm("Supprimer cet avoir fournisseur ?")) return;
  state.supplierCreditNotes = state.supplierCreditNotes.filter(n=>n.id!==id);
  removeGeneratedEntries('supplierCreditNote', id);
  removeStockMovements('supplierCreditNote', id);
  saveState(); renderLayout(); showToast("Supprimé");
}

export function openPurchaseModal(){
  if(!state.suppliers.length){ showToast("Ajoutez d'abord un fournisseur"); goView('suppliers'); return; }
  const defaultMagasinId = currentMagasinFilter() || (defaultMagasin() && defaultMagasin().id);
  if(!draftPurchase){
    const due = new Date(); due.setDate(due.getDate()+30);
    const expected = new Date(); expected.setDate(expected.getDate()+7);
    draftPurchase = { supplierId:state.suppliers[0].id, magasinId:defaultMagasinId, date:todayISO(), dueDate:due.toISOString().slice(0,10), expectedDate:expected.toISOString().slice(0,10), items:[{productId:null, name:"", qty:1, cost:0, _mode:'catalog'}] };
  }
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>Nouvelle commande fournisseur</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="field-row" style="align-items:flex-end;">
        <div class="field"><label>Fournisseur</label><select id="f-supplier" onchange="draftPurchase.supplierId=this.value">
          ${state.suppliers.map(s=>`<option value="${s.id}" ${s.id===draftPurchase.supplierId?'selected':''}>${esc(s.name)}</option>`).join('')}
        </select></div>
        <button type="button" class="btn btn-ghost btn-sm" style="margin-bottom:14px;" onclick="openSupplierModal(null, (newId)=>{ draftPurchase.supplierId=newId; openPurchaseModal(); })">+ Nouveau</button>
      </div>
      <div class="field-row">
        ${multiMagasin() ? `<div class="field"><label>Magasin de réception</label><select id="f-magasin" onchange="draftPurchase.magasinId=this.value">${magasinSelectOptions(draftPurchase.magasinId)}</select></div>` : ''}
        <div class="field"><label>Livraison attendue le</label><input id="f-expected" type="date" value="${draftPurchase.expectedDate}" onchange="draftPurchase.expectedDate=this.value"></div>
      </div>
      <div class="field" style="max-width:220px;"><label>Échéance de paiement</label><input id="f-due" type="date" value="${draftPurchase.dueDate}" onchange="draftPurchase.dueDate=this.value"></div>
      <label style="display:block;font-size:.74rem;font-weight:600;color:var(--ink-soft);margin-bottom:8px;text-transform:uppercase;letter-spacing:.03em;">Articles commandés</label>
      <div id="purchase-lines"></div>
      <button class="btn btn-ghost btn-sm" onclick="addPurchaseLine()">+ Ajouter une ligne</button>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="draftPurchase=null; closeModal();">Annuler</button>
      <button class="btn btn-primary" onclick="savePurchase()">Passer la commande</button>
    </div>
  `;
  renderPurchaseLines();
  openModal();
}

export function renderPurchaseLines(){
  const el = document.getElementById('purchase-lines');
  el.innerHTML = `<div class="line-item purchase-line" style="margin-bottom:2px;"><div style="font-size:.62rem;color:var(--ink-soft);text-transform:uppercase;">Article</div><div style="font-size:.62rem;color:var(--ink-soft);text-transform:uppercase;">Qté</div><div style="font-size:.62rem;color:var(--ink-soft);text-transform:uppercase;">Coût</div><div></div><div></div></div>` +
    draftPurchase.items.map((it,idx)=>{
    const mode = it._mode || (it.productId ? 'catalog' : (it.name ? 'custom' : 'catalog'));
    const nameCell = mode==='catalog'
      ? `<select onchange="purchaseLineProduct(${idx}, this.value)">
           <option value="">Choisir un article…</option>
           ${state.products.map(p=>`<option value="${p.id}" ${p.id===it.productId?'selected':''}>${esc(p.name)}</option>`).join('')}
         </select>`
      : `<input placeholder="Nom de l'article (hors catalogue)" value="${esc(it.name)}" onchange="draftPurchase.items[${idx}].name=this.value">`;
    return `
    <div class="line-item purchase-line">
      ${nameCell}
      <input type="number" min="1" placeholder="Qté" value="${it.qty}" onchange="draftPurchase.items[${idx}].qty=Number(this.value)||1">
      <input type="number" min="0" placeholder="Coût unit." value="${it.cost}" onchange="draftPurchase.items[${idx}].cost=Number(this.value)||0">
      <button type="button" class="icon-btn" title="${mode==='catalog'?'Saisir un article hors catalogue':'Choisir dans le catalogue'}" onclick="togglePurchaseLineMode(${idx})">${mode==='catalog'?'✎':'📋'}</button>
      <button class="icon-btn" onclick="removePurchaseLine(${idx})">✕</button>
    </div>
  `;}).join('') +
  (draftPurchase.items.some(it=>!it.productId) ? `<p style="font-size:.74rem;color:var(--ink-soft);margin-top:4px;">Les articles hors catalogue ne mettent pas le stock à jour automatiquement à la réception. Ajoutez-les d'abord dans ${sectorCfg().products} si vous voulez suivre leur stock.</p>` : '');
}

export function purchaseLineProduct(idx, pid){
  const it = draftPurchase.items[idx];
  if(!pid){ it.productId=null; it.name=''; renderPurchaseLines(); return; }
  const p = state.products.find(x=>x.id===pid);
  it.productId = pid; it.name = p.name; it.cost = p.cost||it.cost||0; it._mode='catalog';
  renderPurchaseLines();
}
export function togglePurchaseLineMode(idx){
  const it = draftPurchase.items[idx];
  const currentMode = it._mode || (it.productId ? 'catalog' : (it.name ? 'custom' : 'catalog'));
  it._mode = currentMode==='catalog' ? 'custom' : 'catalog';
  if(it._mode==='custom') it.productId = null;
  else it.name = '';
  renderPurchaseLines();
}
export function addPurchaseLine(){ draftPurchase.items.push({productId:null, name:"", qty:1, cost:0, _mode:'catalog'}); renderPurchaseLines(); }
export function removePurchaseLine(idx){
  if(draftPurchase.items.length===1) return;
  draftPurchase.items.splice(idx,1); renderPurchaseLines();
}

function nextPurchaseNumber(){ state.counters.purchase++; return (state.settings.prefixPurchase||"BC")+"-"+String(state.counters.purchase).padStart(4,'0'); }

export function savePurchase(){
  const supplierId = draftPurchase.supplierId;
  const supplier = supplierName(supplierId);
  if(!supplierId){ showToast("Sélectionnez un fournisseur"); return; }
  const magasinId = draftPurchase.magasinId || (defaultMagasin() && defaultMagasin().id);
  const items = draftPurchase.items.filter(it=>it.name.trim()).map(it=>({productId:it.productId||null, name:it.name, qty:it.qty, cost:it.cost, receivedQty:0}));
  if(!items.length){ showToast("Ajoutez au moins un article"); return; }
  state.purchases.push({id:uid('pur'), number:nextPurchaseNumber(), supplierId, supplier, magasinId, date:todayISO(), dueDate:draftPurchase.dueDate, expectedDate:draftPurchase.expectedDate, status:"Commandée", payments:[], receptions:[], createdBy:currentUser.name, items});
  draftPurchase = null;
  saveState(); closeModal(); renderLayout(); showToast("Commande enregistrée");
}

export function openReceptionModal(id){
  const pur = state.purchases.find(p=>p.id===id);
  draftReception = { purchaseId:id, qty: pur.items.map(it=>Math.max(0,it.qty-(it.receivedQty||0))) };
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>Réception — ${pur.number||''}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <p style="font-size:.82rem;color:var(--ink-soft);margin-top:0;">${esc(pur.supplier)}. Indiquez les quantités réellement reçues — vous pouvez réceptionner en plusieurs fois si la livraison est incomplète.</p>
      <div id="reception-lines"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="confirmReception('${id}')">Valider la réception</button>
    </div>
  `;
  renderReceptionLines(pur);
  openModal();
}

export function renderReceptionLines(pur){
  const el = document.getElementById('reception-lines');
  el.innerHTML = `
    <div class="line-item" style="grid-template-columns:1fr 80px 90px;margin-bottom:2px;">
      <div style="font-size:.62rem;color:var(--ink-soft);text-transform:uppercase;">Article</div>
      <div style="font-size:.62rem;color:var(--ink-soft);text-transform:uppercase;">Déjà reçu</div>
      <div style="font-size:.62rem;color:var(--ink-soft);text-transform:uppercase;">Reçu aujourd'hui</div>
    </div>` +
    pur.items.map((it,idx)=>{
      const already = it.receivedQty||0;
      const remaining = Math.max(0, it.qty-already);
      return `<div class="line-item" style="grid-template-columns:1fr 80px 90px;">
        <div style="font-size:.85rem;padding:8px 0;">${esc(it.name)} <span style="color:var(--ink-soft);">(commandé ${it.qty})</span></div>
        <div style="font-size:.85rem;padding:8px 0;color:var(--ink-soft);" class="mono">${already}</div>
        <input type="number" min="0" max="${remaining}" value="${remaining}" onchange="draftReception.qty[${idx}]=Math.max(0,Math.min(${remaining},Number(this.value)||0))">
      </div>`;
    }).join('');
}

export function confirmReception(id){
  const cfg = sectorCfg();
  const pur = state.purchases.find(p=>p.id===id);
  const received = pur.items.map((it,idx)=>({name:it.name, qty:draftReception.qty[idx]||0})).filter(x=>x.qty>0);
  if(!received.length){ showToast("Aucune quantité saisie"); return; }
  const unmatched = [];
  let stockedHT = 0, expensedHT = 0, tva = 0;
  pur.items.forEach((it,idx)=>{
    const qty = draftReception.qty[idx]||0;
    if(qty<=0) return;
    it.receivedQty = (it.receivedQty||0) + qty;
    const lineHT = qty*(it.cost||0);
    const prod = it.productId ? state.products.find(p=>p.id===it.productId) : (cfg.stock ? state.products.find(p=>p.name.toLowerCase()===it.name.toLowerCase()) : null);
    if(prod){
      stockedHT += lineHT;
      tva += lineHT * productVatRate(prod) / 100;
      if(cfg.stock){
        prod.stockByMagasin = prod.stockByMagasin||{};
        prod.stockByMagasin[pur.magasinId] = magasinStock(prod,pur.magasinId) + qty;
        logStockMovement(todayISO(), prod.id, pur.magasinId, qty, 'achat', "Réception "+(pur.number||''), 'purchase', pur.id);
      }
    } else {
      expensedHT += lineHT;
      if(cfg.stock) unmatched.push(it.name);
    }
  });
  pur.receptions = pur.receptions||[];
  const receptionId = uid('rec');
  pur.receptions.push({id:receptionId, date:todayISO(), items:received, receivedBy:currentUser.name});
  pur.status = purchaseReceptionStatus(pur)==='Reçue' ? 'Reçue' : 'Commandée';
  const totalTTC = stockedHT + expensedHT + tva;
  if(totalTTC>0){
    const jLines = [];
    if(stockedHT>0) jLines.push({account:"311", label:"Stock — "+pur.supplier, debit:stockedHT, credit:0});
    if(expensedHT>0) jLines.push({account:"601", label:"Achat (hors catalogue) — "+pur.supplier, debit:expensedHT, credit:0});
    if(tva>0.5) jLines.push({account:"4452", label:"TVA déductible — "+pur.supplier, debit:tva, credit:0});
    jLines.push({account:"401", label:"Fournisseur "+pur.supplier, debit:0, credit:totalTTC, tiers:{type:'supplier', id:pur.supplierId, name:pur.supplier}, lettre:getOrCreateLettre('purchase',pur.id)});
    pushJournalEntry("AC", todayISO(), `Réception ${pur.number||''} — ${pur.supplier}`, jLines, {type:'reception', id:receptionId});
  }
  draftReception = null;
  saveState(); closeModal(); renderLayout();
  if(unmatched.length){
    showToast(`Stock non mis à jour pour : ${unmatched.join(', ')} — article(s) hors catalogue`);
  } else {
    showToast(purchaseReceptionStatus(pur)==='Reçue' ? "Commande entièrement réceptionnée" : "Réception partielle enregistrée");
  }
}

export function openSupplierPaymentModal(id){
  const pur = state.purchases.find(p=>p.id===id);
  const bal = purchaseBalance(pur);
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>Paiement fournisseur — ${pur.number||''}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <p style="font-size:.82rem;color:var(--ink-soft);margin-top:0;">${esc(pur.supplier)} · Total : ${fmtMoney(purchaseTotal(pur))} · Déjà réglé : ${fmtMoney(purchasePaid(pur))} · Reste dû : <strong>${fmtMoney(bal)}</strong></p>
      <div class="field-row">
        <div class="field"><label>Montant réglé</label><input id="f-amount" type="number" min="1" max="${bal}" value="${bal}"></div>
        <div class="field"><label>Date</label><input id="f-date" type="date" value="${todayISO()}"></div>
      </div>
      <div class="field"><label>Moyen de paiement</label>
        <select id="f-method"><option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option></select>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="recordSupplierPayment('${id}')">Enregistrer le paiement</button>
    </div>
  `;
  openModal();
}

export function recordSupplierPayment(id){
  const pur = state.purchases.find(p=>p.id===id);
  const bal = purchaseBalance(pur);
  const amount = Number(document.getElementById('f-amount').value)||0;
  if(amount<=0){ showToast("Montant invalide"); return; }
  if(amount>bal+0.5){ showToast("Le montant dépasse le solde dû ("+fmtMoney(bal)+")"); return; }
  const method = document.getElementById('f-method').value;
  const date = document.getElementById('f-date').value || todayISO();
  if(blockIfLocked(date)) return;
  const payId = uid('pay');
  pur.payments = pur.payments||[];
  pur.payments.push({id:payId, date, amount, method});
  const partial = purchaseBalance(pur)>0;
  state.treasury.push({id:uid('trs'), date, label:`Paiement ${pur.number||''} — ${pur.supplier}${partial?' (partiel — '+method+')':' — '+method}`, type:"out", magasinId:pur.magasinId, amount, category:"achats", method, generatedFrom:{type:'purchase', id:pur.id}});
  const acc = treasuryAccountForMethod(method);
  pushJournalEntry("BQ", date, `Paiement fournisseur ${pur.number||''} — ${pur.supplier}`,
    [{account:"401", label:"Fournisseur "+pur.supplier, debit:amount, credit:0, tiers:{type:'supplier', id:pur.supplierId, name:pur.supplier}, lettre:getOrCreateLettre('purchase',pur.id)}, {account:acc, label:accountShort(acc), debit:0, credit:amount}],
    {type:'supplierPayment', id:payId});
  saveState(); closeModal(); renderLayout(); showToast(partial ? "Paiement partiel enregistré" : "Fournisseur soldé");
}

export function deletePurchase(id){
  if(!guardDelete()) return;
  const pur = state.purchases.find(p=>p.id===id);
  if(pur && blockIfLocked(pur.date)) return;
  if(pur && (purchaseReceivedQty(pur)>0 || purchasePaid(pur)>0)){ showToast("Cette commande a été partiellement/totalement reçue ou réglée — suppression impossible pour préserver l'historique"); return; }
  if(!confirm("Supprimer cette commande ?")) return;
  state.purchases = state.purchases.filter(p=>p.id!==id);
  saveState(); renderLayout(); showToast("Supprimée");
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
// draftPurchase/draftSupplierCreditNote/draftReception sont aussi exposés car les
// gabarits y accèdent directement (ex. onchange="draftPurchase.items[...].qty=...").
Object.assign(window, {
  openPurchaseModal, savePurchase, purchaseLineProduct, togglePurchaseLineMode, addPurchaseLine, removePurchaseLine,
  openReceptionModal, confirmReception, openSupplierPaymentModal, recordSupplierPayment, deletePurchase,
  openSupplierCreditNoteModal, saveSupplierCreditNote, deleteSupplierCreditNote, renderSupplierCreditNoteLines,
  get draftPurchase(){ return draftPurchase; }, set draftPurchase(v){ draftPurchase=v; },
  get draftSupplierCreditNote(){ return draftSupplierCreditNote; }, set draftSupplierCreditNote(v){ draftSupplierCreditNote=v; },
  get draftReception(){ return draftReception; }, set draftReception(v){ draftReception=v; }
});
