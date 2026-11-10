/* ==========================================================
   pages/accounting/Assets.js — immobilisations & amortissements
   Extrait des lignes 3843-4062 du fichier d'origine.
   ========================================================== */
import { state, saveState } from '../../core/state.js';
import { uid, todayISO, fmtMoney, fmtDate, esc } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { openModal, closeModal } from '../../components/Modal.js';
import { guardDelete } from '../../core/auth.js';
import { renderLayout } from '../../components/Layout.js';
import { ASSET_CATEGORIES } from '../../core/constants.js';
import { blockIfLocked, pushJournalEntry, accountShort } from '../../core/accounting-engine.js';

function daysBetweenISO(a,b){ return Math.round((new Date(b+'T00:00:00') - new Date(a+'T00:00:00'))/86400000); }
export function assetDepreciableBase(asset){ return Math.max(0, (Number(asset.acquisitionValue)||0) - (Number(asset.residualValue)||0)); }
export function assetFullyDepreciatedDate(asset){
  const d = new Date(asset.acquisitionDate+'T00:00:00');
  d.setFullYear(d.getFullYear() + Math.max(1, Number(asset.usefulLifeYears)||1));
  return d.toISOString().slice(0,10);
}
/* amortissement linéaire, prorata temporis au jour près, plafonné à la base amortissable
   et arrêté à la date de cession si le bien est sorti avant la fin de sa durée d'utilité. */
export function assetTheoreticalCumulative(asset, asOfDate){
  const base = assetDepreciableBase(asset);
  if(base<=0 || !asset.acquisitionDate) return 0;
  let end = asOfDate;
  if(asset.disposalDate && asset.disposalDate<end) end = asset.disposalDate;
  if(end < asset.acquisitionDate) return 0;
  const fullEnd = assetFullyDepreciatedDate(asset);
  const cappedEnd = end < fullEnd ? end : fullEnd;
  const totalSpan = daysBetweenISO(asset.acquisitionDate, fullEnd) || 1;
  const elapsed = Math.max(0, daysBetweenISO(asset.acquisitionDate, cappedEnd));
  return Math.min(base, Math.max(0, Math.round(base * (elapsed/totalSpan))));
}
export function assetDepreciationEntries(assetId){
  return state.journalEntries.filter(e=>e.generatedFrom && e.generatedFrom.type==='asset-depreciation' && e.generatedFrom.assetId===assetId);
}
export function assetRecordedDepreciation(assetId){
  return assetDepreciationEntries(assetId).reduce((s,e)=> s + e.lines.filter(l=>l.account==='681').reduce((s2,l)=>s2+(l.debit||0),0), 0);
}
export function removeAssetEntries(assetId){
  state.journalEntries = state.journalEntries.filter(e=>!(e.generatedFrom && (
    (e.generatedFrom.type==='asset-acquisition' && e.generatedFrom.id===assetId) ||
    (e.generatedFrom.type==='asset-disposal' && e.generatedFrom.id===assetId) ||
    (e.generatedFrom.type==='asset-depreciation' && e.generatedFrom.assetId===assetId)
  )));
}
export function assetCategory(asset){ return ASSET_CATEGORIES[asset.category] || ASSET_CATEGORIES.autre; }
export function generateAssetDepreciationEntry(asset, dateStr){
  const theoretical = assetTheoreticalCumulative(asset, dateStr);
  const recorded = assetRecordedDepreciation(asset.id);
  const delta = Math.round(theoretical - recorded);
  if(delta<=0.5) return 0;
  const cat = assetCategory(asset);
  pushJournalEntry("OD", dateStr, "Dotation aux amortissements — "+asset.name, [
    {account:"681", label:"Dotation — "+asset.name, debit:delta, credit:0},
    {account:cat.amortAccount, label:"Amortissement — "+asset.name, debit:0, credit:delta}
  ], {type:'asset-depreciation', id:uid('dep'), assetId:asset.id, upTo:dateStr});
  return delta;
}
export function generateDepreciationUpTo(dateStr){
  if(!dateStr){ showToast("Choisissez une date"); return; }
  if(blockIfLocked(dateStr)) return;
  let count=0, total=0;
  state.assets.filter(a=>a.status==='actif' || !a.status).forEach(a=>{
    const delta = generateAssetDepreciationEntry(a, dateStr);
    if(delta>0){ count++; total+=delta; }
  });
  saveState(); renderLayout();
  showToast(count ? `${count} dotation(s) enregistrée(s) pour ${fmtMoney(total)}` : "Amortissements déjà à jour à cette date");
}

