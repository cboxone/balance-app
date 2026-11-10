/* ==========================================================
   pages/settings/TempAccess.js — accès technique temporaire
   Extrait des lignes 4568-4622 du fichier d'origine.
   ========================================================== */
import { state, currentUser, saveState } from '../../core/state.js';
import { uid, esc } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { openModal, closeModal } from '../../components/Modal.js';
import { can, obf } from '../../core/auth.js';
import { renderLayout } from '../../components/Layout.js';

export function openTempAccessModal(){
  if(!can('settings')){ showToast("Action réservée aux administrateurs"); return; }
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>Générer un accès technique</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="field"><label>Motif (optionnel)</label><input id="ta-label" placeholder="Ex : correction bug facturation"></div>
      <div class="field"><label>Durée de l'accès</label>
        <select id="ta-duration">
          <option value="4">4 heures</option>
          <option value="24" selected>24 heures</option>
          <option value="72">72 heures</option>
        </select>
      </div>
      <p style="font-size:.78rem;color:var(--ink-soft);">Un identifiant et un mot de passe seront générés automatiquement. Vous devrez les transmettre vous-même à la personne concernée — ils ne seront affichés qu'une seule fois.</p>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="generateTempAccess()">Générer</button>
    </div>
  `;
  openModal();
}

export function generateTempAccess(){
  if(!can('settings')){ showToast("Action réservée aux administrateurs"); return; }
  const label = document.getElementById('ta-label').value.trim();
  const hours = Number(document.getElementById('ta-duration').value)||24;
  const username = 'support-' + Math.random().toString(36).slice(2,6);
  const password = Math.random().toString(36).slice(2,6).toUpperCase() + Math.random().toString(36).slice(2,6);
  const expires = new Date(Date.now() + hours*3600*1000).toISOString();
  const user = {
    id:uid('usr'), name: label ? `Accès technique — ${label}` : "Accès technique temporaire",
    username, passwordObf:obf(password), role:'admin', active:true,
    temporary:true, expiresAt:expires, grantedBy:currentUser.name, grantedAt:new Date().toISOString()
  };
  state.users.push(user);
  saveState();
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>Accès généré</h3><button class="icon-btn" onclick="closeModal(); renderLayout();">✕</button></div>
    <div class="modal-body">
      <p style="font-size:.85rem;">Transmettez ces identifiants à la personne concernée. Ils ne seront plus affichés ensuite.</p>
      <div class="field"><label>Identifiant</label><input value="${esc(username)}" readonly onclick="this.select()"></div>
      <div class="field"><label>Mot de passe</label><input value="${esc(password)}" readonly onclick="this.select()"></div>
      <p style="font-size:.78rem;color:var(--ink-soft);">Expire le ${new Date(expires).toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}. Vous pouvez révoquer cet accès à tout moment depuis Paramètres.</p>
    </div>
    <div class="modal-foot">
      <button class="btn btn-primary" onclick="closeModal(); renderLayout();">Terminé</button>
    </div>
  `;
}

export function revokeTempAccess(id){
  if(!can('settings')){ showToast("Action réservée aux administrateurs"); return; }
  if(!confirm("Révoquer cet accès technique immédiatement ?")) return;
  state.users = state.users.filter(u=>u.id!==id);
  saveState(); renderLayout(); showToast("Accès révoqué");
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { openTempAccessModal, generateTempAccess, revokeTempAccess });
