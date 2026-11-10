/* ==========================================================
   components/Navbar.js — barre supérieure commune (titre de la page,
   déclencheur de la palette de commandes, cloche d'alertes, badge utilisateur)
   Extrait des lignes 526-539 (renderUserBadge) du fichier d'origine ;
   le HTML statique de la topbar est repris dans index.html (Layout).
   ========================================================== */
import { currentUser } from '../core/state.js';
import { ROLES } from '../core/constants.js';
import { esc } from '../core/utils.js';
import { logout } from '../core/auth.js';
import { alertBellHTML, wireAlertBell } from './AlertCenter.js';
import { openPalette } from './CommandPalette.js';

export function renderUserBadge(){
  const el = document.getElementById('user-badge');
  if(!el || !currentUser) return;
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;padding-left:10px;margin-left:4px;border-left:1px solid var(--line);">
      <div style="text-align:right;">
        <div style="font-size:.82rem;font-weight:600;">${esc(currentUser.name)}</div>
        <div class="role-pill">${ROLES[currentUser.role].label}</div>
      </div>
      <button class="icon-btn" title="Déconnexion" id="logout-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      </button>
    </div>`;
  document.getElementById('logout-btn').addEventListener('click', logout);
}

export function renderAlertBell(){
  const bellEl = document.getElementById('alert-bell');
  if(!bellEl) return;
  bellEl.innerHTML = alertBellHTML();
  wireAlertBell();
}

export function wireSearchTrigger(){
  const btn = document.getElementById('search-trigger-btn');
  if(btn) btn.addEventListener('click', openPalette);
}

/* ---------------- menu mobile (sidebar en panneau plein écran) ----------------
   Le sidebar reste le même élément DOM (voir Sidebar.js : seul son innerHTML
   change à chaque rendu) — on peut donc lui ajouter/retirer la classe "open"
   sans que ça soit écrasé par les re-rendus. */
export function openMobileNav(){
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-backdrop').classList.add('show');
}
export function closeMobileNav(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('show');
}
export function wireMobileNav(){
  const btn = document.getElementById('hamburger-btn');
  const backdrop = document.getElementById('sidebar-backdrop');
  if(btn) btn.addEventListener('click', openMobileNav);
  if(backdrop) backdrop.addEventListener('click', closeMobileNav);
}
