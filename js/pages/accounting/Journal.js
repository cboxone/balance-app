/* ==========================================================
   pages/accounting/Journal.js — journal comptable chronologique
   Extrait des lignes 3722-3747 et 4403-4409 du fichier d'origine.
   ========================================================== */
import { state } from '../../core/state.js';
import { fmtMoney, fmtDate, esc, downloadCSV } from '../../core/utils.js';
import { accountShort } from '../../core/accounting-engine.js';

export function renderJournalTab(){
  const entries = [...state.journalEntries].sort((a,b)=>b.date.localeCompare(a.date)||b.ref.localeCompare(a.ref));
  return `
    <div class="toolbar"><div style="flex:1;"></div><button class="btn btn-ghost" onclick="exportJournalCSV()">Exporter CSV</button></div>
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        ${entries.length ? entries.map(e=>`
          <div style="padding:12px 18px;border-bottom:1px solid var(--line);">
            <div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--ink-soft);margin-bottom:6px;">
              <span class="mono">${e.ref}</span><span>${fmtDate(e.date)}</span>
            </div>
            <div style="font-size:.85rem;font-weight:600;margin-bottom:6px;">${esc(e.label)}</div>
            <table style="font-size:.8rem;"><tbody>
              ${e.lines.map(l=>`<tr>
                <td style="padding:2px 8px 2px 0;color:var(--ink-soft);width:90px;">${l.account}</td>
                <td style="padding:2px 8px;">${esc(accountShort(l.account))}</td>
                <td class="tright mono" style="padding:2px 8px;width:110px;">${l.debit?fmtMoney(l.debit):''}</td>
                <td class="tright mono" style="padding:2px 0;width:110px;">${l.credit?fmtMoney(l.credit):''}</td>
              </tr>`).join('')}
            </tbody></table>
          </div>
        `).join('') : `<div class="empty"><div class="display">Aucune écriture</div>Les écritures apparaissent automatiquement dès votre première facture, achat ou mouvement de trésorerie.</div>`}
      </div>
    </div>
  `;
}

export function exportJournalCSV(){
  const rows = [];
  [...state.journalEntries].sort((a,b)=>a.date.localeCompare(b.date)).forEach(e=>{
    e.lines.forEach(l=>rows.push([e.date, e.ref, e.journal, e.label, l.account, accountShort(l.account), l.debit||0, l.credit||0]));
  });
  downloadCSV('journal-comptable.csv', ['Date','Référence','Journal','Libellé écriture','Compte','Intitulé compte','Débit','Crédit'], rows);
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { exportJournalCSV });
