/* ==========================================================
   pages/Users.js — module Utilisateurs (rôles & permissions)
   Extrait des lignes 4813-4904 du fichier d'origine.
   ========================================================== */
import { state, currentUser, setCurrentUser, saveState } from '../core/state.js';
import { uid, esc } from '../core/utils.js';
import { showToast } from '../components/Toast.js';
import { openModal, closeModal } from '../components/Modal.js';
import { can, obf } from '../core/auth.js';
import { logAudit, diffFields } from '../core/audit.js';
import { renderLayout } from '../components/Layout.js';
import { ROLES } from '../core/constants.js';
import { viewLabel } from '../router.js';

export function renderUsers(){
  return `
    <div class="toolbar"><div style="flex:1;"></div><button class="btn btn-primary" onclick="openUserModal()">+ Nouvel utilisateur</button></div>
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        <table><thead><tr><th>Nom</th><th>Identifiant</th><th>Rôle</th><th>Statut</th><th></th></tr></thead><tbody>
          ${state.users.map(u=>`<tr>
            <td><strong>${esc(u.name)}</strong>${u.id===currentUser.id?' <span class="badge badge-neutral">vous</span>':''}${u.temporary?' <span class="badge badge-brass">technique · expire '+new Date(u.expiresAt).toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})+'</span>':''}</td>
            <td class="mono">${esc(u.username)}</td>
            <td><span class="role-pill">${ROLES[u.role].label}</span></td>
            <td><span class="badge ${u.active?'badge-good':'badge-neutral'}">${u.active?'Actif':'Désactivé'}</span></td>
            <td><div class="row-actions">
              ${!u.temporary ? `<button class="icon-btn" onclick="openUserModal('${u.id}')" title="Modifier">✎</button>` : ''}
              ${u.id!==currentUser.id ? `<button class="icon-btn" onclick="deleteUser('${u.id}')" title="Supprimer">✕</button>` : ''}
            </div></td>
          </tr>`).join('')}
        </tbody></table>
      </div>
    </div>
    <div class="panel" style="margin-top:16px;">
      <div class="panel-head"><h3>Rôles &amp; permissions</h3></div>
      <div class="panel-body">
        ${Object.entries(ROLES).map(([k,r])=>`
          <div style="padding:8px 0;border-bottom:1px solid var(--line);font-size:.83rem;">
            <strong>${r.label}</strong>${r.desc?` — <span style="color:var(--ink-soft);">${esc(r.desc)}</span>`:''}<br>
            <span style="color:var(--ink-soft);font-size:.78rem;">${r.views.map(v=>viewLabel(v)).join(', ')}${r.canDelete?'':' · lecture/création seulement, pas de suppression'}</span>
          </div>`).join('')}
        <p class="auth-note" style="border-top:none;margin-top:12px;">Rappel : cette connexion sépare les usages au sein d'une même équipe de confiance (qui voit quoi, qui a créé quoi). Elle ne remplace pas une vraie sécurité serveur — toute personne ayant accès à cet espace Claude peut techniquement consulter les données.</p>
      </div>
    </div>
  `;
}

export function openUserModal(id){
  if(!can('users')){ showToast("Action réservée aux administrateurs"); return; }
  const u = id ? state.users.find(x=>x.id===id) : {name:"",username:"",role:"vendeur",active:true};
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>${id?'Modifier':'Nouvel'} utilisateur</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="field"><label>Nom complet</label><input id="f-name" value="${esc(u.name)}"></div>
      <div class="field"><label>Identifiant</label><input id="f-username" value="${esc(u.username)}" placeholder="ex : marie"></div>
      <div class="field"><label>${id?'Nouveau mot de passe (laisser vide pour ne pas changer)':'Mot de passe'}</label><input id="f-password" type="password" placeholder="••••••••"></div>
      <div class="field"><label>Rôle</label>
        <select id="f-role">${Object.entries(ROLES).map(([k,r])=>`<option value="${k}" ${u.role===k?'selected':''}>${r.label}</option>`).join('')}</select>
      </div>
      ${id ? `<label style="display:flex;align-items:center;gap:8px;font-size:.85rem;margin-top:4px;cursor:pointer;"><input type="checkbox" id="f-active" ${u.active?'checked':''} style="width:16px;height:16px;"> Compte actif</label>` : ''}
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveUser('${id||''}')">Enregistrer</button>
    </div>
  `;
  openModal();
}

export function saveUser(id){
  if(!can('users')){ showToast("Action réservée aux administrateurs"); return; }
  const name = document.getElementById('f-name').value.trim();
  const username = document.getElementById('f-username').value.trim().toLowerCase();
  const password = document.getElementById('f-password').value;
  const role = document.getElementById('f-role').value;
  if(!name || !username){ showToast("Nom et identifiant obligatoires"); return; }
  if(state.users.some(u=>u.username===username && u.id!==id)){ showToast("Cet identifiant est déjà utilisé"); return; }
  if(id){
    const u = state.users.find(x=>x.id===id);
    const before = {...u};
    Object.assign(u, {name, username, role});
    if(password) u.passwordObf = obf(password);
    const activeEl = document.getElementById('f-active');
    if(activeEl) u.active = activeEl.checked;
    if(u.id===currentUser.id) setCurrentUser(u);
    const changes = diffFields(before, u, {name:'Nom', username:'Identifiant', role:'Rôle', active:'Actif'});
    if(password) changes.push({field:'Mot de passe', from:'—', to:'modifié'});
    if(changes.length) logAudit('modification','utilisateur', id, u.name, changes);
  } else {
    if(!password){ showToast("Le mot de passe est obligatoire"); return; }
    const newUser = {id:uid('usr'), name, username, passwordObf:obf(password), role, active:true};
    state.users.push(newUser);
    logAudit('creation','utilisateur', newUser.id, newUser.name, [{field:'Rôle', from:'—', to:ROLES[role]?ROLES[role].label:role}]);
  }
  saveState(); closeModal(); renderLayout(); showToast("Enregistré");
}

export function deleteUser(id){
  if(!can('users')){ showToast("Action réservée aux administrateurs"); return; }
  if(id===currentUser.id){ showToast("Vous ne pouvez pas supprimer votre propre compte"); return; }
  const target = state.users.find(u=>u.id===id);
  const remainingAdmins = state.users.filter(u=>u.role==='admin' && u.id!==id).length;
  if(target.role==='admin' && remainingAdmins===0){ showToast("Il doit rester au moins un administrateur"); return; }
  if(!confirm("Supprimer cet utilisateur ?")) return;
  state.users = state.users.filter(u=>u.id!==id);
  logAudit('suppression','utilisateur', id, target?target.name:id, []);
  saveState(); renderLayout(); showToast("Supprimé");
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { openUserModal, saveUser, deleteUser });
