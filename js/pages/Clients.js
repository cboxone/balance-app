/* ==========================================================
   pages/Clients.js — module Clients / Partenaires
   Extrait des lignes 1333-1334 et 1386-1499 du fichier d'origine.

   PATTERN DE MIGRATION (voir MIGRATION.md) : ce module garde ses
   templates HTML strictement identiques à l'original, y compris les
   attributs onclick="...". Réécrire chaque onclick en addEventListener
   aurait obligé à toucher des dizaines de gabarits HTML dans toute
   l'app pour un simple découpage de fichiers — hors périmètre demandé
   ("ne pas modifier la logique métier sans raison"). À la place,
   chaque fonction appelée depuis un onclick="" est explicitement
   exposée sur window en bas de fichier. C'est le même mécanisme que
   l'app d'origine (fonctions globales), simplement réparti par module.

   NOTE : invoiceTotal/invoiceBalance/statusBadge et devisTotal/
   devisStatusBadge viennent des futures pages/sales/Invoices.js et
   pages/sales/Devis.js (pas encore migrées dans cette passe).
   ========================================================== */
import { state, sectorCfg, currentUser, saveState } from '../core/state.js';
import { uid, todayISO, fmtMoney, fmtDate, esc } from '../core/utils.js';
import { showToast } from '../components/Toast.js';
import { openModal, closeModal } from '../components/Modal.js';
import { logAudit, diffFields } from '../core/audit.js';
import { guardDelete } from '../core/auth.js';
import { downloadCSV } from '../core/utils.js';
import { renderLayout } from '../components/Layout.js';

import { invoiceTotal, invoiceBalance, statusBadge } from './sales/Invoices.js';
import { devisTotal, devisStatusBadge } from './sales/Devis.js';

export function clientName(id){ const c=state.clients.find(c=>c.id===id); return c?c.name:"—"; }

export function exportClientsCSV(){
  downloadCSV('clients.csv', ['Nom','Téléphone','Email','Adresse'],
    state.clients.map(c=>[c.name, c.phone||'', c.email||'', c.address||'']));
}

export function renderClients(){
  const cfg = sectorCfg();
  const q = window.__clientSearch || "";
  const list = state.clients.filter(c=>c.name.toLowerCase().includes(q.toLowerCase()));
  return `
    <div class="toolbar">
      <input class="search" placeholder="Rechercher un(e) ${cfg.clientNoun.toLowerCase().replace(/s$/,'')}…" value="${esc(q)}" oninput="window.__clientSearch=this.value; window.renderLayout()">
      <button class="btn btn-ghost" onclick="exportClientsCSV()">Exporter CSV</button>
      <button class="btn btn-primary" onclick="openClientModal()">+ Nouveau</button>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        ${list.length ? `<table><thead><tr><th>Nom</th><th>Téléphone</th><th>Email</th><th>Adresse</th><th></th></tr></thead><tbody>
          ${list.map(c=>`<tr>
            <td><button class="icon-btn" style="border:none;padding:0;font-weight:600;color:var(--indigo);background:none;" onclick="openClientDetail('${c.id}')">${esc(c.name)}</button></td>
            <td class="mono">${esc(c.phone)||'—'}</td>
            <td>${esc(c.email)||'—'}</td>
            <td>${esc(c.address)||'—'}</td>
            <td><div class="row-actions">
              <button class="icon-btn" onclick="openClientModal('${c.id}')" title="Modifier">✎</button>
              <button class="icon-btn" onclick="deleteClient('${c.id}')" title="Supprimer">✕</button>
            </div></td>
          </tr>`).join('')}
        </tbody></table>` : `<div class="empty"><div class="display">Aucun résultat</div>Ajoutez votre premier ${cfg.clientNoun.toLowerCase().replace(/s$/,'')}.</div>`}
      </div>
    </div>
  `;
}

