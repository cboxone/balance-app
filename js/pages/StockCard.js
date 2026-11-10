/* ==========================================================
   pages/StockCard.js — Fiche de Stock (historique des mouvements d'un article)
   Extrait des lignes 1647-1762 du fichier d'origine (goToStockCard vit
   dans pages/Products.js, qui l'appelle avant que ce module n'existe).
   Même pattern de migration que pages/Clients.js (voir sa note d'en-tête).
   ========================================================== */
import { state } from '../core/state.js';
import { todayISO, addDaysISO, fmtMoney, fmtDate, esc, downloadCSV } from '../core/utils.js';
import { stockMovementsWithBalance, stockMovementTypeLabel } from '../core/audit.js';
import { totalStock, isLow, magasinName, multiMagasin } from '../core/sites.js';

export function renderStockCard(){
  const pid = window.__stockCardProduct || '';
  const products = [...state.products].sort((a,b)=>a.name.localeCompare(b.name));
  return `
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-body" style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;">
        <div class="field" style="max-width:380px;flex:1;margin:0;">
          <label>Choisir un article</label>
          <select onchange="window.__stockCardProduct=this.value; window.__cardStart=''; window.__cardEnd=''; window.__cardMagasin=''; window.renderLayout();">
            <option value="">— Sélectionner un article —</option>
            ${products.map(p=>`<option value="${p.id}" ${pid===p.id?'selected':''}>${esc(p.name)}${p.category?' · '+esc(p.category):''}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    ${pid && state.products.some(p=>p.id===pid) ? renderStockCardContent(pid) : `
      <div class="panel"><div class="panel-body">
        <div class="empty" style="padding:36px 0;">
          <div class="display">Sélectionnez un article</div>
          Choisissez un article ci-dessus pour consulter sa fiche de stock : historique complet des mouvements, entrées/sorties sur une période choisie, et solde à une date donnée — utile pour vos contrôles, inventaires et bilans de stock.
        </div>
      </div></div>
    `}
  `;
}

function renderStockCardContent(id){
  const p = state.products.find(x=>x.id===id);
  if(!p) return '';
  const magasinFilter = window.__cardMagasin || '';
  const start = window.__cardStart || '';
  const end = window.__cardEnd || todayISO();
  const allMoves = stockMovementsWithBalance(id, magasinFilter||null); // chronologique, avec solde courant
  const stockInitial = allMoves.filter(m=>start && m.date<start).reduce((s,m)=>s+m.qty,0);
  const inPeriod = allMoves.filter(m=>(!start||m.date>=start) && (!end||m.date<=end));
  const entrees = inPeriod.filter(m=>m.qty>0).reduce((s,m)=>s+m.qty,0);
  const sorties = -inPeriod.filter(m=>m.qty<0).reduce((s,m)=>s+m.qty,0);
  const stockFinal = stockInitial + entrees - sorties;
  const moves = [...inPeriod].reverse();
  const valeurStock = totalStock(p) * (p.cost||0);
  const presetBtn = (pr,l)=>`<button class="btn btn-sm btn-ghost" onclick="setCardRange('${pr}')">${l}</button>`;
  return `
    <div style="font-size:.85rem;color:var(--ink-soft);margin-bottom:14px;line-height:1.6;">
      <strong style="color:var(--ink);font-size:1rem;">${esc(p.name)}</strong> — ${esc(p.category)||'Sans catégorie'} · Unité : ${esc(p.unit)} · Coût unitaire : ${fmtMoney(p.cost)} · Prix de vente : ${fmtMoney(p.price)}
    </div>
    <div class="grid-kpi" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px;">
      <div class="kpi"><div class="kpi-label">Stock total (à ce jour)</div><div class="kpi-value">${totalStock(p)} ${esc(p.unit)}</div></div>
      <div class="kpi"><div class="kpi-label">Valeur du stock (au coût)</div><div class="kpi-value">${fmtMoney(valeurStock)}</div></div>
      <div class="kpi"><div class="kpi-label">Seuil d'alerte</div><div class="kpi-value" style="${isLow(p)?'color:var(--rust);':''}">${p.minStock} ${esc(p.unit)}</div></div>
    </div>
    <div class="panel" style="margin-bottom:14px;">
      <div class="panel-body" style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;">
        <div class="field" style="max-width:160px;margin:0;"><label>Du</label><input type="date" value="${start}" onchange="window.__cardStart=this.value; window.renderLayout();"></div>
        <div class="field" style="max-width:160px;margin:0;"><label>Au</label><input type="date" value="${end}" onchange="window.__cardEnd=this.value; window.renderLayout();"></div>
        ${presetBtn('7j','7 derniers jours')}${presetBtn('month','Ce mois')}${presetBtn('all',"Tout l'historique")}
        ${multiMagasin() ? `
        <div class="field" style="max-width:220px;margin:0;"><label>Magasin</label>
          <select onchange="window.__cardMagasin=this.value; window.renderLayout();">
            <option value="">Tous les magasins</option>
            ${state.magasins.map(m=>`<option value="${m.id}" ${magasinFilter===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}
          </select>
        </div>` : ''}
        <div style="flex:1;"></div>
        <button class="btn btn-sm btn-ghost" onclick="exportProductCardCSV('${id}')">Exporter CSV</button>
        <button class="btn btn-sm btn-ghost" onclick="openProductModal('${id}')">Modifier l'article</button>
      </div>
    </div>
    <div class="grid-kpi" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px;">
      <div class="kpi" style="background:var(--bg);"><div class="kpi-label">Stock initial${start?'':' (aucune date de début)'}</div><div class="kpi-value" style="font-size:1rem;">${stockInitial} ${esc(p.unit)}</div></div>
      <div class="kpi" style="background:var(--bg);"><div class="kpi-label">Entrées période</div><div class="kpi-value" style="font-size:1rem;color:var(--sage);">+${entrees} ${esc(p.unit)}</div></div>
      <div class="kpi" style="background:var(--bg);"><div class="kpi-label">Sorties période</div><div class="kpi-value" style="font-size:1rem;color:var(--rust);">-${sorties} ${esc(p.unit)}</div></div>
      <div class="kpi" style="background:var(--bg);"><div class="kpi-label">Stock final (au ${fmtDate(end)})</div><div class="kpi-value" style="font-size:1rem;">${stockFinal} ${esc(p.unit)}</div></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Mouvements du ${start?fmtDate(start):'début'} au ${fmtDate(end)}</h3></div>
      <div class="panel-body" style="padding:0;">
        ${moves.length ? `<div style="max-height:440px;overflow:auto;">
          <table><thead><tr><th>Date</th><th>Type</th>${multiMagasin()&&!magasinFilter?'<th>Magasin</th>':''}<th>Référence</th><th>Effectué par</th><th class="tright">Quantité</th><th class="tright">Solde</th></tr></thead><tbody>
            ${moves.map(m=>`<tr>
              <td>${fmtDate(m.date)}</td>
              <td><span class="badge badge-neutral">${esc(stockMovementTypeLabel(m.type))}</span></td>
              ${multiMagasin()&&!magasinFilter?`<td>${m.magasinId?esc(magasinName(m.magasinId)):'—'}</td>`:''}
              <td style="font-size:.8rem;">${esc(m.label)}</td>
              <td style="font-size:.8rem;">${esc(m.userName||'—')}</td>
              <td class="tright mono" style="${m.qty<0?'color:var(--rust);':'color:var(--sage);'}">${m.qty>0?'+':''}${m.qty}</td>
              <td class="tright mono">${m.balanceAfter}</td>
            </tr>`).join('')}
          </tbody></table>
        </div>` : `<div class="empty" style="padding:20px 0;">Aucun mouvement enregistré sur cette période. Les ventes, achats, avoirs et corrections d'inventaire apparaîtront ici automatiquement.</div>`}
      </div>
    </div>
    <p style="font-size:.76rem;color:var(--ink-soft);margin-top:14px;">Le solde affiché à droite tient compte de tout l'historique de l'article (pas seulement de la période sélectionnée), utile pour un contrôle ou un inventaire à une date donnée.</p>
  `;
}

export function setCardRange(preset){
  const today = todayISO();
  if(preset==='7j'){ window.__cardStart = addDaysISO(today,-7); window.__cardEnd = today; }
  else if(preset==='month'){ window.__cardStart = today.slice(0,8)+'01'; window.__cardEnd = today; }
  else if(preset==='all'){ window.__cardStart = ''; window.__cardEnd = today; }
  window.renderLayout();
}

export function exportProductCardCSV(id){
  const p = state.products.find(x=>x.id===id);
  if(!p) return;
  const magasinFilter = window.__cardMagasin || '';
  const start = window.__cardStart || '';
  const end = window.__cardEnd || todayISO();
  const moves = stockMovementsWithBalance(id, magasinFilter||null).filter(m=>(!start||m.date>=start) && (!end||m.date<=end));
  downloadCSV(`fiche-stock-${p.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.csv`,
    ['Date','Type','Magasin','Référence','Effectué par','Quantité','Solde après'],
    moves.map(m=>[m.date, stockMovementTypeLabel(m.type), m.magasinId?magasinName(m.magasinId):'Tous', m.label, m.userName||'—', m.qty, m.balanceAfter]));
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { setCardRange, exportProductCardCSV });
