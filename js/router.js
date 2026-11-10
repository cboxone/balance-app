/* ==========================================================
   router.js — table des routes + navigation
   Remplace la logique de lignes 1112-1125 (goView/changeSector/
   changeActiveScope/VIEW_TITLES/viewLabel) et le dispatcher de
   renderAll() (1139-1144) du fichier d'origine.

   Chaque entrée de ROUTES = { render, afterRender? }.
   render()      -> renvoie le HTML de la page (obligatoire)
   afterRender() -> câble les événements après insertion dans le DOM (optionnel)

   Migration terminée : les 13 vues sont routées vers de vrais modules.
   ========================================================== */
import { state, sectorCfg, saveState } from './core/state.js';
import { can } from './core/auth.js';
import { showToast } from './components/Toast.js';
import { renderLayout } from './components/Layout.js';

import { renderDashboard, afterRenderDashboard } from './pages/Dashboard.js';
import { renderClients } from './pages/Clients.js';
import { renderProducts } from './pages/Products.js';
import { renderSuppliers } from './pages/Suppliers.js';
import { renderTreasury } from './pages/Treasury.js';
import { renderPurchases } from './pages/Purchases.js';
import { renderStockCard } from './pages/StockCard.js';
import { renderSales } from './pages/Sales.js';
import { renderAccounting } from './pages/Accounting.js';
import { renderReports } from './pages/Reports.js';
import { renderSettings } from './pages/Settings.js';
import { renderUsers } from './pages/Users.js';
import { renderAuditLog } from './pages/AuditLog.js';

export const VIEW_TITLES = {
  dashboard:"Tableau de bord", clients:null, products:null, stockcard:"Fiche de Stock", sales:"Devis, factures & avoirs",
  suppliers:"Fournisseurs", purchases:"Achats", treasury:"Trésorerie", accounting:"Comptabilité", reports:"Rapports", auditlog:"Journal d'audit", settings:"Paramètres", users:"Utilisateurs"
};

export const ROUTES = {
  dashboard: { render: renderDashboard, afterRender: afterRenderDashboard },
  clients:   { render: renderClients },
  products:  { render: renderProducts },
  suppliers: { render: renderSuppliers },
  treasury:  { render: renderTreasury },
  purchases: { render: renderPurchases },
  stockcard: { render: renderStockCard },
  sales:     { render: renderSales },
  accounting: { render: renderAccounting },
  reports:    { render: renderReports },
  auditlog:   { render: renderAuditLog },
  settings:   { render: renderSettings },
  users:      { render: renderUsers }
};

export function getRoute(view){ return ROUTES[view]; }

export function viewLabel(v){
  const cfg = sectorCfg();
  if(v==='clients') return cfg.clientNoun;
  if(v==='products') return cfg.products + (cfg.stock ? " & stock" : "");
  return VIEW_TITLES[v] || v;
}

export function goView(v){
  if(!can(v)){ showToast("Accès non autorisé pour votre rôle"); return; }
  state.view = v;
  renderLayout();
}
export function changeSector(v){ state.sector=v; saveState(); renderLayout(); }
export function changeActiveScope(v){ state.activeScope=v; saveState(); renderLayout(); }
