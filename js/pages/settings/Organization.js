/* ==========================================================
   pages/settings/Organization.js — site (unique) & ses magasins
   Chaque site a sa propre base de données (pas de consolidation
   inter-sites), donc il n'y a qu'UN site à gérer ici : celui de cette
   installation. On modifie son identité, et on gère la liste de ses
   magasins (entrepôts / points de vente).
   Extrait des lignes 4906-4983 du fichier d'origine, puis fait évoluer
   vers ce modèle simplifié.
   ========================================================== */
import { state, saveState } from '../../core/state.js';
import { uid, esc } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { openModal, closeModal } from '../../components/Modal.js';
import { can } from '../../core/auth.js';
import { renderLayout } from '../../components/Layout.js';
import { magasinInUse } from '../../core/sites.js';

export function openSiteModal(){
  if(!can('settings')){ showToast("Action réservée aux administrateurs"); return; }
  const s = state.site;
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>Informations du site</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <p style="font-size:.78rem;color:var(--ink-soft);margin-top:0;">Cette base de données correspond à un seul site (une entreprise avec plusieurs sites utilise une base distincte par site).</p>
      <div class="field"><label>Nom du site</label><input id="f-name" value="${esc(s.name)}" placeholder="Ex : Site Porto-Novo"></div>
      <div class="field"><label>Adresse</label><input id="f-address" value="${esc(s.address)}" placeholder="Ville, quartier"></div>
      <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;margin-top:4px;">
        <input type="checkbox" id="f-siege" ${s.isSiege?'checked':''}> Ce site est le siège de l'entreprise
      </label>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveSite()">Enregistrer</button>
    </div>
  `;
  openModal();
}
export function saveSite(){
  if(!can('settings')){ showToast("Action réservée aux administrateurs"); return; }
  const name = document.getElementById('f-name').value.trim();
  if(!name){ showToast("Le nom est obligatoire"); return; }
  Object.assign(state.site, { name, address:document.getElementById('f-address').value.trim(), isSiege:document.getElementById('f-siege').checked });
  saveState(); closeModal(); renderLayout(); showToast("Enregistré");
}

export function openMagasinModal(id){
  if(!can('settings')){ showToast("Action réservée aux administrateurs"); return; }
  const m = id ? state.magasins.find(x=>x.id===id) : {name:"",address:""};
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>${id?'Modifier':'Nouveau'} magasin</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="field"><label>Nom du magasin</label><input id="f-name" value="${esc(m.name)}" placeholder="Ex : Boutique Fidjrossè"></div>
      <div class="field"><label>Adresse</label><input id="f-address" value="${esc(m.address)}" placeholder="Ville, quartier"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveMagasin('${id||''}')">Enregistrer</button>
    </div>
  `;
  openModal();
}
export function saveMagasin(id){
  if(!can('settings')){ showToast("Action réservée aux administrateurs"); return; }
  const name = document.getElementById('f-name').value.trim();
  if(!name){ showToast("Le nom est obligatoire"); return; }
  const data = { name, address:document.getElementById('f-address').value.trim() };
  if(id){ Object.assign(state.magasins.find(m=>m.id===id), data); }
  else { state.magasins.push({id:uid('mag'), isDefault:state.magasins.length===0, ...data}); }
  saveState(); closeModal(); renderLayout(); showToast("Enregistré");
}
export function deleteMagasin(id){
  if(!can('settings')){ showToast("Action réservée aux administrateurs"); return; }
  if(state.magasins.length===1){ showToast("Il doit rester au moins un magasin"); return; }
  if(magasinInUse(id)){ showToast("Ce magasin contient du stock ou des documents liés — impossible de le supprimer"); return; }
  if(!confirm("Supprimer ce magasin ?")) return;
  const wasDefault = state.magasins.find(m=>m.id===id)?.isDefault;
  state.magasins = state.magasins.filter(m=>m.id!==id);
  if(wasDefault && state.magasins.length) state.magasins[0].isDefault = true;
  if(state.activeScope===id) state.activeScope='all';
  saveState(); renderLayout(); showToast("Supprimé");
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { openSiteModal, saveSite, openMagasinModal, saveMagasin, deleteMagasin });
