/* ==========================================================
   core/print-shell.js — habillage générique d'impression pour
   les documents de rapport (TVA, futurs rapports).
   Extrait des lignes 3278-3306 du fichier d'origine. Placé ici plutôt
   que dans un module "rapports" car réutilisé par plusieurs modules
   qui ne partagent pas d'autre code entre eux.
   ========================================================== */
import { state } from './state.js';
import { todayISO, fmtDate, esc } from './utils.js';
import { showToast } from '../components/Toast.js';

export function reportPrintShell(title, subtitle, bodyHtml){
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
    body{font-family:'IBM Plex Sans',Arial,sans-serif;color:#1C2521;padding:40px;max-width:820px;margin:0 auto;}
    h1{font-size:1.4rem;margin:0 0 2px;}
    h2{font-size:1rem;margin:26px 0 8px;}
    .muted{color:#666;font-size:.85rem;}
    .headrow{display:flex;justify-content:space-between;margin-bottom:24px;align-items:flex-start;border-bottom:2px solid #333;padding-bottom:14px;}
    table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:.88rem;}
    th{text-align:left;font-size:.7rem;text-transform:uppercase;color:#666;border-bottom:2px solid #333;padding:6px;}
    td{padding:6px;border-bottom:1px solid #ddd;}
    td.num, th.num{text-align:right;}
    .foot{margin-top:30px;font-size:.72rem;color:#888;border-top:1px dashed #ccc;padding-top:12px;}
    @media print{ body{padding:15mm;} }
  </style></head><body>
    <div class="headrow">
      <div style="display:flex;align-items:center;gap:14px;">
        ${state.settings.companyLogo ? `<img src="${state.settings.companyLogo}" alt="Logo" style="height:48px;max-width:140px;object-fit:contain;">` : ''}
        <div><h1>${esc(state.settings.companyName)}</h1><div class="muted">${esc(subtitle)}</div></div>
      </div>
      <div style="text-align:right;"><h1>${esc(title)}</h1><div class="muted">Édité le ${fmtDate(todayISO())}</div></div>
    </div>
    ${bodyHtml}
    <div class="foot">Document généré depuis Balance — gestion commerciale. Fourni à titre indicatif.</div>
  </body></html>`;
  const w = window.open('', '_blank');
  if(!w){ showToast("Autorisez les pop-ups pour imprimer"); return; }
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(()=>{ w.focus(); w.print(); }, 300);
}
