/* ==========================================================
   pages/reports/SalesAnalysis.js — analyse des ventes (rapports)
   Extrait des lignes 3308-3453 du fichier d'origine.
   ========================================================== */
import { state, sectorCfg } from '../../core/state.js';
import { fmtMoney, esc, downloadCSV } from '../../core/utils.js';
import { belongsToActiveMagasin, multiMagasin, scopeLabel } from '../../core/sites.js';
import { clientName } from '../Clients.js';
import { invoiceTotal } from '../sales/Invoices.js';
import { lineAmounts } from '../sales/shared.js';
import { reportPrintShell } from '../../core/print-shell.js';

function monthKey(iso){ return iso.slice(0,7); }

export function computeSalesAnalysis(){
  const months = [];
  const now = new Date();
  for(let i=5;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    months.push(d.toISOString().slice(0,7));
  }
  const scopedInvoices = state.invoices.filter(belongsToActiveMagasin);
  const caByMonth = months.map(m=>scopedInvoices.filter(i=>monthKey(i.date)===m).reduce((s,i)=>s+invoiceTotal(i),0));
  const monthLabels = months.map(m=>{
    const d = new Date(m+"-01T00:00:00");
    return d.toLocaleDateString('fr-FR',{month:'short'});
  });
  const monthLabelsLong = months.map(m=>{
    const d = new Date(m+"-01T00:00:00");
    return d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  });
  const qtyByProduct = {};
  scopedInvoices.forEach(inv=>inv.items.forEach(it=>{ qtyByProduct[it.name] = (qtyByProduct[it.name]||0) + it.qty; }));
  const top = Object.entries(qtyByProduct).sort((a,b)=>b[1]-a[1]).slice(0,5);
  function lineMargin(it){
    const p = it.productId ? state.products.find(x=>x.id===it.productId) : null;
    const cost = p ? (p.cost||0) : 0;
    return lineAmounts(it).ht - cost*it.qty;
  }
  let marginHT = 0, salesHT = 0;
  scopedInvoices.forEach(inv=>inv.items.forEach(it=>{ marginHT += lineMargin(it); salesHT += lineAmounts(it).ht; }));
  const marginRate = salesHT>0 ? (marginHT/salesHT*100) : 0;
  const caByClient = {};
  scopedInvoices.forEach(inv=>{ caByClient[inv.clientId] = (caByClient[inv.clientId]||0) + invoiceTotal(inv); });
  const topClients = Object.entries(caByClient).sort((a,b)=>b[1]-a[1]).slice(0,5);
  return {months, caByMonth, monthLabels, monthLabelsLong, top, marginHT, salesHT, marginRate, topClients};
}

