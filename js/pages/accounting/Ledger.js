/* ==========================================================
   pages/accounting/Ledger.js — grand livre + lettrage manuel
   Extrait des lignes 3748-3841 du fichier d'origine.
   ========================================================== */
import { state, saveState } from '../../core/state.js';
import { fmtMoney, fmtDate, esc } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { renderLayout } from '../../components/Layout.js';
import { accountMovements, manualLettre } from '../../core/accounting-engine.js';

export function toggleLedgerLetterSelection(entryId, lineIdx){
  window.__letterSelection = window.__letterSelection || new Set();
  const key = entryId+':'+lineIdx;
  if(window.__letterSelection.has(key)) window.__letterSelection.delete(key);
  else window.__letterSelection.add(key);
  renderLayout();
}
export function applyManualLettrage(){
  const sel = window.__letterSelection;
  if(!sel || sel.size<2){ showToast("Sélectionnez au moins deux mouvements à lettrer ensemble"); return; }
  let totalDebit=0, totalCredit=0;
  const targets = [];
  sel.forEach(key=>{
    const [entryId, idx] = key.split(':');
    const entry = state.journalEntries.find(e=>e.id===entryId);
    if(!entry) return;
    const line = entry.lines[Number(idx)];
    if(!line) return;
    totalDebit += line.debit||0; totalCredit += line.credit||0;
    targets.push(line);
  });
  if(Math.abs(totalDebit-totalCredit) > 0.5){ showToast("La sélection ne s'équilibre pas (débit "+fmtMoney(totalDebit)+" ≠ crédit "+fmtMoney(totalCredit)+")"); return; }
  const letter = manualLettre();
  targets.forEach(l=>{ l.lettre = letter; });
  window.__letterSelection = new Set();
  saveState(); renderLayout(); showToast("Mouvements lettrés ("+letter+")");
}
export function removeLetter(letter){
  if(!confirm("Retirer le lettrage "+letter+" ? Les mouvements redeviendront non rapprochés.")) return;
  state.journalEntries.forEach(e=>e.lines.forEach(l=>{ if(l.lettre===letter) l.lettre=null; }));
  saveState(); renderLayout(); showToast("Lettrage retiré");
}
export function letterGroupBalanced(letter){
  if(!letter) return false;
  let d=0,c=0;
  state.journalEntries.forEach(e=>e.lines.forEach(l=>{ if(l.lettre===letter){ d+=l.debit||0; c+=l.credit||0; } }));
  return Math.abs(d-c)<0.5;
}

