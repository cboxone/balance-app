/* ==========================================================
   components/Sidebar.js — navigation latérale commune à toutes
   les pages authentifiées (liste des modules visibles selon le
   rôle, sélecteur de site actif).
   Adapté des lignes 1061-1114 du fichier d'origine — la logique de
   permissions et de rendu est inchangée ; seule l'invocation de
   navigation passe maintenant par router.js (goView) au lieu d'un
   attribut onclick="" global.
   ========================================================== */
import { state, sectorCfg, saveState } from '../core/state.js';
import { ICONS } from '../core/constants.js';
import { can } from '../core/auth.js';
import { multiMagasin } from '../core/sites.js';
import { esc } from '../core/utils.js';
import { goView } from '../router.js';
import { renderLayout } from './Layout.js';
import { closeMobileNav } from './Navbar.js';

export function renderSidebar(){
  const cfg = sectorCfg();
  const groups = [
    { items: [['dashboard','Tableau de bord']] },
    { label:'Ventes & clients', items: [
      ['clients', cfg.clientNoun],
      ['products', cfg.products + (cfg.stock ? " & stock" : "")],
      ...(cfg.stock ? [['stockcard','Fiche de Stock']] : []),
      ['sales','Devis, factures & avoirs'],
    ]},
    { label:'Achats', items: [
      ['suppliers','Fournisseurs'],
      ['purchases','Achats'],
    ]},
    { label:'Finance', items: [
      ['treasury','Trésorerie'],
      ['accounting','Comptabilité'],
      ['reports','Rapports'],
    ]},
    { label:'Système', items: [
      ['auditlog',"Journal d'audit"],
      ['settings','Paramètres'],
      ['users','Utilisateurs'],
    ]},
  ].map(g => ({...g, items: g.items.filter(([k])=>can(k))})).filter(g => g.items.length);

  const scopeOptions = `<option value="all" ${state.activeScope==='all'?'selected':''}>Tous les magasins</option>` +
    state.magasins.map(m=>`<option value="${m.id}" ${state.activeScope===m.id?'selected':''}>${esc(m.name)}</option>`).join('');

  document.getElementById('sidebar').innerHTML = `
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 40 40" fill="none">
        <path d="M20 4v6M8 14h24M20 10l-9 5.5h18L20 10z" stroke="#D9A84E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 14l-4 9a6 6 0 0012 0l-4-9M32 14l-4 9a6 6 0 0012 0l-4-9" stroke="#D9A84E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20 20v14M13 34h14" stroke="#D9A84E" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <div>
        <div class="brand-text">Balance</div>
        <div class="brand-sub">gestion commerciale</div>
      </div>
    </div>
    ${groups.map(g => `
      <div class="nav-group">
        ${g.label ? `<div class="nav-group-label">${g.label}</div>` : ''}
        ${g.items.map(([k,label])=>`
          <button class="nav-item ${state.view===k?'active':''}" data-nav="${k}">
            ${ICONS[k]}<span>${label}</span>
          </button>`).join('')}
      </div>`).join('')}
    <div class="nav-spacer"></div>
    <div class="sector-box">
      <label>${esc(state.site.name)} — ${multiMagasin() ? 'portée active' : 'magasin'}</label>
      <select id="active-scope-select">${scopeOptions}</select>
    </div>
    <div class="kbd-hint">Ouvrir la palette : <kbd>Ctrl</kbd>+<kbd>K</kbd></div>
  `;

  document.querySelectorAll('#sidebar [data-nav]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ goView(btn.dataset.nav); closeMobileNav(); });
  });
  document.getElementById('active-scope-select').addEventListener('change', function(){
    state.activeScope = this.value; saveState(); renderLayout();
  });
}
