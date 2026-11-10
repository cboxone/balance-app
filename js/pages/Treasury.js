/* ==========================================================
   pages/Treasury.js — module Trésorerie
   Extrait des lignes 3143-3256 du fichier d'origine.
   Même pattern de migration que pages/Clients.js (voir sa note d'en-tête).
   ========================================================== */
import { state, saveState } from '../core/state.js';
import { uid, todayISO, fmtMoney, fmtDate, esc } from '../core/utils.js';
import { showToast } from '../components/Toast.js';
import { openModal, closeModal } from '../components/Modal.js';
import { guardDelete } from '../core/auth.js';
import { renderLayout } from '../components/Layout.js';
import { TREASURY_CATEGORIES, CATEGORY_TO_ACCOUNT } from '../core/constants.js';
import {
  belongsToActiveMagasin, multiMagasin, magasinName, currentMagasinFilter, magasinSelectOptions
} from '../core/sites.js';
import {
  accountShort, blockIfLocked, pushJournalEntry, removeGeneratedEntries, treasuryAccountForMethod
} from '../core/accounting-engine.js';

export function categoryLabel(type, cat){
  const list = TREASURY_CATEGORIES[type]||[];
  const found = list.find(([k])=>k===cat);
  return found ? found[1] : (type==='in'?'Autre entrée':'Autre dépense');
}

export function renderTreasury(){
  const q = (window.__treasurySearch||"").toLowerCase();
  const scoped = state.treasury.filter(belongsToActiveMagasin);
  const list = scoped.filter(t=>!q || t.label.toLowerCase().includes(q)).sort((a,b)=>b.date.localeCompare(a.date));
  const balance = scoped.reduce((s,t)=>s+(t.type==='in'?t.amount:-t.amount),0);
  const byCat = {};
  scoped.filter(t=>t.type==='out').forEach(t=>{ const c=t.category||'autre'; byCat[c]=(byCat[c]||0)+t.amount; });
  const catEntries = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const maxCat = Math.max(1,...catEntries.map(c=>c[1]));
  return `
    <div class="grid-kpi" style="grid-template-columns:repeat(3,1fr);">
      <div class="kpi"><div class="kpi-label">Solde actuel</div><div class="kpi-value">${fmtMoney(balance)}</div></div>
      <div class="kpi"><div class="kpi-label">Total entrées</div><div class="kpi-value" style="color:var(--sage);">${fmtMoney(scoped.filter(t=>t.type==='in').reduce((s,t)=>s+t.amount,0))}</div></div>
      <div class="kpi"><div class="kpi-label">Total sorties</div><div class="kpi-value" style="color:var(--rust);">${fmtMoney(scoped.filter(t=>t.type==='out').reduce((s,t)=>s+t.amount,0))}</div></div>
    </div>
    ${catEntries.length ? `<div class="panel" style="margin-bottom:16px;">
      <div class="panel-head"><h3>Répartition des dépenses par catégorie</h3></div>
      <div class="panel-body">
        ${catEntries.map(([cat,amt])=>`
          <div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:4px;">
              <span>${esc(categoryLabel('out',cat))}</span><span class="mono">${fmtMoney(amt)}</span>
            </div>
            <div class="stockbar" style="width:100%;height:7px;"><div style="width:${amt/maxCat*100}%;background:var(--rust);"></div></div>
          </div>`).join('')}
      </div>
    </div>` : ''}
    <div class="toolbar">
      <input class="search" placeholder="Rechercher un libellé…" value="${esc(window.__treasurySearch||'')}" oninput="window.__treasurySearch=this.value; window.renderLayout()">
      <button class="btn btn-primary" onclick="openTreasuryModal()">+ Mouvement</button>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        ${list.length ? `<table><thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th>${multiMagasin()?'<th>Magasin</th>':''}<th>Type</th><th class="tright">Montant</th><th></th></tr></thead><tbody>
          ${list.map(t=>`<tr>
            <td>${fmtDate(t.date)}</td>
            <td>${esc(t.label)}</td>
            <td><span class="badge badge-neutral">${esc(categoryLabel(t.type, t.category))}</span></td>
            ${multiMagasin()?`<td>${t.magasinId?esc(magasinName(t.magasinId)):'Siège (non affecté)'}</td>`:''}
            <td><span class="badge ${t.type==='in'?'badge-good':'badge-warn'}">${t.type==='in'?'Entrée':'Sortie'}</span></td>
            <td class="tright mono">${t.type==='in'?'+':'-'}${fmtMoney(t.amount)}</td>
            <td><div class="row-actions">${t.generatedFrom ? `<button class="icon-btn" disabled title="Écriture liée à un document — supprimez ou annulez le document source" style="opacity:.35;cursor:not-allowed;">✕</button>` : `<button class="icon-btn" onclick="deleteTreasury('${t.id}')">✕</button>`}</div></td>
          </tr>`).join('')}
        </tbody></table>` : `<div class="empty"><div class="display">Aucun mouvement</div>Ajoutez vos entrées et sorties de caisse.</div>`}
      </div>
    </div>
  `;
}