export function renderAssetsTab(){
  const assets = [...state.assets].sort((a,b)=>(a.acquisitionDate||'').localeCompare(b.acquisitionDate||''));
  const active = assets.filter(a=>a.status==='actif' || !a.status);
  const grossTotal = active.reduce((s,a)=>s+(Number(a.acquisitionValue)||0),0);
  const depTotal = active.reduce((s,a)=>s+assetRecordedDepreciation(a.id),0);
  const vncTotal = grossTotal - depTotal;
  return `
    <div class="grid-kpi" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px;">
      <div class="kpi"><div class="kpi-label">Valeur brute (actif)</div><div class="kpi-value">${fmtMoney(grossTotal)}</div></div>
      <div class="kpi"><div class="kpi-label">Amortissements cumulés</div><div class="kpi-value" style="color:var(--rust);">${fmtMoney(depTotal)}</div></div>
      <div class="kpi"><div class="kpi-label">Valeur nette comptable</div><div class="kpi-value" style="color:var(--sage);">${fmtMoney(vncTotal)}</div></div>
    </div>
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-head"><h3>Générer les dotations aux amortissements</h3></div>
      <div class="panel-body" style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;">
        <div class="field" style="max-width:220px;margin:0;"><label>Jusqu'au</label><input id="dep-date" type="date" value="${todayISO()}"></div>
        <button class="btn btn-primary" onclick="generateDepreciationUpTo(document.getElementById('dep-date').value)">Générer les écritures manquantes</button>
        <p style="font-size:.78rem;color:var(--ink-soft);margin:6px 0 0;flex-basis:100%;">Calcule pour chaque immobilisation active l'amortissement linéaire prorata temporis dû jusqu'à cette date, et n'enregistre que la part pas encore comptabilisée (compte 681, une écriture par immobilisation).</p>
      </div>
    </div>
    <div class="toolbar"><div style="flex:1;"></div><button class="btn btn-primary" onclick="openAssetModal()">+ Immobilisation</button></div>
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        ${assets.length ? `<table><thead><tr><th>Désignation</th><th>Catégorie</th><th>Acquisition</th><th class="tright">Valeur brute</th><th class="tright">Amorti</th><th class="tright">VNC</th><th>Statut</th><th></th></tr></thead><tbody>
          ${assets.map(a=>{
            const cat = assetCategory(a);
            const rec = assetRecordedDepreciation(a.id);
            const vnc = Math.max(0,(Number(a.acquisitionValue)||0)-rec);
            const isActive = a.status==='actif' || !a.status;
            return `<tr>
              <td>${esc(a.name)}</td>
              <td>${esc(cat.label)}</td>
              <td>${fmtDate(a.acquisitionDate)}</td>
              <td class="tright mono">${fmtMoney(a.acquisitionValue)}</td>
              <td class="tright mono">${fmtMoney(rec)}</td>
              <td class="tright mono">${fmtMoney(vnc)}</td>
              <td><span class="badge ${isActive?'badge-good':'badge-neutral'}">${isActive?'Actif':(a.status==='cede'?'Cédé':'Réformé')}</span></td>
              <td><div class="row-actions">
                ${isActive?`<button class="icon-btn" title="Modifier" onclick="openAssetModal('${a.id}')">✎</button><button class="icon-btn" title="Céder / réformer" onclick="openDisposeAssetModal('${a.id}')">⇥</button>`:''}
                <button class="icon-btn" title="Supprimer" onclick="deleteAsset('${a.id}')">✕</button>
              </div></td>
            </tr>`;
          }).join('')}
        </tbody></table>` : `<div class="empty"><div class="display">Aucune immobilisation</div>Ajoutez votre matériel, mobilier ou véhicules pour suivre leur amortissement.</div>`}
      </div>
    </div>
    <p style="font-size:.76rem;color:var(--ink-soft);margin-top:14px;">Amortissement linéaire, prorata temporis au jour près, sans prise en compte des composants ni des provisions pour dépréciation. À faire valider par un expert-comptable avant tout usage officiel.</p>
  `;
}

