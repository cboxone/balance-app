/* ==========================================================
   pages/accounting/Vat.js — déclaration de TVA
   Extrait des lignes 4213-4283 du fichier d'origine.
   ========================================================== */
import { state } from '../../core/state.js';
import { todayISO, fmtMoney, fmtDate, downloadCSV } from '../../core/utils.js';
import { renderLayout } from '../../components/Layout.js';
import { periodTrialBalance } from '../../core/accounting-engine.js';
import { reportPrintShell } from '../../core/print-shell.js';

export function computeVatDeclaration(start, end){
  const rows = periodTrialBalance(start, end);
  const collectee = rows.filter(r=>r.code==='4431').reduce((s,r)=>s-r.balance,0); // compte de passif : balance créditrice négative
  const deductible = rows.filter(r=>r.code==='4452').reduce((s,r)=>s+r.balance,0); // compte d'actif : balance débitrice positive
  const net = collectee - deductible;
  return {collectee, deductible, net};
}

export function renderVatTab(){
  const today = todayISO();
  const start = window.__vatStart || today.slice(0,8)+'01';
  const end = window.__vatEnd || today;
  const {collectee, deductible, net} = computeVatDeclaration(start, end);
  const presetBtn = (p,l)=>`<button class="btn btn-sm btn-ghost" onclick="setVatRange('${p}')">${l}</button>`;
  return `
    ${!state.settings.vatEnabled ? `<div class="panel" style="margin-bottom:16px;"><div class="panel-body"><p style="margin:0;font-size:.85rem;color:var(--ink-soft);">La TVA est désactivée dans Paramètres — cette déclaration sera à zéro tant qu'elle n'est pas activée.</p></div></div>` : ''}
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-body" style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;">
        <div class="field" style="max-width:170px;margin:0;"><label>Du</label><input type="date" value="${start}" onchange="window.__vatStart=this.value; renderLayout();"></div>
        <div class="field" style="max-width:170px;margin:0;"><label>Au</label><input type="date" value="${end}" onchange="window.__vatEnd=this.value; renderLayout();"></div>
        ${presetBtn('month','Ce mois')}${presetBtn('quarter','Ce trimestre')}${presetBtn('year','Cette année')}
        <div style="flex:1;"></div>
        <button class="btn btn-sm btn-ghost" onclick="exportVatCSV()">Exporter CSV</button>
        <button class="btn btn-sm btn-ghost" onclick="printVatDeclaration()">Imprimer / PDF</button>
      </div>
    </div>
    <div class="grid-kpi" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px;">
      <div class="kpi"><div class="kpi-label">TVA collectée (ventes)</div><div class="kpi-value">${fmtMoney(collectee)}</div></div>
      <div class="kpi"><div class="kpi-label">TVA déductible (achats)</div><div class="kpi-value">${fmtMoney(deductible)}</div></div>
      <div class="kpi"><div class="kpi-label">${net>=0?'TVA nette à payer':'Crédit de TVA reportable'}</div><div class="kpi-value" style="color:${net>=0?'var(--rust)':'var(--sage)'};">${fmtMoney(Math.abs(net))}</div></div>
    </div>
    <p style="font-size:.76rem;color:var(--ink-soft);">Période du ${fmtDate(start)} au ${fmtDate(end)}. Calculée à partir des comptes 4431 (TVA collectée) et 4452 (TVA déductible) mouvementés sur la période. Ce document prépare votre déclaration mais ne la télétransmet pas à l'administration fiscale — reportez ces montants sur le formulaire officiel ou transmettez-les à votre comptable.</p>
  `;
}

export function setVatRange(preset){
  const today = todayISO();
  let start = today;
  if(preset==='month') start = today.slice(0,8)+'01';
  else if(preset==='quarter'){ const d = new Date(today+'T00:00:00'); const q = Math.floor(d.getMonth()/3)*3; start = new Date(d.getFullYear(), q, 1).toISOString().slice(0,10); }
  else if(preset==='year') start = today.slice(0,4)+'-01-01';
  window.__vatStart = start; window.__vatEnd = today; renderLayout();
}

export function exportVatCSV(){
  const today = todayISO();
  const start = window.__vatStart || today.slice(0,8)+'01';
  const end = window.__vatEnd || today;
  const {collectee, deductible, net} = computeVatDeclaration(start, end);
  const rows = [
    ["DÉCLARATION DE TVA"],
    ["Période", fmtDate(start)+" au "+fmtDate(end)], [],
    ["TVA collectée (compte 4431)", collectee],
    ["TVA déductible (compte 4452)", deductible],
    [net>=0?"TVA nette à payer":"Crédit de TVA reportable", Math.abs(net)]
  ];
  downloadCSV('declaration-tva.csv', [], rows);
}

export function printVatDeclaration(){
  const today = todayISO();
  const start = window.__vatStart || today.slice(0,8)+'01';
  const end = window.__vatEnd || today;
  const {collectee, deductible, net} = computeVatDeclaration(start, end);
  const body = `
    <h2>Déclaration de TVA</h2>
    <table><tbody>
      <tr><td>TVA collectée (ventes)</td><td class="num">${fmtMoney(collectee)}</td></tr>
      <tr><td>TVA déductible (achats)</td><td class="num">${fmtMoney(deductible)}</td></tr>
      <tr><td><strong>${net>=0?'TVA nette à payer':'Crédit de TVA reportable'}</strong></td><td class="num"><strong>${fmtMoney(Math.abs(net))}</strong></td></tr>
    </tbody></table>
    <p style="font-size:.78rem;color:#666;margin-top:20px;">Ce document est une aide à la préparation de votre déclaration ; il ne constitue pas une télédéclaration officielle. Reportez ces montants sur le formulaire de votre administration fiscale ou transmettez ce document à votre expert-comptable.</p>
  `;
  reportPrintShell("Déclaration de TVA", "Période du "+fmtDate(start)+" au "+fmtDate(end), body);
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { setVatRange, exportVatCSV, printVatDeclaration });
