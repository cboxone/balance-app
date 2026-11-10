/* ==========================================================
   pages/Reports.js — orchestrateur des onglets Rapports
   Extrait des lignes 3259-3274 du fichier d'origine.
   ========================================================== */
import { state } from '../core/state.js';
import { renderSalesAnalysis, exportSalesAnalysisCSV, printSalesAnalysis } from './reports/SalesAnalysis.js';
import { renderActivitySummary, exportActivitySummaryCSV, printActivitySummary, setBilanRange } from './reports/ActivitySummary.js';

export function renderReports(){
  const tab = state.reportsTab || 'ventes';
  return `
    <div class="toolbar" style="gap:4px;margin-bottom:14px;">
      <button class="btn btn-sm ${tab==='ventes'?'btn-primary':'btn-ghost'}" onclick="state.reportsTab='ventes'; renderLayout();">Analyse des ventes</button>
      <button class="btn btn-sm ${tab==='bilan'?'btn-primary':'btn-ghost'}" onclick="state.reportsTab='bilan'; renderLayout();">Bilan d'activité</button>
      <div style="flex:1;"></div>
      <button class="btn btn-sm btn-ghost" onclick="exportReportCSV()">Exporter CSV</button>
      <button class="btn btn-sm btn-ghost" onclick="printReport()">Imprimer / PDF</button>
    </div>
    ${tab==='bilan' ? renderActivitySummary() : renderSalesAnalysis()}
  `;
}

export function exportReportCSV(){
  if((state.reportsTab||'ventes')==='bilan') exportActivitySummaryCSV(); else exportSalesAnalysisCSV();
}
export function printReport(){
  if((state.reportsTab||'ventes')==='bilan') printActivitySummary(); else printSalesAnalysis();
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { exportReportCSV, printReport, setBilanRange });
