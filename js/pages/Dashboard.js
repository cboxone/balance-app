/* ==========================================================
   pages/Dashboard.js — tableau de bord (page d'accueil après connexion)
   Extrait des lignes 1150-1330 du fichier d'origine (KPIs, balance
   visuelle SVG, factures récentes, alertes).

   NOTE DE MIGRATION : invoiceTotal/invoiceBalance/statusBadge viennent
   du futur pages/sales/Invoices.js (pas encore migré dans cette passe).
   Voir MIGRATION.md.
   ========================================================== */
import { state, sectorCfg } from '../core/state.js';
import { todayISO, fmtMoney, fmtDate, esc } from '../core/utils.js';
import { belongsToActiveMagasin, multiMagasin, magasinName, scopeLabel, lowStockProducts } from '../core/sites.js';
import { goView } from '../router.js';
import { computeAlerts } from '../components/AlertCenter.js';
import { clientName } from './Clients.js';
import { invoiceTotal, invoiceBalance, statusBadge } from './sales/Invoices.js';

function monthKey(iso){ return iso.slice(0,7); }

export function computeKPIs(){
  const cfg = sectorCfg();
  const now = new Date();
  const nowKey = todayISO().slice(0,7);
  const prevD = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const prevKey = prevD.toISOString().slice(0,7);
  const invoicesInScope = state.invoices.filter(belongsToActiveMagasin);
  const purchasesInScope = state.purchases.filter(belongsToActiveMagasin);
  const treasuryInScope = state.treasury.filter(belongsToActiveMagasin);
  const caMonth = invoicesInScope.filter(i=>monthKey(i.date)===nowKey).reduce((s,i)=>s+invoiceTotal(i),0);
  const caPrevMonth = invoicesInScope.filter(i=>monthKey(i.date)===prevKey).reduce((s,i)=>s+invoiceTotal(i),0);
  const caTrend = caPrevMonth>0 ? ((caMonth-caPrevMonth)/caPrevMonth*100) : (caMonth>0 ? 100 : 0);
  const unpaid = invoicesInScope.filter(i=>invoiceBalance(i)>0);
  const unpaidSum = unpaid.reduce((s,i)=>s+invoiceBalance(i),0);
  const lowStock = lowStockProducts();
  const balance = treasuryInScope.reduce((s,t)=> s + (t.type==='in'?t.amount:-t.amount), 0);
  const inMonth = treasuryInScope.filter(t=>t.type==='in' && monthKey(t.date)===nowKey).reduce((s,t)=>s+t.amount,0);
  const outMonth = treasuryInScope.filter(t=>t.type==='out' && monthKey(t.date)===nowKey).reduce((s,t)=>s+t.amount,0);
  return {caMonth, caPrevMonth, caTrend, unpaid, unpaidSum, lowStock, balance, inMonth, outMonth, invoicesInScope};
}

function balanceSVG(inM,outM){
  const total = inM+outM;
  const ratio = total>0 ? (inM-outM)/total : 0; // -1..1
  const angle = Math.max(-16, Math.min(16, ratio*16));
  return `
  <svg class="balance-svg" viewBox="0 0 160 120">
    <line x1="80" y1="14" x2="80" y2="24" stroke="#8FA0C8" stroke-width="2"/>
    <g transform="rotate(${-angle} 80 24)">
      <line x1="20" y1="24" x2="140" y2="24" stroke="#D9A84E" stroke-width="3" stroke-linecap="round"/>
      <line x1="20" y1="24" x2="20" y2="${50+angle}" stroke="#8FA0C8" stroke-width="1.5"/>
      <line x1="140" y1="24" x2="140" y2="${50-angle}" stroke="#8FA0C8" stroke-width="1.5"/>
      <path d="M6 ${50+angle} a14 10 0 0 0 28 0 Z" fill="none" stroke="#EEF1F6" stroke-width="2"/>
      <path d="M126 ${50-angle} a14 10 0 0 0 28 0 Z" fill="none" stroke="#EEF1F6" stroke-width="2"/>
    </g>
    <circle cx="80" cy="24" r="4" fill="#D9A84E"/>
    <path d="M65 100h30l10 14H55z" fill="#233457"/>
    <line x1="80" y1="24" x2="80" y2="100" stroke="#8FA0C8" stroke-width="2"/>
  </svg>`;
}

let __dashAlerts = [];