export function renderLedgerTab(){
  const accounts = state.chartOfAccounts.filter(a=>state.journalEntries.some(e=>e.lines.some(l=>l.account===a.code)));
  const selected = window.__ledgerAccount || (accounts[0] && accounts[0].code);
  const allMoves = selected ? accountMovements(selected) : [];
  const tiersMap = new Map();
  allMoves.forEach(m=>{ if(m.tiers) tiersMap.set(m.tiers.id, m.tiers.name); });
  const hasTiers = tiersMap.size>0;
  const selectedTiers = hasTiers ? (window.__ledgerTiers||'') : '';
  const moves = selectedTiers ? accountMovements(selected, selectedTiers) : allMoves;
  const lettrable = (selected==='411' || selected==='401') && !!selectedTiers;
  let running = 0;
  return `
    <div class="toolbar">
      <select style="max-width:340px;" onchange="window.__ledgerAccount=this.value; window.__ledgerTiers=''; window.__letterSelection=new Set(); renderLayout();">
        ${accounts.map(a=>`<option value="${a.code}" ${a.code===selected?'selected':''}>${a.code} — ${esc(a.name)}</option>`).join('')}
      </select>
      ${hasTiers ? `<select style="max-width:280px;" onchange="window.__ledgerTiers=this.value; window.__letterSelection=new Set(); renderLayout();">
        <option value="">Tous les tiers (compte collectif)</option>
        ${[...tiersMap.entries()].sort((a,b)=>a[1].localeCompare(b[1])).map(([id,name])=>`<option value="${id}" ${id===selectedTiers?'selected':''}>${esc(name)}</option>`).join('')}
      </select>` : ''}
    </div>
    ${hasTiers && !selectedTiers ? `<p style="font-size:.76rem;color:var(--ink-soft);margin:-4px 0 12px;">Ce compte regroupe plusieurs clients/fournisseurs. Sélectionnez un tiers pour obtenir son relevé individuel (grand livre auxiliaire), ou consultez la balance auxiliaire ci-dessous.</p>
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-head"><h3>Balance auxiliaire</h3></div>
      <div class="panel-body" style="padding:0;">
        <table><thead><tr><th>Tiers</th><th class="tright">Solde</th></tr></thead><tbody>
          ${[...tiersMap.entries()].sort((a,b)=>a[1].localeCompare(b[1])).map(([id,name])=>{
            const bal = accountMovements(selected, id).reduce((s,m)=>s+m.debit-m.credit,0);
            return `<tr><td><button class="icon-btn" style="border:none;padding:0;font-weight:600;color:var(--indigo);background:none;" onclick="window.__ledgerTiers='${id}'; renderLayout();">${esc(name)}</button></td><td class="tright mono">${fmtMoney(bal)}</td></tr>`;
          }).join('')}
        </tbody></table>
      </div>
    </div>` : ''}
    ${lettrable ? `<div class="toolbar" style="margin-bottom:10px;">
      <button class="btn btn-ghost btn-sm" onclick="applyManualLettrage()">Lettrer la sélection</button>
      <span style="font-size:.76rem;color:var(--ink-soft);">Cochez des mouvements dont le total débit = total crédit pour les lettrer manuellement (utile pour un solde d'ouverture ou un cas particulier — le reste se lettre automatiquement).</span>
    </div>` : ''}
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        ${moves.length ? `<table><thead><tr>${lettrable?'<th></th>':''}<th>Date</th><th>Réf.</th><th>Libellé</th><th class="tright">Débit</th><th class="tright">Crédit</th><th class="tright">Solde</th>${lettrable?'<th>Lettre</th>':''}</tr></thead><tbody>
          ${moves.map(m=>{ running += m.debit-m.credit;
            const key = m.entryId+':'+m.lineIdx;
            const checked = window.__letterSelection && window.__letterSelection.has(key);
            return `<tr>
            ${lettrable?`<td>${m.lettre?'':`<input type="checkbox" ${checked?'checked':''} onchange="toggleLedgerLetterSelection('${m.entryId}',${m.lineIdx})" style="width:15px;height:15px;">`}</td>`:''}
            <td>${fmtDate(m.date)}</td><td class="mono">${m.ref}</td><td>${esc(m.label)}</td>
            <td class="tright mono">${m.debit?fmtMoney(m.debit):''}</td>
            <td class="tright mono">${m.credit?fmtMoney(m.credit):''}</td>
            <td class="tright mono">${fmtMoney(running)}</td>
            ${lettrable?`<td>${m.lettre?`<button class="badge ${letterGroupBalanced(m.lettre)?'badge-good':'badge-brass'}" style="border:none;cursor:pointer;" onclick="removeLetter('${m.lettre}')" title="${letterGroupBalanced(m.lettre)?'Soldé — cliquer pour délettrer':'En attente de solde — cliquer pour délettrer'}">${m.lettre}</button>`:'<span class="badge badge-neutral">non lettré</span>'}</td>`:''}
          </tr>`;}).join('')}
        </tbody></table>` : `<div class="empty"><div class="display">Aucun mouvement</div>Ce compte n'a encore aucune écriture.</div>`}
      </div>
    </div>
  `;
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { toggleLedgerLetterSelection, applyManualLettrage, removeLetter });
