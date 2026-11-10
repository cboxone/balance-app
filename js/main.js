/* ==========================================================
   main.js — point d'entrée de l'application
   Remplace renderRoot() (lignes 438-451) + le bloc d'initialisation
   de fin de fichier de l'app d'origine.

   Rôle : décide de l'écran affiché (connexion vs app), expose sur
   window les fonctions utilisées par les onclick="" des gabarits
   (voir la note dans pages/Clients.js), et démarre l'application au
   chargement de la page.

   NOTE DE MIGRATION : generateDueRecurringInvoices() vient du futur
   pages/sales/Recurring.js (pas encore migré dans cette passe).
   ========================================================== */
import { state, currentUser, loadState, saveState } from './core/state.js';
import { renderLayout } from './components/Layout.js';
import { goView, changeSector, changeActiveScope } from './router.js';
import { showToast } from './components/Toast.js';
import { openModal, closeModal } from './components/Modal.js';
import { initGlobalShortcuts } from './components/CommandPalette.js';
import { wireSearchTrigger, wireMobileNav } from './components/Navbar.js';
import { firstRunSetupHTML, loginScreenHTML } from './pages/Login.js';
import { generateDueRecurringInvoices } from './pages/sales/Recurring.js';

export async function renderRoot(){
  const authEl = document.getElementById('auth-screen');
  const appEl = document.getElementById('app');
  if(!currentUser){
    appEl.classList.add('hidden');
    authEl.classList.remove('hidden');
    authEl.innerHTML = state.users.length ? loginScreenHTML() : firstRunSetupHTML();
  } else {
    authEl.classList.add('hidden');
    appEl.classList.remove('hidden');
    generateDueRecurringInvoices();
    renderLayout();
  }
}

// Fonctions globales utilisées par les onclick="" dans les gabarits de toutes les pages.
// `state` est aussi exposé tel quel : plusieurs gabarits (onglets Ventes/Achats) font
// onclick="state.salesTab='...'; renderLayout()" directement, comme dans l'app d'origine
// où `state` était une variable globale. `state` n'est jamais réassigné en bloc (toujours
// muté par propriété), donc cette référence reste valide pour toute la durée de vie de l'app.
Object.assign(window, { state, goView, changeSector, changeActiveScope, renderLayout, renderRoot, showToast, openModal, closeModal });

async function bootstrap(){
  await loadState();
  initGlobalShortcuts();
  wireSearchTrigger();
  wireMobileNav();
  document.addEventListener('click', ()=>{
    document.querySelectorAll('#alert-panel').forEach(p=>p.classList.add('hidden'));
  });
  await renderRoot();
}

document.addEventListener('DOMContentLoaded', bootstrap);
