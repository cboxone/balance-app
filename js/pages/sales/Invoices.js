/* ==========================================================
   pages/sales/Invoices.js — module Factures
   Extrait des lignes 706-711, 1367-1385, 1778-1817, 2019-2059, 2075-2087,
   2107-2221 et 2222-2283 du fichier d'origine.
   Même pattern de migration que pages/Clients.js (voir sa note d'en-tête).
   ========================================================== */
import { state, currentUser, sectorCfg, saveState } from '../../core/state.js';
import { uid, todayISO, fmtMoney, fmtDate, esc, downloadCSV } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { openModal, closeModal } from '../../components/Modal.js';
import { guardDelete } from '../../core/auth.js';
import { logStockMovement, removeStockMovements } from '../../core/audit.js';
import { renderLayout } from '../../components/Layout.js';
import { goView } from '../../router.js';
import {
  belongsToActiveMagasin, multiMagasin, magasinName, currentMagasinFilter, magasinSelectOptions,
  defaultMagasin, magasinStock, stockShortfalls, confirmOrBlockStock
} from '../../core/sites.js';
import {
  blockIfLocked, pushJournalEntry, removeGeneratedEntries, getOrCreateLettre,
  treasuryAccountForMethod, accountShort
} from '../../core/accounting-engine.js';
import { clientName } from '../Clients.js';
import { docTotals, lineAmounts, renderTotalsBlock } from './shared.js';

let draftInvoice = null;

export function invoicePaid(inv){ return (inv.payments||[]).reduce((s,p)=>s+p.amount,0); }
export function invoiceTotal(inv){ return docTotals(inv).ttc; }
export function invoiceBalance(inv){ return Math.max(0, Math.round(invoiceTotal(inv) - invoicePaid(inv))); }
export function recomputeInvoiceStatus(inv){
  const paid = invoicePaid(inv), total = invoiceTotal(inv);
  if(total>0 && paid >= total - 0.5) inv.status = "Payée";
  else if(paid>0) inv.status = "Partiellement payée";
  else if(inv.dueDate < todayISO()) inv.status = "En retard";
  else inv.status = "En attente";
}
export function statusBadge(inv){
  const status = inv.status;
  const cls = status==='Payée' ? 'badge-good' : status==='Partiellement payée' ? 'badge-brass' : status==='En retard' ? 'badge-warn' : 'badge-neutral';
  const bal = invoiceBalance(inv);
  return `<span class="badge ${cls}">${status}</span>${status==='Partiellement payée' ? `<div style="font-size:.68rem;color:var(--ink-soft);margin-top:3px;">Reste dû : ${fmtMoney(bal)}</div>` : ''}`;
}

export function exportInvoicesCSV(){
  const list = state.invoices.filter(belongsToActiveMagasin);
  downloadCSV('factures.csv', ['N°','Client','Date','Échéance','Total TTC','Payé','Solde dû','Statut'],
    list.map(i=>[i.number, clientName(i.clientId), i.date, i.dueDate, invoiceTotal(i), invoicePaid(i), invoiceBalance(i), i.status]));
}

