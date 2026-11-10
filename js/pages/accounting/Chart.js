/* ==========================================================
   pages/accounting/Chart.js — plan comptable (lecture seule)
   Extrait des lignes 4391-4402 du fichier d'origine.
   ========================================================== */
import { state } from '../../core/state.js';
import { esc } from '../../core/utils.js';

export function renderChartTab(){
  return `
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        <table><thead><tr><th>Code</th><th>Intitulé</th><th>Classe</th></tr></thead><tbody>
          ${state.chartOfAccounts.map(a=>`<tr><td class="mono">${a.code}</td><td>${esc(a.name)}</td><td>${a.cls}</td></tr>`).join('')}
        </tbody></table>
      </div>
    </div>
    <p style="font-size:.76rem;color:var(--ink-soft);margin-top:14px;">Plan comptable simplifié inspiré du référentiel SYSCOHADA (OHADA), limité aux comptes utilisés par les opérations courantes du logiciel.</p>
  `;
}