export function openAssetModal(id){
  const a = id ? state.assets.find(x=>x.id===id) : {name:"", category:"bureau_info", acquisitionDate:todayISO(), acquisitionValue:0, residualValue:0, usefulLifeYears:5, notes:""};
  if(id && !a) return;
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>${id?'Modifier':'Nouvelle'} immobilisation</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="field"><label>Désignation</label><input id="f-name" value="${esc(a.name)}" placeholder="Ex : Ordinateur portable, Camionnette…"></div>
      <div class="field-row">
        <div class="field"><label>Catégorie</label><select id="f-category">${Object.entries(ASSET_CATEGORIES).map(([k,v])=>`<option value="${k}" ${k===a.category?'selected':''}>${v.label}</option>`).join('')}</select></div>
        <div class="field"><label>Date d'acquisition</label><input id="f-date" type="date" value="${a.acquisitionDate}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Valeur d'acquisition</label><input id="f-value" type="number" min="0" value="${a.acquisitionValue}"></div>
        <div class="field"><label>Valeur résiduelle (optionnel)</label><input id="f-residual" type="number" min="0" value="${a.residualValue||0}"></div>
      </div>
      <div class="field"><label>Durée d'amortissement (années)</label><input id="f-life" type="number" min="1" step="1" value="${a.usefulLifeYears||5}"></div>
      ${!id ? `
      <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;margin:10px 0 4px;cursor:pointer;">
        <input type="checkbox" id="f-record-acq" checked style="width:16px;height:16px;" onchange="document.getElementById('f-funding-field').style.display=this.checked?'':'none';">
        Enregistrer l'écriture comptable d'acquisition
      </label>
      <div class="field" id="f-funding-field"><label>Financée par</label><select id="f-funding"><option value="512">Banque</option><option value="571">Caisse</option><option value="5711">Mobile Money</option><option value="401">Fournisseur (à crédit)</option></select></div>
      ` : `<p style="font-size:.78rem;color:var(--ink-soft);">L'écriture d'acquisition initiale n'est pas modifiée automatiquement ; ajustez-la au besoin depuis le journal.</p>`}
      <div class="field"><label>Notes (optionnel)</label><input id="f-notes" value="${esc(a.notes||'')}"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveAsset('${id||''}')">Enregistrer</button>
    </div>
  `;
  openModal();
}

export function saveAsset(id){
  const name = document.getElementById('f-name').value.trim();
  const value = Number(document.getElementById('f-value').value)||0;
  const date = document.getElementById('f-date').value || todayISO();
  if(!name){ showToast("La désignation est obligatoire"); return; }
  if(value<=0){ showToast("Renseignez une valeur d'acquisition"); return; }
  if(blockIfLocked(date)) return;
  const category = document.getElementById('f-category').value;
  const residual = Number(document.getElementById('f-residual').value)||0;
  const life = Math.max(1, Number(document.getElementById('f-life').value)||5);
  const notes = document.getElementById('f-notes').value.trim();
  const data = {name, category, acquisitionDate:date, acquisitionValue:value, residualValue:residual, usefulLifeYears:life, notes};
  if(id){
    Object.assign(state.assets.find(a=>a.id===id), data);
  } else {
    const assetId = uid('imb');
    state.assets.push({id:assetId, status:'actif', ...data});
    const recordAcq = document.getElementById('f-record-acq') ? document.getElementById('f-record-acq').checked : false;
    if(recordAcq){
      const funding = document.getElementById('f-funding').value;
      const cat = ASSET_CATEGORIES[category];
      pushJournalEntry("OD", date, "Acquisition — "+name, [
        {account:cat.account, label:name, debit:value, credit:0},
        {account:funding, label:accountShort(funding), debit:0, credit:value}
      ], {type:'asset-acquisition', id:assetId});
    }
  }
  saveState(); closeModal(); renderLayout(); showToast("Enregistré");
}

export function deleteAsset(id){
  if(!guardDelete()) return;
  const a = state.assets.find(x=>x.id===id);
  if(!a) return;
  if(!confirm("Supprimer cette immobilisation et toutes ses écritures comptables liées (acquisition, dotations, cession) ?")) return;
  removeAssetEntries(id);
  state.assets = state.assets.filter(x=>x.id!==id);
  saveState(); renderLayout(); showToast("Supprimé");
}

export function openDisposeAssetModal(id){
  const a = state.assets.find(x=>x.id===id);
  if(!a) return;
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>Céder / réformer — ${esc(a.name)}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <p style="font-size:.82rem;color:var(--ink-soft);margin-top:0;">Les dotations aux amortissements manquantes seront complétées automatiquement jusqu'à cette date avant de sortir le bien du patrimoine.</p>
      <div class="field"><label>Date de sortie</label><input id="f-date" type="date" value="${todayISO()}"></div>
      <div class="field"><label>Valeur de cession (0 si mise au rebut)</label><input id="f-price" type="number" min="0" value="0" onchange="document.getElementById('f-recv-field').style.display=(Number(this.value)>0?'':'none');"></div>
      <div class="field" id="f-recv-field" style="display:none;"><label>Encaissée sur</label><select id="f-recv"><option value="512">Banque</option><option value="571">Caisse</option><option value="5711">Mobile Money</option><option value="411">Client (à crédit)</option></select></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-danger" onclick="disposeAsset('${id}')">Confirmer la sortie</button>
    </div>
  `;
  openModal();
}

