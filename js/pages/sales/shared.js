/* ==========================================================
   pages/sales/shared.js — calculs et impression communs aux documents
   de vente (devis, factures, avoirs).
   Extrait des lignes 1340-1364 et 2536-2607 du fichier d'origine.
   Ce fichier n'a pas d'équivalent direct dans l'original — c'est le
   sous-ensemble générique de la section "sales" qui ne concerne
   spécifiquement ni les factures, ni les devis, ni les avoirs.
   ========================================================== */
import { state } from '../../core/state.js';
import { fmtMoney, fmtDate, esc } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { multiMagasin, magasinName } from '../../core/sites.js';
import { productVatRate } from '../Products.js';
import { invoiceBalance } from './Invoices.js';

export function lineAmounts(item){
  const p = item.productId ? state.products.find(x=>x.id===item.productId) : null;
  const rate = productVatRate(p);
  const gross = item.qty*item.price;
  const discount = Math.min(100, Math.max(0, Number(item.discount)||0));
  const ht = gross*(1-discount/100);
  const tva = ht*rate/100;
  return {gross, discount, ht, tva, ttc:ht+tva, rate};
}
export function docTotals(doc){
  let ht=0, tva=0;
  (doc.items||[]).forEach(it=>{ const a=lineAmounts(it); ht+=a.ht; tva+=a.tva; });
  return {ht, tva, ttc:ht+tva};
}
export function renderTotalsBlock(items){
  const t = docTotals({items});
  if(!state.settings.vatEnabled){
    return `<div class="invoice-total"><span>Total</span><span class="mono">${fmtMoney(t.ttc)}</span></div>`;
  }
  return `
    <div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--line-strong);font-size:.85rem;">
      <div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--ink-soft);"><span>Total HT</span><span class="mono">${fmtMoney(t.ht)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--ink-soft);"><span>TVA</span><span class="mono">${fmtMoney(t.tva)}</span></div>
    </div>
    <div class="invoice-total"><span>Total TTC</span><span class="mono">${fmtMoney(t.ttc)}</span></div>
  `;
}

