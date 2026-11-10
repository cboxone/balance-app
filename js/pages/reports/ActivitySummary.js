/* ==========================================================
   pages/reports/ActivitySummary.js — bilan d'activité (synthèse
   sur une période choisie).
   Extrait des lignes 3455-3594 du fichier d'origine.
   ========================================================== */
import { state, sectorCfg } from '../../core/state.js';
import { todayISO, addDaysISO, fmtMoney, fmtDate, esc, downloadCSV } from '../../core/utils.js';
import { belongsToActiveMagasin, multiMagasin, scopeLabel, totalStock, isLow } from '../../core/sites.js';
import { renderLayout } from '../../components/Layout.js';
import { lastClosureDate, periodTrialBalance } from '../../core/accounting-engine.js';
import { invoiceTotal } from '../sales/Invoices.js';
import { purchaseTotal } from '../Purchases.js';
import { assetRecordedDepreciation } from '../accounting/Assets.js';
import { reportPrintShell } from '../../core/print-shell.js';

export function setBilanRange(preset){
  const today = todayISO();
  let start = today, end = today;
  if(preset==='today'){ start = today; }
  else if(preset==='week'){
    const d = new Date(today+'T00:00:00'); const day = (d.getDay()+6)%7; d.setDate(d.getDate()-day);
    start = d.toISOString().slice(0,10);
  } else if(preset==='month'){ start = today.slice(0,8)+'01'; }
  else if(preset==='exercice'){
    const lc = lastClosureDate();
    start = lc ? addDaysISO(lc,1) : ([...state.journalEntries].sort((a,b)=>a.date.localeCompare(b.date))[0]||{date:today}).date;
  }
  window.__bilanStart = start; window.__bilanEnd = end; renderLayout();
}

export function computeActivitySummary(){
  const cfg = sectorCfg();
  const today = todayISO();
  const start = window.__bilanStart || today.slice(0,8)+'01';
  const end = window.__bilanEnd || today;
  const scopedInvoices = state.invoices.filter(belongsToActiveMagasin).filter(i=>i.date>=start && i.date<=end);
  const scopedPurchases = state.purchases.filter(belongsToActiveMagasin).filter(p=>p.date>=start && p.date<=end);
  const scopedTreasury = state.treasury.filter(belongsToActiveMagasin).filter(t=>t.date>=start && t.date<=end);
  const caTTC = scopedInvoices.reduce((s,i)=>s+invoiceTotal(i),0);
  const nbFactures = scopedInvoices.length;
  const encaissements = state.invoices.reduce((s,i)=>s+(i.payments||[]).filter(pay=>pay.date>=start && pay.date<=end).reduce((s2,pay)=>s2+pay.amount,0),0);
  const achatsTotal = scopedPurchases.reduce((s,p)=>s+purchaseTotal(p),0);
  const reglementsFournisseurs = state.purchases.reduce((s,p)=>s+(p.payments||[]).filter(pay=>pay.date>=start && pay.date<=end).reduce((s2,pay)=>s2+pay.amount,0),0);
  const entrees = scopedTreasury.filter(t=>t.type==='in').reduce((s,t)=>s+t.amount,0);
  const sorties = scopedTreasury.filter(t=>t.type==='out').reduce((s,t)=>s+t.amount,0);
  const rows = periodTrialBalance(start,end);
  const produits = rows.filter(r=>r.code.startsWith('7')).reduce((s,r)=>s-r.balance,0);
  const charges = rows.filter(r=>r.code.startsWith('6')).reduce((s,r)=>s+r.balance,0);
  const resultat = produits-charges;
  const nbNouveauxClients = state.clients.filter(c=>c.createdAt && c.createdAt>=start && c.createdAt<=end).length;
  const valeurStock = cfg.stock ? state.products.reduce((s,p)=>s+totalStock(p)*(p.cost||0),0) : 0;
  const articlesBas = cfg.stock ? state.products.filter(p=>isLow(p)).length : 0;
  const vncImmob = (state.assets||[]).filter(a=>a.status==='actif'||!a.status).reduce((s,a)=>s+Math.max(0,(Number(a.acquisitionValue)||0)-assetRecordedDepreciation(a.id)),0);
  return {cfg, start, end, caTTC, nbFactures, encaissements, achatsTotal, reglementsFournisseurs, entrees, sorties, produits, charges, resultat, nbNouveauxClients, valeurStock, articlesBas, vncImmob};
}

