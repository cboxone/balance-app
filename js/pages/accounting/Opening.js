/* ==========================================================
   pages/accounting/Opening.js — écritures d'ouverture
   Extrait des lignes 3619-3721 du fichier d'origine.
   ========================================================== */
import { state, saveState } from '../../core/state.js';
import { todayISO, fmtMoney } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { renderLayout } from '../../components/Layout.js';
import { pushJournalEntry } from '../../core/accounting-engine.js';

export function getOpeningValues(){
  const entry = state.journalEntries.find(e=>e.generatedFrom && e.generatedFrom.type==='opening');
  const get = (code, side) => { if(!entry) return 0; const l = entry.lines.find(x=>x.account===code); return l ? (side==='debit'?(l.debit||0):(l.credit||0)) : 0; };
  return {
    date: entry ? entry.date : todayISO(),
    stock: get('311','debit'), clients: get('411','debit'),
    caisse: get('571','debit'), momo: get('5711','debit'), banque: get('512','debit'),
    fournisseurs: get('401','credit'), emprunts: get('164','credit'),
    capital: get('101','credit') || -get('101','debit'),
    exists: !!entry, autoCapital: !entry
  };
}

export function renderOpeningTab(){
  const cur = getOpeningValues();
  return `
    <div class="panel" style="max-width:640px;">
      <div class="panel-head"><h3>Écritures d'ouverture</h3></div>
      <div class="panel-body">
        <p style="font-size:.82rem;color:var(--ink-soft);margin-top:0;">À saisir si vous commencez à utiliser Balance pour une entreprise déjà en activité : ce que vous avez déjà en stock et en caisse, ce qu'on vous doit et ce que vous devez au moment où vous démarrez. Vous pouvez revenir corriger ces montants à tout moment — un nouvel enregistrement remplace le précédent, il n'y en a jamais qu'un seul actif.</p>
        <div class="field" style="max-width:220px;"><label>Date d'ouverture</label><input id="ob-date" type="date" value="${cur.date}"></div>
        <label style="display:block;font-size:.72rem;font-weight:600;color:var(--ink-soft);margin:14px 0 6px;text-transform:uppercase;">Ce que vous possédez</label>
        <div class="field-row">
          <div class="field"><label>Stock initial (valeur au coût d'achat)</label><input id="ob-stock" type="number" min="0" value="${cur.stock}" onchange="updateOpeningSummary()"></div>
          <div class="field"><label>Créances clients existantes</label><input id="ob-clients" type="number" min="0" value="${cur.clients}" onchange="updateOpeningSummary()"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Caisse (espèces)</label><input id="ob-caisse" type="number" min="0" value="${cur.caisse}" onchange="updateOpeningSummary()"></div>
          <div class="field"><label>Mobile Money</label><input id="ob-momo" type="number" min="0" value="${cur.momo}" onchange="updateOpeningSummary()"></div>
          <div class="field"><label>Banque</label><input id="ob-banque" type="number" min="0" value="${cur.banque}" onchange="updateOpeningSummary()"></div>
        </div>
        <label style="display:block;font-size:.72rem;font-weight:600;color:var(--ink-soft);margin:14px 0 6px;text-transform:uppercase;">Ce que vous devez</label>
        <div class="field-row">
          <div class="field"><label>Dettes fournisseurs existantes</label><input id="ob-fournisseurs" type="number" min="0" value="${cur.fournisseurs}" onchange="updateOpeningSummary()"></div>
          <div class="field"><label>Emprunts en cours</label><input id="ob-emprunts" type="number" min="0" value="${cur.emprunts}" onchange="updateOpeningSummary()"></div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;margin:14px 0 8px;cursor:pointer;">
          <input type="checkbox" id="ob-auto-capital" ${cur.autoCapital?'checked':''} style="width:16px;height:16px;" onchange="updateOpeningSummary()">
          Calculer le capital automatiquement (recommandé — équilibre garanti)
        </label>
        <div class="field" id="ob-capital-field" style="max-width:260px;${cur.autoCapital?'display:none;':''}"><label>Capital</label><input id="ob-capital" type="number" value="${cur.capital}" onchange="updateOpeningSummary()"></div>
        <div id="ob-summary" style="margin-top:10px;padding:12px 14px;background:var(--surface-2);border-radius:8px;font-size:.85rem;"></div>
        <button class="btn btn-primary" style="margin-top:14px;" onclick="saveOpeningBalances()">${cur.exists?'Mettre à jour':'Enregistrer'} les écritures d'ouverture</button>
      </div>
    </div>
  `;
}