export function renderSalesAnalysis(){
  const {caByMonth, monthLabels, top, marginHT, salesHT, marginRate, topClients} = computeSalesAnalysis();
  const maxCA = Math.max(1,...caByMonth);
  const maxQty = Math.max(1,...top.map(t=>t[1]));
  const maxClientCA = Math.max(1,...topClients.map(t=>t[1]));

  return `
    ${multiMagasin() ? `<div style="font-size:.78rem;color:var(--ink-soft);margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em;">Vue : ${esc(scopeLabel())}</div>` : ''}
    <div class="grid-kpi" style="grid-template-columns:repeat(2,1fr);margin-bottom:14px;">
      <div class="kpi"><div class="kpi-label">Marge brute (ventes facturées)</div><div class="kpi-value">${fmtMoney(marginHT)}</div><div class="kpi-sub">Sur la période affichée dans les graphiques ci-dessous</div></div>
      <div class="kpi"><div class="kpi-label">Taux de marge</div><div class="kpi-value">${marginRate.toFixed(1)}%</div><div class="kpi-sub">Marge / chiffre d'affaires HT</div></div>
    </div>
    <div class="two-col">
      <div class="panel">
        <div class="panel-head"><h3>Chiffre d'affaires — 6 derniers mois</h3></div>
        <div class="panel-body">
          <div class="barchart">
            ${caByMonth.map((v,idx)=>`<div class="col">
              <div class="val">${v>0?Math.round(v/1000)+'k':''}</div>
              <div class="bar" style="height:${(v/maxCA*120)||2}px"></div>
              <div class="lbl">${monthLabels[idx]}</div>
            </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Top ${sectorCfg().products.toLowerCase()}</h3></div>
        <div class="panel-body">
          ${top.length ? top.map(([name,qty])=>`
            <div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:4px;">
                <span>${esc(name)}</span><span class="mono">${qty}</span>
              </div>
              <div class="stockbar" style="width:100%;height:7px;"><div style="width:${qty/maxQty*100}%"></div></div>
            </div>`).join('') : `<div class="empty" style="padding:20px 0;">Pas encore de ventes à analyser.</div>`}
        </div>
      </div>
    </div>
    <div class="two-col" style="margin-top:16px;">
      <div class="panel">
        <div class="panel-head"><h3>Top ${sectorCfg().clientNoun.toLowerCase()}</h3></div>
        <div class="panel-body">
          ${topClients.length ? topClients.map(([cid,ca])=>`
            <div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:4px;">
                <span>${esc(clientName(cid))}</span><span class="mono">${fmtMoney(ca)}</span>
              </div>
              <div class="stockbar" style="width:100%;height:7px;"><div style="width:${ca/maxClientCA*100}%"></div></div>
            </div>`).join('') : `<div class="empty" style="padding:20px 0;">Pas encore de ventes à analyser.</div>`}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Répartition de la marge</h3></div>
        <div class="panel-body">
          <p style="font-size:.82rem;color:var(--ink-soft);margin-top:0;">Chiffre d'affaires HT : <strong style="color:var(--ink);">${fmtMoney(salesHT)}</strong></p>
          <p style="font-size:.82rem;color:var(--ink-soft);">Coût des ventes : <strong style="color:var(--ink);">${fmtMoney(salesHT-marginHT)}</strong></p>
          <p style="font-size:.82rem;color:var(--ink-soft);">Marge brute : <strong style="color:var(--sage);">${fmtMoney(marginHT)}</strong></p>
          <div class="stockbar" style="width:100%;height:10px;margin-top:10px;"><div style="width:${Math.min(100,Math.max(0,marginRate))}%"></div></div>
          <p style="font-size:.72rem;color:var(--ink-soft);margin-top:10px;">Calculée à partir du coût d'achat renseigné sur chaque article. Les articles sans coût renseigné sont comptés à marge 100%.</p>
        </div>
      </div>
    </div>
  `;
}

export function exportSalesAnalysisCSV(){
  const {monthLabelsLong, caByMonth, top, topClients, salesHT, marginHT, marginRate} = computeSalesAnalysis();
  const rows = [
    ["ANALYSE DES VENTES"], [],
    ["Chiffre d'affaires par mois"],
    ["Mois","CA TTC"],
    ...monthLabelsLong.map((m,idx)=>[m, caByMonth[idx]]),
    [],
    ["Top "+sectorCfg().products.toLowerCase()+" (quantité vendue)"],
    ["Article","Quantité"],
    ...top.map(([name,qty])=>[name,qty]),
    [],
    ["Top "+sectorCfg().clientNoun.toLowerCase()+" (CA)"],
    ["Client","CA TTC"],
    ...topClients.map(([cid,ca])=>[clientName(cid), ca]),
    [],
    ["Marge"],
    ["Chiffre d'affaires HT", salesHT],
    ["Coût des ventes", salesHT-marginHT],
    ["Marge brute", marginHT],
    ["Taux de marge (%)", marginRate.toFixed(1)]
  ];
  downloadCSV('analyse-ventes.csv', [], rows);
}

export function printSalesAnalysis(){
  const {monthLabelsLong, caByMonth, top, topClients, salesHT, marginHT, marginRate} = computeSalesAnalysis();
  const body = `
    <h2>Chiffre d'affaires — 6 derniers mois</h2>
    <table><thead><tr><th>Mois</th><th class="num">CA TTC</th></tr></thead><tbody>
      ${monthLabelsLong.map((m,idx)=>`<tr><td>${esc(m)}</td><td class="num">${fmtMoney(caByMonth[idx])}</td></tr>`).join('')}
    </tbody></table>
    <h2>Top ${esc(sectorCfg().products.toLowerCase())}</h2>
    <table><thead><tr><th>Article</th><th class="num">Quantité vendue</th></tr></thead><tbody>
      ${top.length?top.map(([name,qty])=>`<tr><td>${esc(name)}</td><td class="num">${qty}</td></tr>`).join(''):'<tr><td colspan="2">Aucune vente</td></tr>'}
    </tbody></table>
    <h2>Top ${esc(sectorCfg().clientNoun.toLowerCase())}</h2>
    <table><thead><tr><th>Client</th><th class="num">CA TTC</th></tr></thead><tbody>
      ${topClients.length?topClients.map(([cid,ca])=>`<tr><td>${esc(clientName(cid))}</td><td class="num">${fmtMoney(ca)}</td></tr>`).join(''):'<tr><td colspan="2">Aucune vente</td></tr>'}
    </tbody></table>
    <h2>Marge</h2>
    <table><tbody>
      <tr><td>Chiffre d'affaires HT</td><td class="num">${fmtMoney(salesHT)}</td></tr>
      <tr><td>Coût des ventes</td><td class="num">${fmtMoney(salesHT-marginHT)}</td></tr>
      <tr><td>Marge brute</td><td class="num">${fmtMoney(marginHT)}</td></tr>
      <tr><td>Taux de marge</td><td class="num">${marginRate.toFixed(1)}%</td></tr>
    </tbody></table>
  `;
  reportPrintShell("Analyse des ventes", multiMagasin()?scopeLabel():"6 derniers mois", body);
}
