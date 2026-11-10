/* ==========================================================
   pages/Login.js — écran de connexion (pas de Navbar/Sidebar)
   Extrait des lignes 452-521 du fichier d'origine.
   Correspond à la contrainte #9 : cette page ne monte jamais le Layout.
   ========================================================== */
import { state, currentUser, setCurrentUser, saveState, purgeExpiredAccess } from '../core/state.js';
import { ROLES } from '../core/constants.js';
import { uid, esc } from '../core/utils.js';
import { obf, checkPassword } from '../core/auth.js';
import { renderRoot } from '../main.js';

export function firstRunSetupHTML(){
  return `
  <div class="auth-card">
    <div class="auth-brand">
      <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
        <path d="M20 4v6M8 14h24M20 10l-9 5.5h18L20 10z" stroke="#B8862E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 14l-4 9a6 6 0 0012 0l-4-9M32 14l-4 9a6 6 0 0012 0l-4-9" stroke="#B8862E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20 20v14M13 34h14" stroke="#B8862E" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span class="auth-brand-text">Balance</span>
    </div>
    <div class="auth-title">Bienvenue — créons votre compte administrateur</div>
    <p class="auth-sub">Ce compte aura accès à tous les modules et pourra créer les autres utilisateurs par la suite.</p>
    <div id="auth-error"></div>
    <div class="field"><label>Nom complet</label><input id="au-name" placeholder="Ex : Michel Agossou"></div>
    <div class="field"><label>Identifiant</label><input id="au-username" placeholder="Ex : michel"></div>
    <div class="field"><label>Mot de passe</label><input id="au-password" type="password" placeholder="••••••••"></div>
    <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:6px;" onclick="createFirstAdmin()">Créer le compte et démarrer</button>
    <div class="auth-note">Ce mot de passe reste stocké localement dans votre espace Claude, sous une forme brouillée mais non chiffrée. Il sert à distinguer les membres d'une même équipe de confiance, pas à protéger les données contre un accès malveillant.</div>
  </div>`;
}

export function createFirstAdmin(){
  const name = document.getElementById('au-name').value.trim();
  const username = document.getElementById('au-username').value.trim().toLowerCase();
  const password = document.getElementById('au-password').value;
  if(!name || !username || !password){ showAuthError("Tous les champs sont obligatoires"); return; }
  const user = {id:uid('usr'), name, username, passwordObf:obf(password), role:'admin', active:true};
  state.users.push(user);
  setCurrentUser(user);
  saveState(); renderRoot();
}

export function loginScreenHTML(){
  purgeExpiredAccess();
  const activeUsers = state.users.filter(u=>u.active);
  return `
  <div class="auth-card">
    <div class="auth-brand">
      <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
        <path d="M20 4v6M8 14h24M20 10l-9 5.5h18L20 10z" stroke="#B8862E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 14l-4 9a6 6 0 0012 0l-4-9M32 14l-4 9a6 6 0 0012 0l-4-9" stroke="#B8862E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20 20v14M13 34h14" stroke="#B8862E" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span class="auth-brand-text">Balance</span>
    </div>
    <div class="auth-title">Connexion</div>
    <p class="auth-sub">${esc(state.settings.companyName)}</p>
    <div id="auth-error"></div>
    <div class="field"><label>Utilisateur</label>
      <select id="au-user">${activeUsers.map(u=>`<option value="${u.id}">${esc(u.name)} — ${u.temporary?'Accès technique temporaire':ROLES[u.role].label}</option>`).join('')}</select>
    </div>
    <div class="field"><label>Mot de passe</label><input id="au-password" type="password" placeholder="••••••••" onkeydown="if(event.key==='Enter')login()"></div>
    <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:6px;" onclick="login()">Se connecter</button>
  </div>`;
}

export function showAuthError(msg){
  const el = document.getElementById('auth-error');
  if(el) el.innerHTML = `<div class="auth-error">${esc(msg)}</div>`;
}

export function login(){
  const userId = document.getElementById('au-user').value;
  const password = document.getElementById('au-password').value;
  const user = state.users.find(u=>u.id===userId);
  if(!user || !checkPassword(user, password)){ showAuthError("Identifiants incorrects"); return; }
  if(user.temporary && user.expiresAt && user.expiresAt < new Date().toISOString()){
    purgeExpiredAccess(); saveState();
    showAuthError("Cet accès technique a expiré"); renderRoot(); return;
  }
  setCurrentUser(user);
  renderRoot();
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { createFirstAdmin, login });
