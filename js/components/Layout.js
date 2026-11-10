/* ==========================================================
   components/Layout.js — assemble Sidebar + Navbar + zone de contenu
   pour toutes les pages authentifiées.
   Remplace renderAll() (lignes 1127-1147 du fichier d'origine) :
   même logique, mais la sidebar/navbar/contenu sont maintenant
   rendus par des composants séparés et importés.
   ========================================================== */
import { state, sectorCfg } from '../core/state.js';
import { can } from '../core/auth.js';
import { renderSidebar } from './Sidebar.js';
import { renderUserBadge, renderAlertBell } from './Navbar.js';
import { getRoute, VIEW_TITLES } from '../router.js';

export function renderLayout(){
  if(!can(state.view)) state.view = 'dashboard';
  renderSidebar();
  renderUserBadge();
  renderAlertBell();

  const cfg = sectorCfg();
  let title = VIEW_TITLES[state.view];
  if(state.view==='clients') title = cfg.clientNoun;
  if(state.view==='products') title = cfg.products + (cfg.stock ? " & stock" : "");
  document.getElementById('topbar-title').textContent = title;

  const content = document.getElementById('content');
  const route = getRoute(state.view);
  content.innerHTML = route ? route.render() : '';
  if(route && route.afterRender) route.afterRender();
}
