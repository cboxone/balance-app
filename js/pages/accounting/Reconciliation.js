/* ==========================================================
   pages/accounting/Reconciliation.js — rapprochement bancaire/caisse
   Extrait des lignes 4158-4211 du fichier d'origine.
   ========================================================== */
import { state, currentUser, saveState } from '../../core/state.js';
import { todayISO, fmtMoney, fmtDate, esc } from '../../core/utils.js';
import { renderLayout } from '../../components/Layout.js';
import { belongsToActiveMagasin } from '../../core/sites.js';
import { treasuryAccountForMethod, accountBalance } from '../../core/accounting-engine.js';

function treasuryAccount(t){ return treasuryAccountForMethod(t.method || 'Espèces'); }

export function toggleReconciled(id){
  const t = state.treasury.find(x=>x.id===id);
  if(!t) return;
  t.reconciled = t.reconciled ? null : { date: todayISO(), by: currentUser.name };
  saveState(); renderLayout();
}

export function openingAmountForAccount(code){
  const entry = state.journalEntries.find(e=>e.generatedFrom && e.generatedFrom.type==='opening');
  if(!entry) return 0;
  const l = entry.lines.find(x=>x.account===code);
  return l ? (l.debit||0)-(l.credit||0) : 0;
}

export function renderReconciliationTab(){
  const RECON_ACCOUNTS = [['571','Caisse'],['5711','Mobile Money'],['512','Banque']];
  const selected = window.__reconAccount || '571';
  const scoped = state.treasury.filter(belongsToActiveMagasin).filter(t=>treasuryAccount(t)===selected).sort((a,b)=>a.date.localeCompare(b.date));
  const bookBalance = accountBalance(selected);
  const openingAmt = openingAmountForAccount(selected);
  const reconciledBalance = openingAmt + scoped.filter(t=>t.reconciled).reduce((s,t)=>s+(t.type==='in'?t.amount:-t.amount),0);
  const statementInputVal = window.__reconStatementBalance===undefined ? '' : window.__reconStatementBalance;
  const ecart = statementInputVal!=='' ? Number(statementInputVal) - reconciledBalance : null;
  return `
    <p style="font-size:.78rem;color:var(--ink-soft);margin:-4px 0 12px;">Pointez les mouvements confirmés sur votre relevé réel (bancaire ou Mobile Money) pour vérifier que votre comptabilité correspond à la réalité. Le solde d'ouverture, s'il existe, est toujours considéré comme déjà rapproché.</p>
    <div class="toolbar">
      <select style="max-width:280px;" onchange="window.__reconAccount=this.value; window.__reconStatementBalance=''; renderLayout();">
        ${RECON_ACCOUNTS.map(([c,l])=>`<option value="${c}" ${c===selected?'selected':''}>${c} — ${l}</option>`).join('')}
      </select>
    </div>
    <div class="grid-kpi" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px;">
      <div class="kpi"><div class="kpi-label">Solde comptable</div><div class="kpi-value">${fmtMoney(bookBalance)}</div></div>
      <div class="kpi"><div class="kpi-label">Solde pointé</div><div class="kpi-value">${fmtMoney(reconciledBalance)}</div></div>
      <div class="kpi">
        <div class="kpi-label">Solde du relevé</div>
        <input type="number" value="${statementInputVal}" placeholder="Saisir le solde du relevé" oninput="window.__reconStatementBalance=this.value; renderLayout();" style="width:100%;border:1px solid var(--line-strong);border-radius:7px;padding:6px 8px;font-family:'IBM Plex Mono',monospace;font-size:.95rem;">
      </div>
    </div>
    ${ecart!==null ? `<div class="panel" style="margin-bottom:16px;padding:14px 18px;">
      <strong style="color:${Math.abs(ecart)<1?'var(--sage)':'var(--rust)'};">${Math.abs(ecart)<1?'✓ Rapprochement équilibré — le solde pointé correspond au relevé':'Écart : '+fmtMoney(ecart)+' — vérifiez les mouvements non pointés ou absents du logiciel'}</strong>
    </div>` : ''}
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        ${scoped.length ? `<table><thead><tr><th>Pointé</th><th>Date</th><th>Libellé</th><th class="tright">Montant</th></tr></thead><tbody>
          ${scoped.map(t=>`<tr style="${t.reconciled?'background:var(--surface-2);':''}">
            <td><input type="checkbox" ${t.reconciled?'checked':''} onchange="toggleReconciled('${t.id}')" style="width:16px;height:16px;"></td>
            <td>${fmtDate(t.date)}</td>
            <td>${esc(t.label)}</td>
            <td class="tright mono" style="${t.type==='in'?'color:var(--sage);':'color:var(--rust);'}">${t.type==='in'?'+':'-'}${fmtMoney(t.amount)}</td>
          </tr>`).join('')}
        </tbody></table>` : `<div class="empty"><div class="display">Aucun mouvement</div>Ce compte n'a pas encore de mouvement de trésorerie.</div>`}
      </div>
    </div>
  `;
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { toggleReconciled });