export function renderInvoicesTab(){
  const q = (window.__invoiceSearch||"").toLowerCase();
  const list = state.invoices.filter(belongsToActiveMagasin)
    .filter(i=>!q || i.number.toLowerCase().includes(q) || clientName(i.clientId).toLowerCase().includes(q))
    .sort((a,b)=>b.date.localeCompare(a.date));
  return `
    <div class="toolbar">
      <input class="search" placeholder="Rechercher n° ou client…" value="${esc(window.__invoiceSearch||'')}" oninput="window.__invoiceSearch=this.value; window.renderLayout()">
      <button class="btn btn-ghost" onclick="exportInvoicesCSV()">Exporter CSV</button><button class="btn btn-primary" onclick="openInvoiceModal()">+ Nouvelle facture</button></div>
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        ${list.length ? `<table><thead><tr><th>N°</th><th>Client</th>${multiMagasin()?'<th>Magasin</th>':''}<th>Date</th><th>Échéance</th><th class="tright">Montant</th><th>Livraison</th><th>Statut</th><th></th></tr></thead><tbody>
          ${list.map(inv=>{
            const bal = invoiceBalance(inv);
            const overdue = bal>0 && inv.dueDate<todayISO();
            const reminders = inv.reminders||[];
            const locked = invoicePaid(inv)>0;
            return `<tr>
            <td class="mono">${inv.number}</td>
            <td>${esc(clientName(inv.clientId))}</td>
            ${multiMagasin()?`<td>${esc(magasinName(inv.magasinId))}</td>`:''}
            <td>${fmtDate(inv.date)}</td>
            <td>${fmtDate(inv.dueDate)}</td>
            <td class="tright mono">${fmtMoney(invoiceTotal(inv))}</td>
            <td>${sectorCfg().stock ? `<button class="badge ${inv.delivered?'badge-good':'badge-neutral'}" style="border:none;" onclick="toggleDelivered('${inv.id}')">${inv.delivered?'Livrée':'À livrer'}</button>` : '—'}</td>
            <td>${statusBadge(inv)}${reminders.length?`<div style="font-size:.68rem;color:var(--ink-soft);margin-top:3px;">Relancée ${reminders.length}× · ${fmtDate(reminders[reminders.length-1].date)}</div>`:''}</td>
            <td><div class="row-actions">
              ${bal>0 ? `<button class="btn btn-sm btn-ghost" onclick="openPaymentModal('${inv.id}')">Enregistrer un paiement</button>` : ''}
              ${overdue ? `<button class="btn btn-sm btn-ghost" onclick="openReminderModal('${inv.id}')" title="Relancer">Relancer</button>` : ''}
              <button class="icon-btn" onclick="openPrintable('facture','${inv.id}')" title="Imprimer / PDF">🖶</button>
              ${locked ? `<button class="icon-btn" onclick="openCreditNoteModal('${inv.id}')" title="Créer un avoir">↩</button>` : ''}
              ${locked ? `<button class="icon-btn" disabled title="Un règlement est enregistré — supprimez via un avoir" style="opacity:.35;cursor:not-allowed;">✕</button>` : `<button class="icon-btn" onclick="deleteInvoice('${inv.id}')" title="Supprimer">✕</button>`}
            </div></td>
          </tr>`;}).join('')}
        </tbody></table>` : `<div class="empty"><div class="display">Aucune facture</div>Créez votre première facture, ou transformez un devis accepté.</div>`}
      </div>
    </div>
  `;
}

export function nextInvoiceNumber(){ state.counters.invoice++; return (state.settings.prefixInvoice||"F")+"-"+String(state.counters.invoice).padStart(4,'0'); }

