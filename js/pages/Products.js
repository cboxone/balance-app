/* ==========================================================
   pages/Products.js — module Produits / Stock
   Extrait des lignes 1335-1339 et 1502-1652 du fichier d'origine.
   Même pattern de migration que pages/Clients.js (voir sa note d'en-tête) :
   templates HTML inchangés, fonctions exposées sur window pour les onclick="".
   ========================================================== */
import { state, sectorCfg, saveState } from '../core/state.js';
import { uid, todayISO, fmtMoney, esc, downloadCSV } from '../core/utils.js';
import { showToast } from '../components/Toast.js';
import { openModal, closeModal } from '../components/Modal.js';
import { logAudit, diffFields, logStockMovement } from '../core/audit.js';
import { guardDelete } from '../core/auth.js';
import { pushJournalEntry } from '../core/accounting-engine.js';
import { renderLayout } from '../components/Layout.js';
import { goView } from '../router.js';
import {
  multiMagasin, scopeLabel, scopeMagasinIds,
  magasinStock, magasinName, isLow, displayStock, totalStock
} from '../core/sites.js';

export function productVatRate(p){
  if(!state.settings.vatEnabled) return 0;
  if(p && p.vatRate!=null && p.vatRate!=='') return Number(p.vatRate);
  return Number(state.settings.vatRate)||0;
}

export function exportProductsCSV(){
  downloadCSV('produits.csv', ['Nom','Catégorie','Prix','Coût','Unité'],
    state.products.map(p=>[p.name, p.category||'', p.price, p.cost, p.unit||'']));
}

export function goToStockCard(id){
  window.__stockCardProduct = id; window.__cardStart=''; window.__cardEnd=''; window.__cardMagasin='';
  goView('stockcard');
}

export function renderProducts(){
  const cfg = sectorCfg();
  const q = window.__prodSearch || "";
  const list = state.products.filter(p=>p.name.toLowerCase().includes(q.toLowerCase()));
  return `
    <div class="toolbar">
      <input class="search" placeholder="Rechercher…" value="${esc(q)}" oninput="window.__prodSearch=this.value; window.renderLayout()">
      <button class="btn btn-ghost" onclick="exportProductsCSV()">Exporter CSV</button>
      <button class="btn btn-primary" onclick="openProductModal()">+ Nouveau ${cfg.product.toLowerCase()}</button>
    </div>
    ${multiMagasin() && cfg.stock ? `<div style="font-size:.78rem;color:var(--ink-soft);margin-bottom:10px;">Stock affiché : ${scopeLabel()}. Détail par magasin disponible en modifiant l'article.</div>` : ''}
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        ${list.length ? `<table><thead><tr><th>${cfg.product}</th><th>Catégorie</th><th class="tright">Prix</th>${cfg.stock?'<th>Stock</th>':''}<th></th></tr></thead><tbody>
          ${list.map(p=>{
            const low = cfg.stock && isLow(p);
            const qty = cfg.stock ? displayStock(p) : 0;
            const pct = cfg.stock ? Math.max(0,Math.min(100,(qty/(p.minStock*3||1))*100)) : 0;
            const hiddenMagasinLow = cfg.stock && !low && multiMagasin() && (scopeMagasinIds()===null || scopeMagasinIds().length>1) && state.magasins.some(m=>(scopeMagasinIds()===null || scopeMagasinIds().includes(m.id)) && magasinStock(p,m.id)<=p.minStock);
            return `<tr>
            <td><strong>${esc(p.name)}</strong></td>
            <td>${esc(p.category)||'—'}</td>
            <td class="tright mono">${fmtMoney(p.price)}</td>
            ${cfg.stock ? `<td><div style="display:flex;align-items:center;gap:8px;">
                <div class="stockbar ${low?'low':''}"><div style="width:${pct}%"></div></div>
                <span class="mono" style="font-size:.78rem;${qty<0?'color:var(--rust);':''}">${qty} ${esc(p.unit)}</span>
                ${qty<0?'<span class="badge badge-warn">survendu</span>':low?'<span class="badge badge-warn">bas</span>':hiddenMagasinLow?'<span class="badge badge-warn" title="Un magasin au moins est sous le seuil malgré un total suffisant">bas sur 1 magasin</span>':''}
              </div></td>` : ''}
            <td><div class="row-actions">
              ${cfg.stock ? `<button class="icon-btn" onclick="goToStockCard('${p.id}')" title="Fiche de stock">🗂</button>` : ''}
              <button class="icon-btn" onclick="openProductModal('${p.id}')" title="Modifier">✎</button>
              <button class="icon-btn" onclick="deleteProduct('${p.id}')" title="Supprimer">✕</button>
            </div></td>
          </tr>`;}).join('')}
        </tbody></table>` : `<div class="empty"><div class="display">Rien ici pour l'instant</div>Ajoutez votre premier ${cfg.product.toLowerCase()}.</div>`}
      </div>
    </div>
  `;
}

export function openProductModal(id){
  const cfg = sectorCfg();
  const p = id ? state.products.find(x=>x.id===id) : {name:"",category:"",price:"",cost:"",stockByMagasin:{},minStock:5,unit:"unité"};
  const stockFields = state.magasins.map(m=>`
    <div class="field-row">
      <div class="field" style="grid-column:1/3;"><label>Stock — ${esc(m.name)}</label><input type="number" min="0" class="magasin-stock-input" data-magasin="${m.id}" value="${magasinStock(p,m.id)}"></div>
    </div>`).join('');
  document.getElementById('modal').innerHTML = `
    <div class="modal-head"><h3>${id?'Modifier':'Nouveau'} ${cfg.product.toLowerCase()}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="field"><label>Nom</label><input id="f-name" value="${esc(p.name)}"></div>
      <div class="field-row">
        <div class="field"><label>Catégorie</label><input id="f-cat" value="${esc(p.category)}"></div>
        <div class="field"><label>Unité</label><input id="f-unit" value="${esc(p.unit)}" placeholder="pièce, sac, kg…"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Prix de vente</label><input id="f-price" type="number" value="${p.price}"></div>
        <div class="field"><label>Coût d'achat</label><input id="f-cost" type="number" value="${p.cost}"></div>
      </div>
      ${state.settings.vatEnabled ? `<div class="field"><label>Taux de TVA (%) — laisser vide pour utiliser le taux global (${state.settings.vatRate}%)</label><input id="f-vat" type="number" min="0" max="100" step="0.5" value="${p.vatRate!=null?p.vatRate:''}" placeholder="${state.settings.vatRate}"></div>` : ''}
      ${cfg.stock ? `<div class="field"><label>Seuil d'alerte (par magasin)</label><input id="f-min" type="number" value="${p.minStock}"></div>
      ${stockFields}
      ${id ? `<p style="font-size:.74rem;color:var(--ink-soft);margin-top:8px;">Corriger une quantité ici (ex. après un inventaire physique) génère automatiquement une écriture comptable de régularisation, visible dans Comptabilité → Journal.</p>` : ''}` : ''}
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveProduct('${id||''}')">Enregistrer</button>
    </div>
  `;
  openModal();
}

export function recordStockAdjustment(product, magasinId, delta){
  if(Math.abs(delta) < 0.5) return;
  logStockMovement(todayISO(), product.id, magasinId, delta, 'ajustement', "Correction d'inventaire", 'stockAdjustment', uid('adj'));
  const value = Math.round(Math.abs(delta) * (product.cost||0));
  if(value < 0.5) return; // rien à valoriser si le coût de l'article est nul
  const magasinLabel = magasinName(magasinId);
  const lines = delta > 0
    ? [{account:"311", label:"Régularisation stock — "+product.name, debit:value, credit:0}, {account:"6031", label:"Régularisation inventaire — "+product.name, debit:0, credit:value}]
    : [{account:"6031", label:"Régularisation inventaire — "+product.name, debit:value, credit:0}, {account:"311", label:"Régularisation stock — "+product.name, debit:0, credit:value}];
  pushJournalEntry("OD", todayISO(), `Régularisation d'inventaire — ${product.name} (${magasinLabel})`, lines, {type:'stockAdjustment', id:uid('adj')});
}