export function openPrintable(kind, id){
  let doc, docLabel, number, date, dueOrValidLabel, dueOrValidValue, items, clientId, extraNote;
  if(kind==='facture'){
    doc = state.invoices.find(i=>i.id===id); docLabel="FACTURE"; number=doc.number; date=doc.date;
    dueOrValidLabel="Échéance"; dueOrValidValue=doc.dueDate; items=doc.items; clientId=doc.clientId;
    const bal = invoiceBalance(doc);
    extraNote = `Statut : ${doc.status}` + (bal>0 ? ` · Reste dû : ${fmtMoney(bal)}` : ' · Facture soldée');
  } else if(kind==='devis'){
    doc = state.devis.find(d=>d.id===id); docLabel="DEVIS"; number=doc.number; date=doc.date;
    dueOrValidLabel="Valable jusqu'au"; dueOrValidValue=doc.validUntil; items=doc.items; clientId=doc.clientId;
    extraNote = "Ce devis est valable jusqu'à la date indiquée ci-dessus. Bon pour accord, signature du client :";
  } else {
    doc = state.creditNotes.find(n=>n.id===id); docLabel="AVOIR"; number=doc.number; date=doc.date;
    dueOrValidLabel="Motif"; dueOrValidValue=doc.reason||'—'; items=doc.items; clientId=doc.clientId;
    extraNote = "Ce montant vient en déduction de la facture référencée.";
  }
  if(!doc) return;
  const c = state.clients.find(x=>x.id===clientId) || {name:"Client",address:"",phone:"",email:""};
  const t = docTotals(doc);
  const vatOn = state.settings.vatEnabled;
  const siteLine = multiMagasin() && doc.magasinId ? `<div class="muted">${esc(magasinName(doc.magasinId))}</div>` : '';
  const hasDiscount = items.some(it=>(it.discount||0)>0);
  const rows = items.map(it=>{
    const a = lineAmounts(it);
    return `<tr>
    <td style="padding:8px 6px;border-bottom:1px solid #ddd;">${esc(it.name)}</td>
    <td style="padding:8px 6px;border-bottom:1px solid #ddd;text-align:center;">${it.qty}</td>
    <td style="padding:8px 6px;border-bottom:1px solid #ddd;text-align:right;">${fmtMoney(it.price)}</td>
    ${hasDiscount ? `<td style="padding:8px 6px;border-bottom:1px solid #ddd;text-align:center;">${a.discount?a.discount+'%':'—'}</td>` : ''}
    ${vatOn ? `<td style="padding:8px 6px;border-bottom:1px solid #ddd;text-align:center;">${a.rate}%</td>` : ''}
    <td style="padding:8px 6px;border-bottom:1px solid #ddd;text-align:right;">${fmtMoney(a.ht)}</td>
  </tr>`;}).join('');
  const totalsHtml = vatOn ? `
    <div style="display:flex;justify-content:flex-end;"><table style="width:auto;min-width:260px;">
      <tr><td style="padding:3px 10px;color:#666;">Total HT</td><td style="padding:3px 0;text-align:right;">${fmtMoney(t.ht)}</td></tr>
      <tr><td style="padding:3px 10px;color:#666;">TVA</td><td style="padding:3px 0;text-align:right;">${fmtMoney(t.tva)}</td></tr>
      <tr><td style="padding:6px 10px;font-weight:700;border-top:1px solid #333;">Total TTC</td><td style="padding:6px 0;text-align:right;font-weight:700;border-top:1px solid #333;">${fmtMoney(t.ttc)}</td></tr>
    </table></div>` : `<div class="tot">Total : ${fmtMoney(t.ttc)}</div>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${docLabel} ${number}</title>
  <style>
    body{font-family:'IBM Plex Sans',Arial,sans-serif;color:#1C2521;padding:40px;max-width:760px;margin:0 auto;}
    h1{font-size:1.5rem;margin:0 0 2px;}
    .muted{color:#666;font-size:.85rem;}
    .headrow{display:flex;justify-content:space-between;margin-bottom:30px;align-items:flex-start;}
    table{width:100%;border-collapse:collapse;margin-top:20px;font-size:.9rem;}
    th{text-align:left;font-size:.72rem;text-transform:uppercase;color:#666;border-bottom:2px solid #333;padding:6px;}
    .tot{display:flex;justify-content:flex-end;margin-top:14px;font-size:1.1rem;font-weight:600;}
    .note{margin-top:40px;font-size:.82rem;color:#444;border-top:1px dashed #ccc;padding-top:14px;}
    @media print{ body{padding:15mm;} }
  </style></head><body>
    <div class="headrow">
      <div style="display:flex;align-items:center;gap:14px;">
        ${state.settings.companyLogo ? `<img src="${state.settings.companyLogo}" alt="Logo" style="height:56px;max-width:160px;object-fit:contain;">` : ''}
        <div><h1>${esc(state.settings.companyName)}</h1><div class="muted">Devise : ${esc(state.settings.currency)}</div>${siteLine}</div>
      </div>
      <div style="text-align:right;"><h1>${docLabel}</h1><div class="muted">${esc(number)} · ${fmtDate(date)}</div></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
      <div><strong>${esc(c.name)}</strong><br><span class="muted">${esc(c.address)||''}<br>${esc(c.phone)||''} ${esc(c.email)?(' · '+esc(c.email)):''}</span></div>
      <div class="muted" style="text-align:right;">${dueOrValidLabel} : ${kind==='avoir'?esc(dueOrValidValue):fmtDate(dueOrValidValue)}</div>
    </div>
    <table><thead><tr><th>Désignation</th><th style="text-align:center;">Qté</th><th style="text-align:right;">Prix unit. HT</th>${hasDiscount?'<th style="text-align:center;">Remise</th>':''}${vatOn?'<th style="text-align:center;">TVA</th>':''}<th style="text-align:right;">Total HT</th></tr></thead>
    <tbody>${rows}</tbody></table>
    ${totalsHtml}
    <div class="note">${extraNote}</div>
  </body></html>`;
  const w = window.open('', '_blank');
  if(!w){ showToast("Autorisez les pop-ups pour imprimer"); return; }
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(()=>{ w.focus(); w.print(); }, 300);
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { openPrintable });
