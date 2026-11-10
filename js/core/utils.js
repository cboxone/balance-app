/* ==========================================================
   core/utils.js — fonctions utilitaires génériques
   (formatage, échappement, export CSV, dates)
   ========================================================== */
import { state } from './state.js';
import { showToast } from '../components/Toast.js';

export function uid(p){ return p+"_"+Math.random().toString(36).slice(2,9); }
export function todayISO(){ return new Date().toISOString().slice(0,10); }
export function fmtMoney(n){
  n = Math.round(n||0);
  return n.toLocaleString('fr-FR') + " " + state.settings.currency;
}
export function fmtDate(iso){
  if(!iso) return "—";
  const d = new Date(iso+"T00:00:00");
  return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'});
}
export function esc(s){ return (s||"").toString().replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

export function numberToLetters(n){
  let s = '';
  while(n > 0){ n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n/26); }
  return s;
}

export function addDaysISO(iso, days){ const d = new Date(iso+'T00:00:00'); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }

export function csvCell(v){
  const s = (v==null?'':String(v));
  return /[";\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
}
export function downloadCSV(filename, headers, rows){
  const lines = [...(headers&&headers.length?[headers.map(csvCell).join(';')]:[]), ...rows.map(r=>r.map(csvCell).join(';'))];
  const blob = new Blob(["\uFEFF"+lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
  showToast("Export téléchargé");
}