export function openInvoiceModal(fromDevis){
  if(!state.clients.length){ showToast("Ajoutez d'abord un client"); goView('clients'); return; }
  if(!state.products.length){ showToast("Ajoutez d'abord un article"); goView('products'); return; }
  const defaultMagasinId = (fromDevis && fromDevis.magasinId) || currentMagasinFilter() || (defaultMagasin() && defaultMagasin().id);
  draftInvoice = fromDevis
    ? { clientId:fromDevis.clientId, magasinId:defaultMagasinId, date:todayISO(), dueDate:todayISO(), items:fromDevis.items.map(it=>({productId:it.productId,qty:it.qty,price:it.price,discount:it.discount||0})), fromDevisId:fromDevis.id }
    : { clientId:state.clients[0].id, magasinId:defaultMagasinId, date:todayISO(), dueDate:todayISO(), items:[{productId:state.products[0].id, qty:1, price:state.products[0].price, discount:0}] };
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>Nouvelle facture</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="field-row">
        <div class="field"><label>Client</label><select id="f-client" onchange="draftInvoice.clientId=this.value">
          ${state.clients.map(c=>`<option value="${c.id}" ${c.id===draftInvoice.clientId?'selected':''}>${esc(c.name)}</option>`).join('')}
        </select></div>
        <div class="field"><label>Échéance</label><input id="f-due" type="date" value="${draftInvoice.dueDate}" onchange="draftInvoice.dueDate=this.value"></div>
      </div>
      ${multiMagasin() ? `<div class="field"><label>Magasin</label><select id="f-magasin" onchange="draftInvoice.magasinId=this.value">${magasinSelectOptions(draftInvoice.magasinId)}</select></div>` : ''}
      <label style="display:block;font-size:.74rem;font-weight:600;color:var(--ink-soft);margin-bottom:8px;text-transform:uppercase;letter-spacing:.03em;">Articles</label>
      <div id="invoice-lines"></div>
      <button class="btn btn-ghost btn-sm" onclick="addInvoiceLine()">+ Ajouter une ligne</button>
      <div id="invoice-totals-block"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveInvoice()">Créer la facture</button>
    </div>
  `;
  renderInvoiceLines();
  openModal();
}

export function renderInvoiceLines(){
  const el = document.getElementById('invoice-lines');
  el.innerHTML = `<div class="line-item" style="margin-bottom:2px;"><div></div><div style="font-size:.62rem;color:var(--ink-soft);text-transform:uppercase;">Qté</div><div style="font-size:.62rem;color:var(--ink-soft);text-transform:uppercase;">Remise%</div><div></div><div></div></div>` +
    draftInvoice.items.map((it,idx)=>`
    <div class="line-item">
      <select onchange="invoiceLineProduct(${idx}, this.value)">
        ${state.products.map(p=>`<option value="${p.id}" ${p.id===it.productId?'selected':''}>${esc(p.name)}</option>`).join('')}
      </select>
      <input type="number" min="1" value="${it.qty}" onchange="invoiceLineQty(${idx}, this.value)">
      <input type="number" min="0" max="100" value="${it.discount||0}" onchange="invoiceLineDiscount(${idx}, this.value)">
      <div class="line-total">${fmtMoney(lineAmounts(it).ht)}</div>
      <button class="icon-btn" onclick="removeInvoiceLine(${idx})">✕</button>
    </div>
  `).join('');
  document.getElementById('invoice-totals-block').innerHTML = renderTotalsBlock(draftInvoice.items);
}
export function addInvoiceLine(){ draftInvoice.items.push({productId:state.products[0].id, qty:1, price:state.products[0].price, discount:0}); renderInvoiceLines(); }
export function removeInvoiceLine(idx){
  if(draftInvoice.items.length===1){ showToast("La facture doit contenir au moins une ligne"); return; }
  draftInvoice.items.splice(idx,1); renderInvoiceLines();
}
export function invoiceLineProduct(idx, pid){
  const p = state.products.find(x=>x.id===pid);
  draftInvoice.items[idx].productId = pid; draftInvoice.items[idx].price = p.price;
  renderInvoiceLines();
}
export function invoiceLineQty(idx, v){ draftInvoice.items[idx].qty = Math.max(1, Number(v)||1); renderInvoiceLines(); }
export function invoiceLineDiscount(idx, v){ draftInvoice.items[idx].discount = Math.min(100, Math.max(0, Number(v)||0)); renderInvoiceLines(); }

export function saveInvoice(){
  const cfg = sectorCfg();
  const magasinId = draftInvoice.magasinId || (defaultMagasin() && defaultMagasin().id);
  const items = draftInvoice.items.map(it=>{
    const p = state.products.find(x=>x.id===it.productId);
    return {productId:it.productId, name:p.name, qty:it.qty, price:it.price, discount:it.discount||0};
  });
  if(cfg.stock){
    const neededByProduct = {};
    items.forEach(it=>{ if(it.productId) neededByProduct[it.productId] = (neededByProduct[it.productId]||0) + it.qty; });
    if(!confirmOrBlockStock(stockShortfalls(neededByProduct, magasinId))) return;
  }
  if(cfg.stock){
    for(const it of items){
      const p = state.products.find(x=>x.id===it.productId);
      if(p){ p.stockByMagasin = p.stockByMagasin||{}; p.stockByMagasin[magasinId] = magasinStock(p,magasinId) - it.qty; }
    }
  }
  const newInvoice = {
    id:uid('inv'), number:nextInvoiceNumber(), clientId:draftInvoice.clientId, magasinId,
    date:todayISO(), dueDate:draftInvoice.dueDate, status:"En attente", delivered:false, reminders:[], payments:[], createdBy:currentUser.name, items
  };
  state.invoices.push(newInvoice);
  const t = docTotals(newInvoice);
  const tiersClient = {type:'client', id:newInvoice.clientId, name:clientName(newInvoice.clientId)};
  const jLines = [{account:"411", label:"Client "+clientName(newInvoice.clientId), debit:t.ttc, credit:0, tiers:tiersClient, lettre:getOrCreateLettre('invoice',newInvoice.id)}, {account:"707", label:"Vente "+newInvoice.number, debit:0, credit:t.ht}];
  if(t.tva>0.5) jLines.push({account:"4431", label:"TVA collectée "+newInvoice.number, debit:0, credit:t.tva});
  pushJournalEntry("VE", newInvoice.date, "Facture "+newInvoice.number+" — "+clientName(newInvoice.clientId), jLines, {type:'invoice', id:newInvoice.id});
  if(cfg.stock){
    items.forEach(it=>{
      if(it.productId) logStockMovement(newInvoice.date, it.productId, magasinId, -it.qty, 'vente', "Vente "+newInvoice.number, 'invoice', newInvoice.id);
    });
    const cogs = items.reduce((s,it)=>{ const p = state.products.find(x=>x.id===it.productId); return s + (p?(p.cost||0):0)*it.qty; }, 0);
    if(cogs>0.5){
      pushJournalEntry("VE", newInvoice.date, "Coût des marchandises vendues — "+newInvoice.number,
        [{account:"6031", label:"Sortie de stock "+newInvoice.number, debit:cogs, credit:0}, {account:"311", label:"Stock — "+newInvoice.number, debit:0, credit:cogs}],
        {type:'invoice', id:newInvoice.id});
    }
  }
  if(draftInvoice.fromDevisId){
    const d = state.devis.find(x=>x.id===draftInvoice.fromDevisId);
    if(d) d.status = "Facturé";
  }
  saveState(); closeModal(); renderLayout(); showToast("Facture créée");
}

export function openPaymentModal(id){
  const inv = state.invoices.find(i=>i.id===id);
  const bal = invoiceBalance(inv);
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>Paiement — ${inv.number}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <p style="font-size:.82rem;color:var(--ink-soft);margin-top:0;">Total facture : ${fmtMoney(invoiceTotal(inv))} · Déjà réglé : ${fmtMoney(invoicePaid(inv))} · Reste dû : <strong>${fmtMoney(bal)}</strong></p>
      <div class="field-row">
        <div class="field"><label>Montant reçu</label><input id="f-amount" type="number" min="1" max="${bal}" value="${bal}"></div>
        <div class="field"><label>Date</label><input id="f-date" type="date" value="${todayISO()}"></div>
      </div>
      <div class="field"><label>Moyen de paiement</label>
        <select id="f-method"><option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option></select>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="recordPayment('${id}')">Enregistrer le paiement</button>
    </div>
  `;
  openModal();
}