export function updateOpeningSummary(){
  const g = id => Number(document.getElementById(id).value)||0;
  const stock=g('ob-stock'), clients=g('ob-clients'), caisse=g('ob-caisse'), momo=g('ob-momo'), banque=g('ob-banque');
  const fournisseurs=g('ob-fournisseurs'), emprunts=g('ob-emprunts');
  const autoCapital = document.getElementById('ob-auto-capital').checked;
  const capitalField = document.getElementById('ob-capital-field');
  const totalActif = stock+clients+caisse+momo+banque;
  let capital, ecart=0;
  if(autoCapital){
    capitalField.style.display='none';
    capital = totalActif - fournisseurs - emprunts;
  } else {
    capitalField.style.display='';
    capital = g('ob-capital');
    ecart = totalActif - (fournisseurs+emprunts+capital);
  }
  const totalPassif = fournisseurs+emprunts+capital;
  document.getElementById('ob-summary').innerHTML = `
    <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Total de ce que vous possédez</span><span class="mono">${fmtMoney(totalActif)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Dettes + capital</span><span class="mono">${fmtMoney(totalPassif)}</span></div>
    ${autoCapital
      ? `<div style="display:flex;justify-content:space-between;font-weight:700;margin-top:6px;padding-top:6px;border-top:1px dashed var(--line-strong);"><span>Capital calculé automatiquement</span><span class="mono">${fmtMoney(capital)}</span></div>`
      : `<div style="display:flex;justify-content:space-between;font-weight:700;margin-top:6px;padding-top:6px;border-top:1px dashed var(--line-strong);color:${Math.abs(ecart)<1?'var(--sage)':'var(--rust)'};"><span>${Math.abs(ecart)<1?'Équilibré':'Écart à corriger'}</span><span class="mono">${fmtMoney(ecart)}</span></div>`}
  `;
}

export function saveOpeningBalances(){
  const date = document.getElementById('ob-date').value || todayISO();
  const g = id => Number(document.getElementById(id).value)||0;
  const stock=g('ob-stock'), clients=g('ob-clients'), caisse=g('ob-caisse'), momo=g('ob-momo'), banque=g('ob-banque');
  const fournisseurs=g('ob-fournisseurs'), emprunts=g('ob-emprunts');
  const autoCapital = document.getElementById('ob-auto-capital').checked;
  const totalActif = stock+clients+caisse+momo+banque;
  let capital;
  if(autoCapital){
    capital = totalActif - fournisseurs - emprunts;
  } else {
    capital = g('ob-capital');
    const ecart = totalActif - (fournisseurs+emprunts+capital);
    if(Math.abs(ecart) > 0.5){ showToast("Les montants ne s'équilibrent pas (écart de "+fmtMoney(Math.abs(ecart))+"). Cochez le calcul automatique du capital, ou ajustez les montants."); return; }
  }
  const lines = [];
  if(stock>0) lines.push({account:"311", label:"Stock initial", debit:stock, credit:0});
  if(clients>0) lines.push({account:"411", label:"Créances clients à l'ouverture", debit:clients, credit:0});
  if(caisse>0) lines.push({account:"571", label:"Caisse à l'ouverture", debit:caisse, credit:0});
  if(momo>0) lines.push({account:"5711", label:"Mobile Money à l'ouverture", debit:momo, credit:0});
  if(banque>0) lines.push({account:"512", label:"Banque à l'ouverture", debit:banque, credit:0});
  if(fournisseurs>0) lines.push({account:"401", label:"Dettes fournisseurs à l'ouverture", debit:0, credit:fournisseurs});
  if(emprunts>0) lines.push({account:"164", label:"Emprunts à l'ouverture", debit:0, credit:emprunts});
  if(Math.abs(capital)>0.5){
    if(capital>0) lines.push({account:"101", label:"Capital à l'ouverture", debit:0, credit:capital});
    else lines.push({account:"101", label:"Capital à l'ouverture (déficitaire)", debit:-capital, credit:0});
  }
  if(!lines.length){ showToast("Renseignez au moins un montant"); return; }
  state.journalEntries = state.journalEntries.filter(e => !(e.generatedFrom && e.generatedFrom.type==='opening'));
  pushJournalEntry("AN", date, "Écritures d'ouverture", lines, {type:'opening', id:'opening'});
  saveState(); renderLayout(); showToast("Écritures d'ouverture enregistrées");
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { updateOpeningSummary, saveOpeningBalances });