export function openClientModal(id){
  const c = id ? state.clients.find(x=>x.id===id) : {name:"",phone:"",email:"",address:""};
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>${id?'Modifier':'Nouveau'} ${sectorCfg().clientNoun.toLowerCase().replace(/s$/,'')}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="field"><label>Nom</label><input id="f-name" value="${esc(c.name)}" placeholder="Nom de l'entreprise ou de la personne"></div>
      <div class="field-row">
        <div class="field"><label>Téléphone</label><input id="f-phone" value="${esc(c.phone)}" placeholder="+229 …"></div>
        <div class="field"><label>Email</label><input id="f-email" value="${esc(c.email)}" placeholder="contact@…"></div>
      </div>
      <div class="field"><label>Adresse</label><input id="f-address" value="${esc(c.address)}" placeholder="Ville, quartier"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveClient('${id||''}')">Enregistrer</button>
    </div>
  `;
  openModal();
}

export function saveClient(id){
  const name = document.getElementById('f-name').value.trim();
  if(!name){ showToast("Le nom est obligatoire"); return; }
  const data = {
    name, phone:document.getElementById('f-phone').value.trim(),
    email:document.getElementById('f-email').value.trim(),
    address:document.getElementById('f-address').value.trim()
  };
  if(id){
    const c = state.clients.find(x=>x.id===id);
    const before = {...c};
    Object.assign(c, data);
    const changes = diffFields(before, c, {name:'Nom', phone:'Téléphone', email:'Email', address:'Adresse'});
    if(changes.length) logAudit('modification','client', id, c.name, changes);
  }
  else {
    const newClient = {id:uid('cli'), createdAt:todayISO(), createdBy:currentUser.name, ...data};
    state.clients.push(newClient);
    logAudit('creation','client', newClient.id, newClient.name, []);
  }
  saveState(); closeModal(); renderLayout(); showToast("Enregistré");
}

export function openClientDetail(id){
  const c = state.clients.find(x=>x.id===id);
  if(!c) return;
  const clientInvoices = state.invoices.filter(i=>i.clientId===id).sort((a,b)=>b.date.localeCompare(a.date));
  const clientDevis = state.devis.filter(d=>d.clientId===id).sort((a,b)=>b.date.localeCompare(a.date));
  const totalFacture = clientInvoices.reduce((s,i)=>s+invoiceTotal(i),0);
  const soldeDu = clientInvoices.filter(i=>invoiceBalance(i)>0).reduce((s,i)=>s+invoiceBalance(i),0);
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>${esc(c.name)}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div style="font-size:.83rem;color:var(--ink-soft);margin-bottom:14px;line-height:1.6;">
        ${esc(c.phone)||'Pas de téléphone'} · ${esc(c.email)||'Aucun email'}<br>${esc(c.address)||'Aucune adresse'}${c.createdBy?`<br><span style="font-size:.72rem;">Ajouté par ${esc(c.createdBy)}</span>`:''}
      </div>
      <div class="grid-kpi" style="grid-template-columns:1fr 1fr;margin-bottom:18px;">
        <div class="kpi" style="box-shadow:none;"><div class="kpi-label">Total facturé</div><div class="kpi-value" style="font-size:1.1rem;">${fmtMoney(totalFacture)}</div></div>
        <div class="kpi" style="box-shadow:none;"><div class="kpi-label">Solde dû</div><div class="kpi-value" style="font-size:1.1rem;color:${soldeDu>0?'var(--rust)':'var(--sage)'};">${fmtMoney(soldeDu)}</div></div>
      </div>
      <label style="display:block;font-size:.72rem;font-weight:600;color:var(--ink-soft);margin-bottom:6px;text-transform:uppercase;">Devis</label>
      ${clientDevis.length ? clientDevis.map(d=>`<div style="display:flex;justify-content:space-between;font-size:.82rem;padding:6px 0;border-bottom:1px solid var(--line);">
        <span class="mono">${d.number}</span><span>${fmtDate(d.date)}</span><span class="mono">${fmtMoney(devisTotal(d))}</span>${devisStatusBadge(d)}
      </div>`).join('') : `<div style="font-size:.8rem;color:var(--ink-soft);padding:6px 0;">Aucun devis</div>`}
      <label style="display:block;font-size:.72rem;font-weight:600;color:var(--ink-soft);margin:16px 0 6px;text-transform:uppercase;">Factures</label>
      ${clientInvoices.length ? clientInvoices.map(i=>`<div style="display:flex;justify-content:space-between;font-size:.82rem;padding:6px 0;border-bottom:1px solid var(--line);">
        <span class="mono">${i.number}</span><span>${fmtDate(i.date)}</span><span class="mono">${fmtMoney(invoiceTotal(i))}</span>${statusBadge(i)}
      </div>`).join('') : `<div style="font-size:.8rem;color:var(--ink-soft);padding:6px 0;">Aucune facture</div>`}
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Fermer</button>
      <button class="btn btn-primary" onclick="closeModal(); openClientModal('${c.id}')">Modifier la fiche</button>
    </div>
  `;
  openModal();
}

export function clientInUse(id){
  return state.invoices.some(i=>i.clientId===id) || state.devis.some(d=>d.clientId===id) || state.creditNotes.some(n=>n.clientId===id);
}

export function deleteClient(id){
  if(!guardDelete()) return;
  if(clientInUse(id)){ showToast("Ce client a des factures, devis ou avoirs — suppression impossible pour préserver l'historique"); return; }
  if(!confirm("Supprimer cette fiche ?")) return;
  const c = state.clients.find(x=>x.id===id);
  state.clients = state.clients.filter(c=>c.id!==id);
  logAudit('suppression','client', id, c?c.name:id, []);
  saveState(); renderLayout(); showToast("Supprimé");
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir la note en tête de fichier.
Object.assign(window, { exportClientsCSV, openClientModal, saveClient, openClientDetail, deleteClient });