export function recordPayment(id){
  const inv = state.invoices.find(i=>i.id===id);
  const bal = invoiceBalance(inv);
  const amount = Number(document.getElementById('f-amount').value)||0;
  if(amount<=0){ showToast("Montant invalide"); return; }
  if(amount>bal+0.5){ showToast("Le montant dépasse le solde dû ("+fmtMoney(bal)+")"); return; }
  const method = document.getElementById('f-method').value;
  const date = document.getElementById('f-date').value || todayISO();
  if(blockIfLocked(date)) return;
  const payId = uid('pay');
  inv.payments = inv.payments||[];
  inv.payments.push({id:payId, date, amount, method});
  recomputeInvoiceStatus(inv);
  const partial = invoiceBalance(inv)>0;
  state.treasury.push({id:uid('trs'), date, label:`Encaissement ${inv.number}${partial?' (paiement partiel — '+method+')':' — '+method}`, type:"in", category:"ventes", method, magasinId:inv.magasinId, amount, generatedFrom:{type:'invoice', id:inv.id}});
  const acc = treasuryAccountForMethod(method);
  pushJournalEntry("BQ", date, `Encaissement ${inv.number} — ${clientName(inv.clientId)}`,
    [{account:acc, label:accountShort(acc), debit:amount, credit:0}, {account:"411", label:"Client "+clientName(inv.clientId), debit:0, credit:amount, tiers:{type:'client', id:inv.clientId, name:clientName(inv.clientId)}, lettre:getOrCreateLettre('invoice',inv.id)}],
    {type:'payment', id:payId});
  saveState(); closeModal(); renderLayout(); showToast(partial ? "Paiement partiel enregistré" : "Facture soldée");
}

export function toggleDelivered(id){
  const inv = state.invoices.find(i=>i.id===id);
  inv.delivered = !inv.delivered;
  saveState(); renderLayout();
}

export function deleteInvoice(id){
  if(!guardDelete()) return;
  const inv = state.invoices.find(i=>i.id===id);
  if(inv && blockIfLocked(inv.date)) return;
  if(inv && invoicePaid(inv)>0){ showToast("Un règlement est enregistré sur cette facture — suppression impossible, émettez un avoir à la place"); return; }
  const cfg = sectorCfg();
  const willRestock = cfg.stock && inv && inv.items.some(it=>it.productId);
  if(!confirm(willRestock ? "Supprimer cette facture ? Les articles vendus seront remis en stock." : "Supprimer cette facture ?")) return;
  if(willRestock){
    inv.items.forEach(it=>{
      if(!it.productId) return;
      const p = state.products.find(x=>x.id===it.productId);
      if(p){ p.stockByMagasin = p.stockByMagasin||{}; p.stockByMagasin[inv.magasinId] = magasinStock(p,inv.magasinId) + it.qty; }
    });
  }
  state.invoices = state.invoices.filter(i=>i.id!==id);
  removeGeneratedEntries('invoice', id);
  removeStockMovements('invoice', id);
  saveState(); renderLayout(); showToast(willRestock ? "Supprimée — stock restitué" : "Supprimée");
}