export function disposeAsset(id){
  const a = state.assets.find(x=>x.id===id);
  if(!a) return;
  const date = document.getElementById('f-date').value || todayISO();
  const price = Number(document.getElementById('f-price').value)||0;
  if(date < a.acquisitionDate){ showToast("La date de sortie doit être postérieure à la date d'acquisition"); return; }
  if(blockIfLocked(date)) return;
  generateAssetDepreciationEntry(a, date);
  const cumDep = assetRecordedDepreciation(a.id);
  const gross = Number(a.acquisitionValue)||0;
  const vnc = Math.max(0, gross - cumDep);
  const cat = assetCategory(a);
  const lines = [{account:cat.amortAccount, label:"Solde amortissement — "+a.name, debit:cumDep, credit:0}];
  if(vnc>0.5) lines.push({account:"675", label:"VNC cession — "+a.name, debit:vnc, credit:0});
  lines.push({account:cat.account, label:"Sortie — "+a.name, debit:0, credit:gross});
  if(price>0.5){
    const recvAcc = document.getElementById('f-recv').value;
    lines.push({account:recvAcc, label:"Encaissement cession — "+a.name, debit:price, credit:0});
    lines.push({account:"775", label:"Produit de cession — "+a.name, debit:0, credit:price});
  }
  pushJournalEntry("OD", date, "Cession/réforme — "+a.name, lines, {type:'asset-disposal', id:a.id});
  a.status = price>0.5 ? 'cede' : 'reforme';
  a.disposalDate = date; a.disposalValue = price;
  saveState(); closeModal(); renderLayout(); showToast("Immobilisation sortie du patrimoine");
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, {
  generateDepreciationUpTo, openAssetModal, saveAsset, deleteAsset, openDisposeAssetModal, disposeAsset
});