export function saveProduct(id){
  const name = document.getElementById('f-name').value.trim();
  if(!name){ showToast("Le nom est obligatoire"); return; }
  const cfg = sectorCfg();
  const stockByMagasin = {};
  if(cfg.stock){
    document.querySelectorAll('.magasin-stock-input').forEach(inp=>{
      stockByMagasin[inp.dataset.magasin] = Number(inp.value)||0;
    });
  }
  const vatInput = document.getElementById('f-vat');
  const vatRate = vatInput && vatInput.value!=='' ? Number(vatInput.value) : null;
  const data = {
    name, category:document.getElementById('f-cat').value.trim(),
    unit:document.getElementById('f-unit').value.trim()||'unité',
    price:Number(document.getElementById('f-price').value)||0,
    cost:Number(document.getElementById('f-cost').value)||0,
    vatRate,
    minStock: cfg.stock ? Number(document.getElementById('f-min').value)||0 : 0,
    stockByMagasin: cfg.stock ? stockByMagasin : {}
  };
  if(id){
    const p = state.products.find(x=>x.id===id);
    const before = {...p};
    const previousStock = {...(p.stockByMagasin||{})};
    Object.assign(p, data);
    const changes = diffFields(before, p, {name:'Nom', category:'Catégorie', unit:'Unité', price:'Prix de vente', cost:'Coût', minStock:"Seuil d'alerte"});
    if(changes.length) logAudit('modification','produit', id, p.name, changes);
    if(cfg.stock){
      const magasinsTouched = new Set([...Object.keys(previousStock), ...Object.keys(stockByMagasin)]);
      let adjustments = 0;
      magasinsTouched.forEach(magasinId=>{
        const delta = (stockByMagasin[magasinId]||0) - (previousStock[magasinId]||0);
        if(Math.abs(delta)>=0.5){ recordStockAdjustment(p, magasinId, delta); adjustments++; }
      });
      if(adjustments){ saveState(); closeModal(); renderLayout(); showToast("Enregistré — écriture(s) de régularisation d'inventaire créée(s)"); return; }
    }
  }
  else {
    const newProduct = {id:uid('prd'), ...data};
    state.products.push(newProduct);
    logAudit('creation','produit', newProduct.id, newProduct.name, []);
  }
  saveState(); closeModal(); renderLayout(); showToast("Enregistré");
}

export function deleteProduct(id){
  if(!guardDelete()) return;
  const p = state.products.find(x=>x.id===id);
  const stock = p ? totalStock(p) : 0;
  const msg = stock>0 ? `Ce produit a encore ${stock} unité(s) en stock. Supprimer l'article quand même ?` : "Supprimer cet article ?";
  if(!confirm(msg)) return;
  state.products = state.products.filter(p=>p.id!==id);
  state.stockMovements = state.stockMovements.filter(m=>m.productId!==id);
  logAudit('suppression','produit', id, p?p.name:id, []);
  saveState(); renderLayout(); showToast("Supprimé");
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { exportProductsCSV, goToStockCard, openProductModal, saveProduct, deleteProduct });
