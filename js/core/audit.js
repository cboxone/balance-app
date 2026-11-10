/* ==========================================================
   core/audit.js — journal d'audit + historique des mouvements de stock
   Extrait des lignes 744-785 du fichier d'origine (STOCK_MOVEMENT_LABELS
   vit dans core/constants.js, importé ici plutôt que redéclaré).
   ========================================================== */
import { state, currentUser } from './state.js';
import { uid, todayISO } from './utils.js';
import { STOCK_MOVEMENT_LABELS } from './constants.js';

export function logAudit(action, entity, entityId, entityLabel, changes){
  state.auditLog = state.auditLog || [];
  state.auditLog.push({
    id:uid('aud'), date:todayISO(), time:new Date().toISOString(),
    userId: currentUser?currentUser.id:null, userName: currentUser?currentUser.name:'Système',
    action, entity, entityId, entityLabel:entityLabel||'', changes: changes||[]
  });
  if(state.auditLog.length>3000) state.auditLog = state.auditLog.slice(-3000);
}
/* Compare deux objets sur un ensemble de champs (labels = {champ: "Libellé affiché"}) et renvoie la liste des changements. */
export function diffFields(before, after, labels){
  const changes = [];
  Object.keys(labels).forEach(key=>{
    const a = before ? before[key] : undefined;
    const b = after[key];
    const av = a==null?'':String(a), bv = b==null?'':String(b);
    if(av!==bv) changes.push({field:labels[key], from:av, to:bv});
  });
  return changes;
}
export const AUDIT_ACTION_LABELS = { creation:"Création", modification:"Modification", suppression:"Suppression" };
export const AUDIT_ENTITY_LABELS = { client:"Client", fournisseur:"Fournisseur", produit:"Article", parametres:"Paramètres", utilisateur:"Utilisateur" };
/* ---------------- mouvements de stock (fiches de stock) ---------------- */
export function logStockMovement(date, productId, magasinId, qty, type, label, refType, refId){
  if(!productId || Math.abs(qty||0)<0.5) return;
  state.stockMovements.push({id:uid('mvt'), date:date||todayISO(), productId, magasinId:magasinId||null, qty:Math.round(qty), type, label:label||"", refType:refType||null, refId:refId||null, userId: currentUser?currentUser.id:null, userName: currentUser?currentUser.name:"—"});
}
export function removeStockMovements(refType, refId){
  state.stockMovements = state.stockMovements.filter(m=>!(m.refType===refType && m.refId===refId));
}
export function stockMovementTypeLabel(t){ return STOCK_MOVEMENT_LABELS[t] || t; }
export function stockMovementsWithBalance(productId, magasinId){
  const moves = state.stockMovements.filter(m=>m.productId===productId && (!magasinId || m.magasinId===magasinId)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const runningByMagasin = {};
  return moves.map(m=>{
    const key = m.magasinId||'__all__';
    const after = (runningByMagasin[key]||0) + m.qty;
    runningByMagasin[key] = after;
    return {...m, balanceAfter:after};
  });
}
