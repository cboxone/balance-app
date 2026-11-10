/* ==========================================================
   pages/Accounting.js — orchestrateur des onglets Comptabilité
   Extrait des lignes 3596-3618 du fichier d'origine. Le contenu de
   chaque onglet vit dans pages/accounting/*.js
   ========================================================== */
import { state } from '../core/state.js';
import { renderOpeningTab } from './accounting/Opening.js';
import { renderJournalTab } from './accounting/Journal.js';
import { renderLedgerTab } from './accounting/Ledger.js';
import { renderReconciliationTab } from './accounting/Reconciliation.js';
import { renderBalanceTab, renderResultTab, renderSheetTab } from './accounting/Reports.js';
import { renderAssetsTab } from './accounting/Assets.js';
import { renderVatTab } from './accounting/Vat.js';
import { renderClosuresTab } from './accounting/Closures.js';
import { renderChartTab } from './accounting/Chart.js';
import { renderFecExportTab } from './accounting/FecExport.js';

export function renderAccounting(){
  const tab = state.accountingTab || 'journal';
  const tabs = [['opening','Ouverture'],['journal','Journal'],['ledger','Grand livre'],['reconcile','Rapprochement'],['balance','Balance'],['assets','Immobilisations'],['vat','Déclaration TVA'],['result','Résultat'],['sheet','Bilan simplifié'],['closures','Clôtures'],['chart','Plan comptable'],['export','Export FEC']];
  const body = tab==='opening' ? renderOpeningTab()
    : tab==='ledger' ? renderLedgerTab()
    : tab==='reconcile' ? renderReconciliationTab()
    : tab==='balance' ? renderBalanceTab()
    : tab==='assets' ? renderAssetsTab()
    : tab==='vat' ? renderVatTab()
    : tab==='result' ? renderResultTab()
    : tab==='sheet' ? renderSheetTab()
    : tab==='closures' ? renderClosuresTab()
    : tab==='chart' ? renderChartTab()
    : tab==='export' ? renderFecExportTab()
    : renderJournalTab();
  return `
    <div class="toolbar" style="gap:4px;margin-bottom:6px;">
      ${tabs.map(([k,l])=>`<button class="btn btn-sm ${tab===k?'btn-primary':'btn-ghost'}" onclick="state.accountingTab='${k}'; renderLayout();">${l}</button>`).join('')}
    </div>
    <p style="font-size:.76rem;color:var(--ink-soft);margin:0 0 14px;">Écritures générées automatiquement à partir de vos ventes, achats et mouvements de trésorerie. Plan comptable simplifié inspiré du référentiel SYSCOHADA — à faire valider par un expert-comptable avant tout usage officiel.</p>
    ${body}
  `;
}