/* ---- relances clients ---- */
export function buildReminderText(inv){
  return `Objet : Rappel — facture ${inv.number} en attente de règlement

Bonjour,

Nous n'avons pas encore reçu le règlement de la facture ${inv.number} du ${fmtDate(inv.date)}, d'un montant de ${fmtMoney(invoiceTotal(inv))}, échue le ${fmtDate(inv.dueDate)}.

Merci de bien vouloir procéder au paiement dans les meilleurs délais, ou de nous contacter si un point reste à clarifier.

Cordialement,
${state.settings.companyName}`;
}
export function phoneForWa(phone){
  let d = (phone||'').replace(/[^\d+]/g,'');
  if(d.startsWith('+')) return d.slice(1);
  if(d.startsWith('00')) return d.slice(2);
  if(d.startsWith('0')) return '229'+d.slice(1); // convention locale : 0 initial retiré, indicatif +229 ajouté par défaut
  return d;
}
export function openReminderModal(id){
  const inv = state.invoices.find(i=>i.id===id);
  const client = state.clients.find(c=>c.id===inv.clientId);
  const text = buildReminderText(inv);
  const subject = "Relance facture "+inv.number+" — "+state.settings.companyName;
  const mailtoLink = client && client.email ? `mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}` : '';
  const waLink = client && client.phone ? `https://wa.me/${phoneForWa(client.phone)}?text=${encodeURIComponent(text)}` : '';
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const smsLink = client && client.phone ? `sms:${client.phone}${isIOS?'&':'?'}body=${encodeURIComponent(text)}` : '';
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>Relancer ${esc(clientName(inv.clientId))}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <p style="font-size:.82rem;color:var(--ink-soft);margin-top:0;">Envoyez ce message en un clic depuis votre propre e-mail, WhatsApp ou SMS — ou copiez le texte pour un autre canal.</p>
      <textarea id="reminder-text" style="min-height:200px;" readonly>${esc(text)}</textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        ${mailtoLink ? `<a class="btn btn-primary" href="${mailtoLink}" onclick="logReminder('${id}','e-mail')">✉️ Envoyer par e-mail</a>` : `<span class="btn btn-ghost" style="opacity:.5;cursor:not-allowed;" title="Aucun email renseigné pour ce client">✉️ Pas d'email</span>`}
        ${waLink ? `<a class="btn btn-primary" href="${waLink}" target="_blank" rel="noopener" onclick="logReminder('${id}','WhatsApp')">💬 Envoyer par WhatsApp</a>` : `<span class="btn btn-ghost" style="opacity:.5;cursor:not-allowed;" title="Aucun téléphone renseigné pour ce client">💬 Pas de téléphone</span>`}
        ${smsLink ? `<a class="btn btn-ghost" href="${smsLink}" onclick="logReminder('${id}','SMS')">📱 SMS</a>` : ''}
      </div>
      <p style="font-size:.72rem;color:var(--ink-soft);margin-top:10px;">Ces boutons ouvrent votre application d'e-mail, WhatsApp ou SMS habituelle avec le message déjà rempli — il ne reste qu'à cliquer sur Envoyer depuis votre propre compte. Aucune donnée n'est transmise à un serveur tiers ni envoyée automatiquement sans votre action.</p>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Fermer</button>
      <button class="btn btn-ghost" onclick="copyReminderText()">Copier le texte</button>
      <button class="btn btn-primary" onclick="logReminder('${id}')">Marquer comme relancée</button>
    </div>
  `;
  openModal();
}
export function copyReminderText(){
  const t = document.getElementById('reminder-text');
  t.select();
  try{ navigator.clipboard.writeText(t.value); showToast("Texte copié"); }catch(e){ showToast("Copie manuelle : sélectionnez le texte"); }
}
export function logReminder(id, channel){
  const inv = state.invoices.find(i=>i.id===id);
  inv.reminders = inv.reminders||[];
  inv.reminders.push({date:todayISO(), channel:channel||'manuel', userName: currentUser?currentUser.name:''});
  saveState(); closeModal(); renderLayout();
  showToast(channel ? "Relance envoyée par "+channel : "Relance enregistrée");
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, {
  exportInvoicesCSV, openInvoiceModal, saveInvoice, addInvoiceLine, removeInvoiceLine,
  invoiceLineProduct, invoiceLineQty, invoiceLineDiscount, openPaymentModal, recordPayment,
  toggleDelivered, deleteInvoice, openReminderModal, copyReminderText, logReminder,
  get draftInvoice(){ return draftInvoice; }, set draftInvoice(v){ draftInvoice=v; }
});
