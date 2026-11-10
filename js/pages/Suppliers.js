/* ==========================================================
   pages/Suppliers.js — module Fournisseurs
   Extrait des lignes 2609-2714 du fichier d'origine.
   Même pattern de migration que pages/Clients.js (voir sa note d'en-tête) :
   templates HTML inchangés, fonctions exposées sur window pour les onclick="".
   ========================================================== */
import { state, currentUser, saveState } from '../core/state.js';
import { uid, todayISO, fmtMoney, fmtDate, esc } from '../core/utils.js';
import { showToast } from '../components/Toast.js';
import { openModal, closeModal } from '../components/Modal.js';
import { logAudit, diffFields } from '../core/audit.js';
import { guardDelete } from '../core/auth.js';
import { renderLayout } from '../components/Layout.js';

export function supplierName(id){ const s=state.suppliers.find(x=>x.id===id); return s?s.name:"—"; }
export function supplierInUse(id){ return state.purchases.some(p=>p.supplierId===id); }

export function renderSuppliers(){
  const q = window.__supplierSearch || "";
  const list = state.suppliers.filter(s=>s.name.toLowerCase().includes(q.toLowerCase()));
  return `
    <div class="toolbar">
      <input class="search" placeholder="Rechercher un fournisseur…" value="${esc(q)}" oninput="window.__supplierSearch=this.value; window.renderLayout()">
      <button class="btn btn-primary" onclick="openSupplierModal()">+ Nouveau</button>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        ${list.length ? `<table><thead><tr><th>Nom</th><th>Téléphone</th><th>Email</th><th>Adresse</th><th></th></tr></thead><tbody>
          ${list.map(s=>`<tr>
            <td><button class="icon-btn" style="border:none;padding:0;font-weight:600;color:var(--indigo);background:none;" onclick="openSupplierDetail('${s.id}')">${esc(s.name)}</button></td>
            <td class="mono">${esc(s.phone)||'—'}</td>
            <td>${esc(s.email)||'—'}</td>
            <td>${esc(s.address)||'—'}</td>
            <td><div class="row-actions">
              <button class="icon-btn" onclick="openSupplierModal('${s.id}')" title="Modifier">✎</button>
              <button class="icon-btn" onclick="deleteSupplier('${s.id}')" title="Supprimer">✕</button>
            </div></td>
          </tr>`).join('')}
        </tbody></table>` : `<div class="empty"><div class="display">Aucun fournisseur</div>Ajoutez vos fournisseurs pour les retrouver rapidement lors des achats.</div>`}
      </div>
    </div>
  `;
}

export function openSupplierModal(id, onCreated){
  const s = id ? state.suppliers.find(x=>x.id===id) : {name:"",phone:"",email:"",address:""};
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>${id?'Modifier':'Nouveau'} fournisseur</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="field"><label>Nom</label><input id="f-name" value="${esc(s.name)}" placeholder="Nom du fournisseur"></div>
      <div class="field-row">
        <div class="field"><label>Téléphone</label><input id="f-phone" value="${esc(s.phone)}" placeholder="+229 …"></div>
        <div class="field"><label>Email</label><input id="f-email" value="${esc(s.email)}"></div>
      </div>
      <div class="field"><label>Adresse</label><input id="f-address" value="${esc(s.address)}"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveSupplier('${id||''}', ${onCreated?'true':'false'})">Enregistrer</button>
    </div>
  `;
  window.__supplierOnCreated = onCreated;
  openModal();
}

export function saveSupplier(id, chained){
  const name = document.getElementById('f-name').value.trim();
  if(!name){ showToast("Le nom est obligatoire"); return; }
  const data = {
    name, phone:document.getElementById('f-phone').value.trim(),
    email:document.getElementById('f-email').value.trim(),
    address:document.getElementById('f-address').value.trim()
  };
  let supplier;
  if(id){
    supplier = state.suppliers.find(x=>x.id===id);
    const before = {...supplier};
    Object.assign(supplier, data);
    const changes = diffFields(before, supplier, {name:'Nom', phone:'Téléphone', email:'Email', address:'Adresse'});
    if(changes.length) logAudit('modification','fournisseur', id, supplier.name, changes);
  }
  else {
    supplier = {id:uid('sup'), createdAt:todayISO(), createdBy:currentUser.name, ...data};
    state.suppliers.push(supplier);
    logAudit('creation','fournisseur', supplier.id, supplier.name, []);
  }
  saveState(); closeModal(); renderLayout(); showToast("Enregistré");
  if(chained && window.__supplierOnCreated) window.__supplierOnCreated(supplier.id);
}

export function deleteSupplier(id){
  if(!guardDelete()) return;
  if(supplierInUse(id)){ showToast("Ce fournisseur a des achats enregistrés — suppression impossible"); return; }
  if(!confirm("Supprimer ce fournisseur ?")) return;
  const s = state.suppliers.find(x=>x.id===id);
  state.suppliers = state.suppliers.filter(s=>s.id!==id);
  logAudit('suppression','fournisseur', id, s?s.name:id, []);
  saveState(); renderLayout(); showToast("Supprimé");
}

export function openSupplierDetail(id){
  const s = state.suppliers.find(x=>x.id===id);
  if(!s) return;
  const purchases = state.purchases.filter(p=>p.supplierId===id).sort((a,b)=>b.date.localeCompare(a.date));
  const total = purchases.reduce((sum,p)=>sum+p.items.reduce((x,it)=>x+it.qty*it.cost,0),0);
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>${esc(s.name)}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div style="font-size:.83rem;color:var(--ink-soft);margin-bottom:14px;line-height:1.6;">
        ${esc(s.phone)||'Pas de téléphone'} · ${esc(s.email)||'Aucun email'}<br>${esc(s.address)||'Aucune adresse'}
      </div>
      <div class="kpi" style="box-shadow:none;margin-bottom:14px;"><div class="kpi-label">Total acheté</div><div class="kpi-value" style="font-size:1.1rem;">${fmtMoney(total)}</div></div>
      <label style="display:block;font-size:.72rem;font-weight:600;color:var(--ink-soft);margin-bottom:6px;text-transform:uppercase;">Historique des achats</label>
      ${purchases.length ? purchases.map(p=>`<div style="display:flex;justify-content:space-between;font-size:.82rem;padding:6px 0;border-bottom:1px solid var(--line);">
        <span class="mono">${p.number||'—'}</span><span>${fmtDate(p.date)}</span><span class="mono">${fmtMoney(p.items.reduce((s2,it)=>s2+it.qty*it.cost,0))}</span><span class="badge ${p.status==='Reçue'?'badge-good':'badge-brass'}">${p.status}</span>
      </div>`).join('') : `<div style="font-size:.8rem;color:var(--ink-soft);padding:6px 0;">Aucun achat</div>`}
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Fermer</button>
      <button class="btn btn-primary" onclick="closeModal(); openSupplierModal('${s.id}')">Modifier</button>
    </div>
  `;
  openModal();
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { openSupplierModal, saveSupplier, deleteSupplier, openSupplierDetail });
