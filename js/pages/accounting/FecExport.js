/* ==========================================================
   pages/accounting/FecExport.js — export FEC (Fichier des Écritures
   Comptables), format normalisé français.
   Extrait des lignes 4284-4337 du fichier d'origine.
   ========================================================== */
import { state } from '../../core/state.js';
import { todayISO } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { accountShort } from '../../core/accounting-engine.js';

function journalLabel(code){
  return {AC:"Achats", AN:"À-nouveaux", BQ:"Banque", CL:"Clôture", OD:"Opérations diverses", VE:"Ventes"}[code] || code;
}

export function renderFecExportTab(){
  const today = todayISO();
  const start = window.__fecStart || '';
  const end = window.__fecEnd || today;
  return `
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-head"><h3>Export FEC (Fichier des Écritures Comptables)</h3></div>
      <div class="panel-body">
        <p style="font-size:.83rem;color:var(--ink-soft);margin-top:0;">Format normalisé, lisible par tout logiciel comptable professionnel — pratique pour transmettre vos écritures à un expert-comptable ou pour un contrôle fiscal. Un fichier texte (.txt), une ligne par ligne d'écriture, encodé en UTF-8.</p>
        <div style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
          <div class="field" style="max-width:170px;margin:0;"><label>Du (facultatif)</label><input type="date" value="${start}" onchange="window.__fecStart=this.value;"></div>
          <div class="field" style="max-width:170px;margin:0;"><label>Au</label><input type="date" value="${end}" onchange="window.__fecEnd=this.value;"></div>
          <button class="btn btn-primary" onclick="exportFEC()">Télécharger le fichier FEC</button>
        </div>
        <p style="font-size:.76rem;color:var(--ink-soft);">${state.journalEntries.length} écriture(s) au total dans votre comptabilité. Laissez « Du » vide pour exporter depuis la toute première écriture.${state.settings.taxId?'':' Renseignez votre identifiant fiscal (IFU/SIREN) dans Paramètres pour un nommage de fichier conforme.'}</p>
      </div>
    </div>
  `;
}

export function exportFEC(){
  const start = window.__fecStart || '';
  const end = window.__fecEnd || todayISO();
  const entries = [...state.journalEntries]
    .filter(e=>(!start||e.date>=start) && (!end||e.date<=end))
    .sort((a,b)=> a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  if(!entries.length){ showToast("Aucune écriture sur cette période"); return; }
  const header = ["JournalCode","JournalLib","EcritureNum","EcritureDate","CompteNum","CompteLib","CompAuxNum","CompAuxLib","PieceRef","PieceDate","EcritureLib","Debit","Credit","EcritureLet","DateLet","ValidDate","Montantdevise","Idevise"];
  const rows = [];
  entries.forEach((e, idx)=>{
    const num = String(idx+1);
    const dateFEC = (e.date||'').replace(/-/g,'');
    e.lines.forEach(l=>{
      rows.push([
        e.journal, journalLabel(e.journal), num, dateFEC, l.account, accountShort(l.account),
        l.tiers?l.tiers.id:"", l.tiers?l.tiers.name:"", e.ref, dateFEC, (l.label||e.label||'').replace(/[\t\r\n]+/g,' '),
        (l.debit||0).toFixed(2), (l.credit||0).toFixed(2), l.lettre||"", "", dateFEC, "", ""
      ]);
    });
  });
  const content = [header.join('\t'), ...rows.map(r=>r.map(v=>String(v==null?'':v)).join('\t'))].join('\r\n');
  const taxId = (state.settings.taxId||'000000000').replace(/[^A-Za-z0-9]/g,'').padEnd(9,'0').slice(0,9).toUpperCase();
  const closingLabel = (end||todayISO()).replace(/-/g,'');
  const filename = `${taxId}FEC${closingLabel}.txt`;
  const blob = new Blob(["\uFEFF"+content], {type:'text/plain;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
  showToast(entries.length+" écriture(s) exportée(s)");
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { exportFEC });