export function renderDashboard(){
  const k = computeKPIs();
  const cfg = sectorCfg();
  const dashScopeLabel = scopeLabel();
  let verdict, detail;
  if(k.inMonth===0 && k.outMonth===0){ verdict="Pas encore de mouvement ce mois-ci"; detail="Enregistrez une vente ou une dépense pour activer la balance."; }
  else if(k.inMonth>=k.outMonth){ verdict="La balance penche du bon côté"; detail=`Les entrées dépassent les sorties de ${fmtMoney(k.inMonth-k.outMonth)} ce mois-ci.`; }
  else { verdict="La balance penche vers les dépenses"; detail=`Les sorties dépassent les entrées de ${fmtMoney(k.outMonth-k.inMonth)} ce mois-ci.`; }

  const recentInvoices = [...k.invoicesInScope].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  const alerts = computeAlerts();
  __dashAlerts = alerts;

  return `
    ${multiMagasin() ? `<div style="font-size:.78rem;color:var(--ink-soft);margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em;">Vue : ${esc(dashScopeLabel)}</div>` : ''}
    <div class="balance-hero">
      ${balanceSVG(k.inMonth,k.outMonth)}
      <div class="balance-text">
        <div class="balance-eyebrow">Santé financière du mois</div>
        <div class="balance-verdict">${verdict}</div>
        <div class="balance-detail">${detail}</div>
      </div>
      <div class="balance-figs">
        <div class="balance-fig"><div class="l">Entrées</div><div class="v">${fmtMoney(k.inMonth)}</div></div>
        <div class="balance-fig"><div class="l">Sorties</div><div class="v">${fmtMoney(k.outMonth)}</div></div>
      </div>
    </div>

    <div class="grid-kpi">
      <div class="kpi"><div class="kpi-label">Chiffre d'affaires (mois)</div><div class="kpi-value">${fmtMoney(k.caMonth)}</div><div class="kpi-sub ${k.caTrend>=0?'good':'warn'}">${k.caPrevMonth>0 ? (k.caTrend>=0?'▲ +':'▼ ')+Math.abs(k.caTrend).toFixed(0)+'% vs mois dernier' : 'Toutes factures émises'}</div></div>
      <div class="kpi"><div class="kpi-label">Factures impayées</div><div class="kpi-value">${k.unpaid.length}</div><div class="kpi-sub ${k.unpaid.length?'warn':''}">${fmtMoney(k.unpaidSum)}</div></div>
      ${cfg.stock ? `<div class="kpi"><div class="kpi-label">Stock bas</div><div class="kpi-value">${k.lowStock.length}</div><div class="kpi-sub ${k.lowStock.length?'warn':'good'}">${k.lowStock.length?'à réapprovisionner':'niveaux corrects'}</div></div>`
                  : `<div class="kpi"><div class="kpi-label">${cfg.clientNoun}</div><div class="kpi-value">${state.clients.length}</div><div class="kpi-sub">au total</div></div>`}
      <div class="kpi"><div class="kpi-label">Solde de trésorerie</div><div class="kpi-value">${fmtMoney(k.balance)}</div><div class="kpi-sub ${k.balance>=0?'good':'warn'}">${k.balance>=0?'positif':'négatif'}</div></div>
    </div>

    <div class="two-col">
      <div class="panel">
        <div class="panel-head"><h3>Factures récentes</h3><button class="btn btn-ghost btn-sm" data-goto="sales">Voir tout</button></div>
        <div class="panel-body" style="padding:0;">
          ${recentInvoices.length ? `<table><thead><tr><th>N°</th><th>Client</th>${multiMagasin()?'<th>Magasin</th>':''}<th>Date</th><th class="tright">Montant</th><th>Statut</th></tr></thead><tbody>
            ${recentInvoices.map(inv=>`<tr><td class="mono">${inv.number}</td><td>${esc(clientName(inv.clientId))}</td>${multiMagasin()?`<td>${esc(magasinName(inv.magasinId))}</td>`:''}<td>${fmtDate(inv.date)}</td><td class="tright mono">${fmtMoney(invoiceTotal(inv))}</td><td>${statusBadge(inv)}</td></tr>`).join('')}
          </tbody></table>` : `<div class="empty">Aucune facture pour l'instant.</div>`}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Alertes${alerts.length?` (${alerts.length})`:''}</h3></div>
        <div class="panel-body">
          ${alerts.length ? alerts.slice(0,8).map((a,idx)=>`<button data-alert-idx="${idx}" class="alert-row alert-${a.level}">
              <span class="alert-dot"></span><span>${esc(a.message)}</span></button>`).join('')
            : `<div class="empty" style="padding:20px 0;">Rien à signaler — tout est sous contrôle.</div>`}
        </div>
      </div>
    </div>
  `;
}

export function afterRenderDashboard(){
  document.querySelectorAll('[data-goto]').forEach(el=>{
    el.addEventListener('click', ()=>goView(el.dataset.goto));
  });
  document.querySelectorAll('[data-alert-idx]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const a = __dashAlerts[Number(el.dataset.alertIdx)];
      if(a) a.run();
    });
  });
}
