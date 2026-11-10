/* ==========================================================
   components/AlertCenter.js — centre d'alertes multi-niveaux (cloche de la Navbar)
   Extrait des lignes 1191-1272 du fichier d'origine.

   NOTE DE MIGRATION : computeAlerts() interroge les ventes/devis/avoirs/achats.
   Tant que pages/sales/*.js et pages/Purchases.js n'ont pas été migrés (voir
   le plan de migration fourni avec ce projet), les imports ci-dessous doivent
   pointer vers les fichiers réels une fois créés — les noms de fonctions et
   leur signature n'ont volontairement pas changé pour que le branchement soit
   immédiat.
   ========================================================== */
import { state, sectorCfg } from '../core/state.js';
import { can } from '../core/auth.js';
import { belongsToActiveMagasin, lowStockPerMagasin, multiMagasin } from '../core/sites.js';
import { todayISO, fmtMoney, fmtDate, esc } from '../core/utils.js';
import { goView } from '../router.js';
import { invoiceBalance } from '../pages/sales/Invoices.js';
import { devisEffectiveStatus } from '../pages/sales/Devis.js';
import { purchaseIsLateDelivery, purchaseBalance } from '../pages/Purchases.js';

export function computeAlerts(){
  const cfg = sectorCfg();
  const out = [];
  if(can('sales')){
    const invoicesInScope = state.invoices.filter(belongsToActiveMagasin);
    invoicesInScope.filter(i=>invoiceBalance(i)>0 && i.dueDate<todayISO()).forEach(i=>{
      const days = Math.floor((new Date(todayISO())-new Date(i.dueDate))/86400000);
      out.push({level: days>15?'critical':'warning', module:'sales', message:`Facture ${i.number} en retard de ${days} jour(s) — ${fmtMoney(invoiceBalance(i))} dû`, run:()=>{state.salesTab='factures'; goView('sales');}});
    });
    const soon = new Date(); soon.setDate(soon.getDate()+7);
    state.devis.filter(belongsToActiveMagasin).forEach(d=>{
      const eff = devisEffectiveStatus(d);
      if(eff==='Envoyé' && d.validUntil<=soon.toISOString().slice(0,10)) out.push({level:'warning', module:'sales', message:`Devis ${d.number} expire le ${fmtDate(d.validUntil)}`, run:()=>{state.salesTab='devis'; goView('sales');}});
      if(eff==='Expiré') out.push({level:'info', module:'sales', message:`Devis ${d.number} a expiré — à renouveler ou classer`, run:()=>{state.salesTab='devis'; goView('sales');}});
    });
    state.creditNotes.filter(belongsToActiveMagasin).filter(n=>n.status==='Émis').forEach(n=>{
      const days = Math.floor((new Date(todayISO())-new Date(n.date))/86400000);
      if(days>=14) out.push({level:'info', module:'sales', message:`Avoir ${n.number} émis depuis ${days} jours, toujours pas remboursé`, run:()=>{state.salesTab='avoirs'; goView('sales');}});
    });
  }
  if(cfg.stock && can('products')){
    lowStockPerMagasin().forEach(({product:p, magasin:m, qty})=>{
      const label = multiMagasin() ? `${p.name} — ${m.name}` : p.name;
      out.push({level: qty<=0?'critical':'warning', module:'products', message: qty<=0 ? `Rupture de stock : ${label}` : `Stock bas : ${label} (${qty} restant, seuil ${p.minStock})`, run:()=>goView('products')});
    });
  }
  if(can('purchases')){
    state.purchases.filter(belongsToActiveMagasin).filter(purchaseIsLateDelivery).forEach(p=>{
      const days = Math.floor((new Date(todayISO())-new Date(p.expectedDate))/86400000);
      out.push({level: days>7?'critical':'warning', module:'purchases', message:`Commande ${p.number||''} — ${p.supplier} : livraison attendue depuis ${days} jour(s)`, run:()=>goView('purchases')});
    });
    state.purchases.filter(belongsToActiveMagasin).filter(p=>purchaseBalance(p)>0 && p.dueDate && p.dueDate<todayISO()).forEach(p=>{
      out.push({level:'warning', module:'purchases', message:`Paiement fournisseur en retard : ${p.number||''} — ${p.supplier} (${fmtMoney(purchaseBalance(p))})`, run:()=>goView('purchases')});
    });
  }
  if(can('settings') && state.users.filter(u=>u.temporary).length){
    out.push({level:'info', module:'settings', message:`${state.users.filter(u=>u.temporary).length} accès technique(s) temporaire(s) actif(s)`, run:()=>goView('settings')});
  }
  const order = {critical:0, warning:1, info:2};
  return out.sort((a,b)=>order[a.level]-order[b.level]);
}

export function alertBellHTML(){
  const alerts = computeAlerts();
  const criticalCount = alerts.filter(a=>a.level==='critical').length;
  const warningCount = alerts.filter(a=>a.level==='warning').length;
  const total = alerts.length;
  const badgeColor = criticalCount ? 'var(--rust)' : warningCount ? 'var(--brass)' : null;
  return `
    <div style="position:relative;">
      <button class="icon-btn" style="position:relative;" id="alert-bell-btn" title="Alertes">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
        ${total ? `<span style="position:absolute;top:-3px;right:-3px;background:${badgeColor};color:#fff;font-size:.62rem;font-weight:700;border-radius:10px;min-width:16px;height:16px;display:flex;align-items:center;justify-content:center;padding:0 3px;">${total}</span>` : ''}
      </button>
      <div id="alert-panel" class="hidden" style="position:absolute;top:calc(100% + 8px);right:0;width:340px;max-height:420px;overflow-y:auto;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.18);z-index:150;">
        <div style="padding:12px 16px;border-bottom:1px solid var(--line);font-weight:600;font-size:.85rem;">Alertes${total?` (${total})`:''}</div>
        ${alerts.length ? alerts.map((a,idx)=>`
          <button data-alert-idx="${idx}" style="display:flex;gap:9px;align-items:flex-start;width:100%;text-align:left;padding:11px 16px;border:none;background:none;border-bottom:1px solid var(--line);cursor:pointer;font-family:inherit;">
            <span style="width:8px;height:8px;border-radius:50%;margin-top:5px;flex:none;background:${a.level==='critical'?'var(--rust)':a.level==='warning'?'var(--brass)':'var(--ink-soft)'};"></span>
            <span style="font-size:.82rem;line-height:1.4;">${esc(a.message)}</span>
          </button>`).join('')
        : `<div style="padding:24px 16px;text-align:center;font-size:.82rem;color:var(--ink-soft);">Rien à signaler — tout est sous contrôle.</div>`}
      </div>
    </div>`;
}

let __lastAlerts = [];
export function wireAlertBell(){
  const btn = document.getElementById('alert-bell-btn');
  if(!btn) return;
  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    __lastAlerts = computeAlerts();
    const panel = document.getElementById('alert-panel');
    const wasHidden = panel.classList.contains('hidden');
    document.querySelectorAll('#alert-panel').forEach(p=>p.classList.add('hidden'));
    if(wasHidden){
      panel.classList.remove('hidden');
      setTimeout(()=>document.addEventListener('click', closeAlertPanelOnce, {once:true}), 0);
    }
  });
  document.querySelectorAll('#alert-panel [data-alert-idx]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const a = __lastAlerts[Number(el.dataset.alertIdx)];
      document.getElementById('alert-panel').classList.add('hidden');
      if(a) a.run();
    });
  });
}
function closeAlertPanelOnce(){ const p=document.getElementById('alert-panel'); if(p) p.classList.add('hidden'); }
