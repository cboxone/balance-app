/* ==========================================================
   core/auth.js — rôles, permissions, connexion/déconnexion
   AVERTISSEMENT (repris du fichier d'origine) : ceci est une séparation
   d'usage côté client, PAS une vraie barrière de sécurité.
   Extrait des lignes 430-436 et 522-525 du fichier d'origine.
   (Le rendu des écrans de connexion vit dans pages/Login.js.)
   ========================================================== */
import { currentUser, setCurrentUser } from './state.js';
import { ROLES } from './constants.js';
import { showToast } from '../components/Toast.js';
import { renderRoot } from '../main.js';

export function obf(pw){ try{ return btoa(unescape(encodeURIComponent(pw||""))).split('').reverse().join(''); }catch(e){ return pw; } }
export function checkPassword(user, pw){ return user.passwordObf === obf(pw); }
export function role(){ return currentUser ? ROLES[currentUser.role] : null; }
export function can(view){ const r = role(); return r ? r.views.includes(view) : false; }
export function canDelete(){ const r = role(); return r ? r.canDelete : false; }
export function guardDelete(){ if(!canDelete()){ showToast("Action réservée aux administrateurs et gérants"); return false; } return true; }
export function userInUse(){ return false; } // placeholder for future audit-trail integrity checks

export function logout(){
  setCurrentUser(null);
  renderRoot();
}
