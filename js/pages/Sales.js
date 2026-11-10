/* ==========================================================
   pages/Sales.js — orchestrateur des onglets Ventes
   Extrait des lignes 1765-1776 du fichier d'origine. Le contenu de
   chaque onglet vit dans pages/sales/{Devis,Invoices,CreditNotes,Recurring}.js
   ========================================================== */
import { state } from '../core/state.js';
import { renderDevisTab } from './sales/Devis.js';
import { renderInvoicesTab } from './sales/Invoices.js';
import { renderCreditNotesTab } from './sales/CreditNotes.js';
import { renderRecurringTab } from './sales/Recurring.js';

export function renderSales(){
  const tab = state.salesTab || 'factures';
  const tabs = [['devis','Devis'],['factures','Factures'],['avoirs','Avoirs'],['abonnements','Abonnements']];
  const body = tab==='devis' ? renderDevisTab() : tab==='avoirs' ? renderCreditNotesTab() : tab==='abonnements' ? renderRecurringTab() : renderInvoicesTab();
  return `
    <div class="toolbar" style="gap:4px;margin-bottom:6px;">
      ${tabs.map(([k,l])=>`<button class="btn btn-sm ${tab===k?'btn-primary':'btn-ghost'}" onclick="state.salesTab='${k}'; renderLayout();">${l}</button>`).join('')}
    </div>
    ${body}
  `;
}