export function treasuryCategoryOptions(type, selected){
  return (TREASURY_CATEGORIES[type]||[]).map(([k,l])=>`<option value="${k}" ${k===selected?'selected':''}>${l}</option>`).join('');
}

export function updateTreasuryCategoryOptions(){
  const type = document.getElementById('f-type').value;
  document.getElementById('f-category').innerHTML = treasuryCategoryOptions(type);
}

export function openTreasuryModal(){
  const defaultMagasinId = currentMagasinFilter() || "";
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>Nouveau mouvement</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="field"><label>Libellé</label><input id="f-label" placeholder="Ex : Loyer, salaire, encaissement…"></div>
      <div class="field-row">
        <div class="field"><label>Type</label><select id="f-type" onchange="updateTreasuryCategoryOptions()"><option value="in">Entrée</option><option value="out" selected>Sortie</option></select></div>
        <div class="field"><label>Montant</label><input id="f-amount" type="number" placeholder="0"></div>
      </div>
      <div class="field"><label>Catégorie</label><select id="f-category">${treasuryCategoryOptions('out')}</select></div>
      <div class="field"><label>Moyen</label><select id="f-method"><option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option></select></div>
      ${multiMagasin() ? `<div class="field"><label>Magasin concerné</label><select id="f-magasin"><option value="">Siège (non affecté)</option>${magasinSelectOptions(defaultMagasinId)}</select></div>` : ''}
      <div class="field"><label>Date</label><input id="f-date" type="date" value="${todayISO()}"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveTreasury()">Enregistrer</button>
    </div>
  `;
  openModal();
}

export function saveTreasury(){
  const label = document.getElementById('f-label').value.trim();
  const amount = Number(document.getElementById('f-amount').value)||0;
  if(!label || amount<=0){ showToast("Renseignez un libellé et un montant valide"); return; }
  const magasinEl = document.getElementById('f-magasin');
  const magasinId = magasinEl && magasinEl.value ? magasinEl.value : null;
  const type = document.getElementById('f-type').value;
  const category = document.getElementById('f-category').value;
  const method = document.getElementById('f-method').value;
  const date = document.getElementById('f-date').value;
  if(blockIfLocked(date)) return;
  const trsId = uid('trs');
  state.treasury.push({id:trsId, date, label, type, category, method, magasinId, amount});
  const treasAcc = treasuryAccountForMethod(method);
  const chargeAcc = (CATEGORY_TO_ACCOUNT[type]||{})[category] || (type==='in'?'758':'658');
  const jLines = type==='in'
    ? [{account:treasAcc, label:accountShort(treasAcc), debit:amount, credit:0}, {account:chargeAcc, label:label, debit:0, credit:amount}]
    : [{account:chargeAcc, label:label, debit:amount, credit:0}, {account:treasAcc, label:accountShort(treasAcc), debit:0, credit:amount}];
  pushJournalEntry("OD", date, label, jLines, {type:'treasury', id:trsId});
  saveState(); closeModal(); renderLayout(); showToast("Mouvement enregistré");
}

export function deleteTreasury(id){
  if(!guardDelete()) return;
  const t = state.treasury.find(x=>x.id===id);
  if(t && blockIfLocked(t.date)) return;
  if(t && t.generatedFrom){ showToast("Cette écriture est liée à un document et ne peut pas être supprimée directement"); return; }
  if(!confirm("Supprimer ce mouvement ?")) return;
  state.treasury = state.treasury.filter(t=>t.id!==id);
  removeGeneratedEntries('treasury', id);
  saveState(); renderLayout(); showToast("Supprimé");
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { openTreasuryModal, saveTreasury, deleteTreasury, updateTreasuryCategoryOptions });
