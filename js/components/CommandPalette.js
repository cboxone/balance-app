/* ==========================================================
   components/CommandPalette.js — palette de commandes (Ctrl/Cmd+K)
   Extrait des lignes 4988-5052 du fichier d'origine.

   NOTE DE MIGRATION : certaines actions ouvrent des modales qui vivent
   dans des pages pas encore migrées dans cette passe (Sales, Treasury,
   Suppliers, Purchases, Accounting/Assets). Les imports ci-dessous
   pointent déjà vers les chemins cibles définis dans le plan de
   migration — il suffira de créer ces fichiers pour que tout se
   rebranche sans toucher à ce fichier.
   ========================================================== */
import { state, sectorCfg } from '../core/state.js';
import { esc } from '../core/utils.js';
import { goView } from '../router.js';
import { closeModal } from './Modal.js';
import { renderLayout } from './Layout.js';

import { openClientModal, openClientDetail, clientName } from '../pages/Clients.js';
import { openProductModal } from '../pages/Products.js';
import { openDevisModal } from '../pages/sales/Devis.js';
import { openInvoiceModal } from '../pages/sales/Invoices.js';
import { openRecurringModal } from '../pages/sales/Recurring.js';
import { openTreasuryModal } from '../pages/Treasury.js';
import { openSupplierModal } from '../pages/Suppliers.js';
import { openAssetModal } from '../pages/accounting/Assets.js';
import { openPurchaseModal } from '../pages/Purchases.js';

let paletteItems = [];
let paletteSel = 0;

function paletteActions(){
  const cfg = sectorCfg();
  return [
    {label:"Nouveau devis", tag:"Ventes", run:()=>{state.salesTab='devis'; goView('sales'); openDevisModal();}},
    {label:"Nouvelle facture", tag:"Ventes", run:()=>{state.salesTab='factures'; goView('sales'); openInvoiceModal();}},
    {label:`Nouveau ${cfg.clientNoun.toLowerCase().replace(/s$/,'')}`, tag:cfg.clientNoun, run:()=>{goView('clients'); openClientModal();}},
    {label:`Nouveau ${cfg.product.toLowerCase()}`, tag:cfg.products, run:()=>{goView('products'); openProductModal();}},
    {label:"Nouveau mouvement de trésorerie", tag:"Trésorerie", run:()=>{goView('treasury'); openTreasuryModal();}},
    {label:"Nouveau fournisseur", tag:"Fournisseurs", run:()=>{goView('suppliers'); openSupplierModal();}},
    {label:"Nouvelle immobilisation", tag:"Immobilisations", run:()=>{state.accountingTab='assets'; goView('accounting'); openAssetModal();}},
    {label:"Fiche de Stock", tag:"Stock", run:()=>{goView('stockcard');}},
    {label:"Nouvel abonnement (facturation récurrente)", tag:"Ventes", run:()=>{state.salesTab='abonnements'; goView('sales'); openRecurringModal();}},
    {label:"Nouvelle commande fournisseur", tag:"Achats", run:()=>{goView('purchases'); openPurchaseModal();}},
    {label:"Aller au tableau de bord", tag:"Navigation", run:()=>goView('dashboard')},
    {label:"Aller aux rapports", tag:"Navigation", run:()=>goView('reports')},
    {label:"Aller aux paramètres", tag:"Navigation", run:()=>goView('settings')},
  ];
}

/* recherche globale : clients, produits, devis, factures */
function paletteSearchResults(q){
  if(!q || q.length<1) return [];
  const s = q.toLowerCase();
  const out = [];
  state.clients.filter(c=>c.name.toLowerCase().includes(s)).slice(0,4).forEach(c=>
    out.push({label:`${c.name}`, tag:sectorCfg().clientNoun, run:()=>openClientDetail(c.id)}));
  state.suppliers.filter(s2=>s2.name.toLowerCase().includes(s)).slice(0,4).forEach(s2=>
    out.push({label:`${s2.name}`, tag:"Fournisseurs", run:()=>{goView('suppliers');}}));
  state.products.filter(p=>p.name.toLowerCase().includes(s)).slice(0,4).forEach(p=>
    out.push({label:`${p.name}`, tag:sectorCfg().products, run:()=>{goView('products');}}));
  state.invoices.filter(i=>i.number.toLowerCase().includes(s) || clientName(i.clientId).toLowerCase().includes(s)).slice(0,4).forEach(i=>
    out.push({label:`Facture ${i.number} — ${clientName(i.clientId)}`, tag:"Factures", run:()=>{state.salesTab='factures'; goView('sales');}}));
  state.devis.filter(d=>d.number.toLowerCase().includes(s) || clientName(d.clientId).toLowerCase().includes(s)).slice(0,4).forEach(d=>
    out.push({label:`Devis ${d.number} — ${clientName(d.clientId)}`, tag:"Devis", run:()=>{state.salesTab='devis'; goView('sales');}}));
  return out;
}

export function openPalette(){
  document.getElementById('cmdk-overlay').classList.add('open');
  const input = document.getElementById('cmdk-input');
  input.value=""; renderPalette(""); setTimeout(()=>input.focus(),10);
}
export function closePalette(){ document.getElementById('cmdk-overlay').classList.remove('open'); }

export function renderPalette(q){
  const actionMatches = paletteActions().filter(a=>a.label.toLowerCase().includes((q||"").toLowerCase()));
  const searchMatches = paletteSearchResults(q);
  paletteItems = q ? [...searchMatches, ...actionMatches] : actionMatches;
  paletteSel = 0;
  document.getElementById('cmdk-list').innerHTML = paletteItems.length ? paletteItems.map((a,idx)=>`
    <div class="cmdk-item ${idx===paletteSel?'sel':''}" data-palette-idx="${idx}">${esc(a.label)}<span class="tag">${a.tag}</span></div>
  `).join('') : `<div class="cmdk-item">Aucune action trouvée</div>`;
  document.querySelectorAll('#cmdk-list [data-palette-idx]').forEach(el=>{
    el.addEventListener('click', ()=>runPalette(Number(el.dataset.paletteIdx)));
  });
}

export function runPalette(idx){ const a=paletteItems[idx]; if(a){ closePalette(); a.run(); renderLayout(); } }

export function paletteKeydown(e){
  if(e.key==='ArrowDown'){ e.preventDefault(); paletteSel=Math.min(paletteItems.length-1,paletteSel+1); refreshPaletteSel(); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); paletteSel=Math.max(0,paletteSel-1); refreshPaletteSel(); }
  else if(e.key==='Enter'){ e.preventDefault(); runPalette(paletteSel); }
  else if(e.key==='Escape'){ closePalette(); }
}
function refreshPaletteSel(){
  [...document.querySelectorAll('.cmdk-item')].forEach((el,idx)=>el.classList.toggle('sel', idx===paletteSel));
}

export function initGlobalShortcuts(){
  document.addEventListener('keydown', e=>{
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); openPalette(); }
    else if(e.key==='Escape'){ closeModal(); closePalette(); }
  });
  document.getElementById('cmdk-input').addEventListener('input', function(){ renderPalette(this.value); });
  document.getElementById('cmdk-input').addEventListener('keydown', paletteKeydown);
}

// closePalette reste nécessaire sur window : le clic sur l'overlay (index.html)
// utilise onclick="if(event.target===this)closePalette()", comme pour la modale générique.
Object.assign(window, { closePalette });
