/* ==========================================================
   core/sites.js — site / magasins / portée / seuils de stock

   Chaque site a sa PROPRE base de données, indépendante des autres
   (pas de consolidation inter-sites) : dans une base donnée, il n'y a
   donc qu'UN site (state.site — celui de cette installation), qui a
   un ou plusieurs MAGASINS (entrepôts / points de vente concrets).
   Le stock, les ventes, les achats et la trésorerie sont rattachés à
   un magasin précis de ce site.
   ========================================================== */
import { state, sectorCfg } from './state.js';
import { esc } from './utils.js';

/* ---------------- magasins du site de cette installation ---------------- */
export function magasinName(id){ const m=state.magasins.find(x=>x.id===id); return m?m.name:"—"; }
export function defaultMagasin(){ return state.magasins.find(m=>m.isDefault) || state.magasins[0]; }
export function multiMagasin(){ return state.magasins.length>1; }
/* scope courant : 'all' | '<magasinId>' */
export function scopeMagasinIds(){
  if(!state.activeScope || state.activeScope==='all') return null;
  return [state.activeScope];
}
export function currentMagasinFilter(){ const ids = scopeMagasinIds(); return ids && ids.length===1 ? ids[0] : null; }
export function scopeLabel(){
  if(!state.activeScope || state.activeScope==='all') return 'tous les magasins';
  return magasinName(state.activeScope);
}
export function belongsToActiveMagasin(item){
  const ids = scopeMagasinIds();
  if(!ids) return true;
  if(item.magasinId == null) return true;
  return ids.includes(item.magasinId);
}
export function totalStock(p){ return Object.values(p.stockByMagasin||{}).reduce((s,v)=>s+(v||0),0); }
export function magasinStock(p, magasinId){ return (p.stockByMagasin && p.stockByMagasin[magasinId]) || 0; }

export function stockInScope(p){
  const ids = scopeMagasinIds();
  if(!ids) return totalStock(p);
  return ids.reduce((s,id)=>s+magasinStock(p,id),0);
}
export function displayStock(p){ return stockInScope(p); }
export function isLow(p){ return stockInScope(p) <= p.minStock; }
/* Vérifie chaque magasin individuellement (dans la portée courante), pour ne jamais masquer
   une rupture locale derrière un total consolidé qui semble suffisant. */
export function lowStockPerMagasin(){
  const cfg = sectorCfg();
  if(!cfg.stock) return [];
  const ids = scopeMagasinIds();
  const relevantMagasins = ids ? state.magasins.filter(m=>ids.includes(m.id)) : state.magasins;
  const out = [];
  state.products.forEach(p=>{
    relevantMagasins.forEach(m=>{
      const qty = magasinStock(p, m.id);
      if(qty <= p.minStock) out.push({product:p, magasin:m, qty});
    });
  });
  return out;
}
/* Produits distincts ayant au moins un magasin en stock bas dans la portée courante (pour les compteurs/KPI). */
export function lowStockProducts(){
  const cfg = sectorCfg();
  if(!cfg.stock) return [];
  const ids = scopeMagasinIds();
  const relevantMagasins = ids ? state.magasins.filter(m=>ids.includes(m.id)) : state.magasins;
  return state.products.filter(p => relevantMagasins.some(m => magasinStock(p, m.id) <= p.minStock));
}
export function magasinInUse(id){
  return state.invoices.some(i=>i.magasinId===id) || state.devis.some(d=>d.magasinId===id) ||
    state.purchases.some(p=>p.magasinId===id) || state.treasury.some(t=>t.magasinId===id) ||
    state.products.some(p=>p.stockByMagasin && (p.stockByMagasin[id]||0)>0);
}
/* Vérification de disponibilité de stock avant une sortie (vente, avoir fournisseur
   avec retour physique...). Extrait ici depuis le bloc Ventes d'origine (lignes
   2087-2104) car ce sont des utilitaires génériques réutilisés par Ventes ET Achats. */
export function stockShortfalls(neededByProduct, magasinId){
  const shortfalls = [];
  Object.entries(neededByProduct).forEach(([pid, needed])=>{
    const p = state.products.find(x=>x.id===pid);
    if(p){
      const avail = magasinStock(p, magasinId);
      if(needed > avail) shortfalls.push(`${p.name} — demandé ${needed}, disponible ${avail} à ${magasinName(magasinId)}`);
    }
  });
  return shortfalls;
}
/* renvoie true si l'opération peut continuer, false si elle doit être annulée (bloquée ou refusée par l'utilisateur) */
export function confirmOrBlockStock(shortfalls){
  if(!shortfalls.length) return true;
  if(state.settings.blockNegativeStock){
    alert("Stock insuffisant pour :\n- " + shortfalls.join("\n- ") + "\n\nLa vente est bloquée car l'option « Bloquer les ventes en cas de stock insuffisant » est activée dans Paramètres.");
    return false;
  }
  return confirm("Stock insuffisant pour :\n- " + shortfalls.join("\n- ") + "\n\nContinuer quand même ? Le stock affichera un déficit jusqu'au réapprovisionnement.");
}
/* Options <option> pour un <select> de magasin. Utilisé par Treasury, Purchases
   et Sales (extrait ici depuis le bloc Ventes d'origine, ligne 2050, car c'est
   un utilitaire générique, pas une fonction propre aux ventes). */
export function magasinSelectOptions(selectedId){
  return state.magasins.map(m=>`<option value="${m.id}" ${m.id===selectedId?'selected':''}>${esc(m.name)}</option>`).join('');
}