export function renderActivitySummary(){
  const {cfg, start, end, caTTC, nbFactures, encaissements, achatsTotal, reglementsFournisseurs, entrees, sorties, produits, charges, resultat, nbNouveauxClients, valeurStock, articlesBas, vncImmob} = computeActivitySummary();
  const presetBtn = (p,l)=>`<button class="btn btn-sm btn-ghost" onclick="setBilanRange('${p}')">${l}</button>`;
  return `
    ${multiMagasin() ? `<div style="font-size:.78rem;color:var(--ink-soft);margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em;">Vue : ${esc(scopeLabel())}</div>` : ''}
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-body" style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;">
        <div class="field" style="max-width:170px;margin:0;"><label>Du</label><input type="date" value="${start}" onchange="window.__bilanStart=this.value; renderLayout();"></div>
        <div class="field" style="max-width:170px;margin:0;"><label>Au</label><input type="date" value="${end}" onchange="window.__bilanEnd=this.value; renderLayout();"></div>
        ${presetBtn('today',"Aujourd'hui")}${presetBtn('week',"Cette semaine")}${presetBtn('month',"Ce mois")}${presetBtn('exercice',"Exercice en cours")}
      </div>
    </div>
    <div class="grid-kpi" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px;">
      <div class="kpi"><div class="kpi-label">Chiffre d'affaires TTC</div><div class="kpi-value">${fmtMoney(caTTC)}</div><div class="kpi-sub">${nbFactures} facture(s) émise(s)</div></div>
      <div class="kpi"><div class="kpi-label">Encaissements reçus</div><div class="kpi-value" style="color:var(--sage);">${fmtMoney(encaissements)}</div><div class="kpi-sub">Règlements clients sur la période</div></div>
      <div class="kpi"><div class="kpi-label">Achats commandés</div><div class="kpi-value">${fmtMoney(achatsTotal)}</div><div class="kpi-sub">Réglé aux fournisseurs : ${fmtMoney(reglementsFournisseurs)}</div></div>
      <div class="kpi"><div class="kpi-label">Résultat de la période</div><div class="kpi-value" style="color:${resultat>=0?'var(--sage)':'var(--rust)'};">${fmtMoney(resultat)}</div><div class="kpi-sub">Produits ${fmtMoney(produits)} — Charges ${fmtMoney(charges)}</div></div>
    </div>
    <div class="two-col" style="margin-bottom:16px;">
      <div class="panel">
        <div class="panel-head"><h3>Trésorerie sur la période</h3></div>
        <div class="panel-body">
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);"><span>Entrées</span><span class="mono" style="color:var(--sage);">${fmtMoney(entrees)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);"><span>Sorties</span><span class="mono" style="color:var(--rust);">${fmtMoney(sorties)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:700;"><span>Solde net</span><span class="mono">${fmtMoney(entrees-sorties)}</span></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Patrimoine (à ce jour)</h3></div>
        <div class="panel-body">
          ${cfg.stock ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);"><span>Valeur du stock (au coût)</span><span class="mono">${fmtMoney(valeurStock)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);"><span>Articles sous le seuil d'alerte</span><span class="mono" style="${articlesBas>0?'color:var(--rust);':''}">${articlesBas}</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;padding:8px 0;${cfg.stock?'':'border-top:none;'}"><span>Valeur nette des immobilisations</span><span class="mono">${fmtMoney(vncImmob)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;"><span>Nouveaux ${cfg.clientNoun.toLowerCase()} sur la période</span><span class="mono">${nbNouveauxClients}</span></div>
        </div>
      </div>
    </div>
    <p style="font-size:.76rem;color:var(--ink-soft);">Synthèse d'activité du ${fmtDate(start)} au ${fmtDate(end)}. Le résultat de la période reprend tous les produits et charges comptabilisés sur ces dates (ventes, achats, trésorerie, dotations aux amortissements le cas échéant) ; la valeur du stock et des immobilisations est donnée à la date d'aujourd'hui. À faire valider par un expert-comptable avant tout usage officiel.</p>
  `;
}

export function exportActivitySummaryCSV(){
  const {start, end, caTTC, nbFactures, encaissements, achatsTotal, reglementsFournisseurs, entrees, sorties, produits, charges, resultat, nbNouveauxClients, valeurStock, articlesBas, vncImmob, cfg} = computeActivitySummary();
  const rows = [
    ["BILAN D'ACTIVITÉ"],
    ["Période", fmtDate(start)+" au "+fmtDate(end)], [],
    ["Ventes"],
    ["Chiffre d'affaires TTC facturé", caTTC],
    ["Nombre de factures émises", nbFactures],
    ["Encaissements reçus", encaissements], [],
    ["Achats"],
    ["Achats commandés", achatsTotal],
    ["Réglé aux fournisseurs", reglementsFournisseurs], [],
    ["Résultat"],
    ["Produits", produits],
    ["Charges", charges],
    ["Résultat de la période", resultat], [],
    ["Trésorerie"],
    ["Entrées", entrees],
    ["Sorties", sorties],
    ["Solde net", entrees-sorties], [],
    ["Patrimoine (à ce jour)"],
    ...(cfg.stock ? [["Valeur du stock (au coût)", valeurStock], ["Articles sous le seuil d'alerte", articlesBas]] : []),
    ["Valeur nette des immobilisations", vncImmob],
    ["Nouveaux "+cfg.clientNoun.toLowerCase()+" sur la période", nbNouveauxClients]
  ];
  downloadCSV('bilan-activite.csv', [], rows);
}

export function printActivitySummary(){
  const {start, end, caTTC, nbFactures, encaissements, achatsTotal, reglementsFournisseurs, entrees, sorties, produits, charges, resultat, nbNouveauxClients, valeurStock, articlesBas, vncImmob, cfg} = computeActivitySummary();
  const body = `
    <h2>Ventes &amp; achats</h2>
    <table><tbody>
      <tr><td>Chiffre d'affaires TTC facturé</td><td class="num">${fmtMoney(caTTC)}</td></tr>
      <tr><td>Nombre de factures émises</td><td class="num">${nbFactures}</td></tr>
      <tr><td>Encaissements reçus</td><td class="num">${fmtMoney(encaissements)}</td></tr>
      <tr><td>Achats commandés</td><td class="num">${fmtMoney(achatsTotal)}</td></tr>
      <tr><td>Réglé aux fournisseurs</td><td class="num">${fmtMoney(reglementsFournisseurs)}</td></tr>
    </tbody></table>
    <h2>Résultat de la période</h2>
    <table><tbody>
      <tr><td>Produits</td><td class="num">${fmtMoney(produits)}</td></tr>
      <tr><td>Charges</td><td class="num">${fmtMoney(charges)}</td></tr>
      <tr><td><strong>Résultat</strong></td><td class="num"><strong>${fmtMoney(resultat)}</strong></td></tr>
    </tbody></table>
    <h2>Trésorerie</h2>
    <table><tbody>
      <tr><td>Entrées</td><td class="num">${fmtMoney(entrees)}</td></tr>
      <tr><td>Sorties</td><td class="num">${fmtMoney(sorties)}</td></tr>
      <tr><td><strong>Solde net</strong></td><td class="num"><strong>${fmtMoney(entrees-sorties)}</strong></td></tr>
    </tbody></table>
    <h2>Patrimoine (à ce jour)</h2>
    <table><tbody>
      ${cfg.stock ? `<tr><td>Valeur du stock (au coût)</td><td class="num">${fmtMoney(valeurStock)}</td></tr>
      <tr><td>Articles sous le seuil d'alerte</td><td class="num">${articlesBas}</td></tr>` : ''}
      <tr><td>Valeur nette des immobilisations</td><td class="num">${fmtMoney(vncImmob)}</td></tr>
      <tr><td>Nouveaux ${esc(cfg.clientNoun.toLowerCase())} sur la période</td><td class="num">${nbNouveauxClients}</td></tr>
    </tbody></table>
  `;
  reportPrintShell("Bilan d'activité", "Période du "+fmtDate(start)+" au "+fmtDate(end), body);
}
