/* ==========================================================
   pages/accounting/Reports.js — Balance générale, Compte de résultat,
   Bilan simplifié.
   Extrait des lignes 4063-4157 du fichier d'origine.
   ========================================================== */
import { fmtMoney, fmtDate, esc } from '../../core/utils.js';
import { trialBalance, lastClosureDate } from '../../core/accounting-engine.js';

export function renderBalanceTab(){
  const rows = trialBalance();
  const totalDebit = rows.reduce((s,r)=>s+r.debit,0);
  const totalCredit = rows.reduce((s,r)=>s+r.credit,0);
  return `
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        ${rows.length ? `<table><thead><tr><th>Compte</th><th>Libellé</th><th class="tright">Débit</th><th class="tright">Crédit</th><th class="tright">Solde</th></tr></thead><tbody>
          ${rows.map(r=>`<tr>
            <td class="mono">${r.code}</td><td>${esc(r.name)}</td>
            <td class="tright mono">${fmtMoney(r.debit)}</td>
            <td class="tright mono">${fmtMoney(r.credit)}</td>
            <td class="tright mono" style="${r.balance<0?'color:var(--rust);':''}">${fmtMoney(r.balance)}</td>
          </tr>`).join('')}
          <tr style="font-weight:700;"><td colspan="2">Total</td><td class="tright mono">${fmtMoney(totalDebit)}</td><td class="tright mono">${fmtMoney(totalCredit)}</td><td></td></tr>
        </tbody></table>` : `<div class="empty"><div class="display">Aucune donnée</div></div>`}
      </div>
    </div>
  `;
}

export function renderResultTab(){
  const since = lastClosureDate();
  const rows = trialBalance(since);
  const produits = rows.filter(r=>r.code.startsWith('7'));
  const charges = rows.filter(r=>r.code.startsWith('6'));
  const totalProduits = produits.reduce((s,r)=>s-r.balance,0);
  const totalCharges = charges.reduce((s,r)=>s+r.balance,0);
  const resultat = totalProduits - totalCharges;
  return `
    <p style="font-size:.78rem;color:var(--ink-soft);margin:-4px 0 12px;">Exercice en cours ${since?`— depuis le ${fmtDate(since)} (dernière clôture)`:'— depuis le début (aucune clôture effectuée)'}.</p>
    <div class="grid-kpi" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px;">
      <div class="kpi"><div class="kpi-label">Total produits</div><div class="kpi-value" style="color:var(--sage);">${fmtMoney(totalProduits)}</div></div>
      <div class="kpi"><div class="kpi-label">Total charges</div><div class="kpi-value" style="color:var(--rust);">${fmtMoney(totalCharges)}</div></div>
      <div class="kpi"><div class="kpi-label">Résultat</div><div class="kpi-value" style="color:${resultat>=0?'var(--sage)':'var(--rust)'};">${fmtMoney(resultat)}</div></div>
    </div>
    <div class="two-col">
      <div class="panel">
        <div class="panel-head"><h3>Produits (classe 7)</h3></div>
        <div class="panel-body" style="padding:0;">
          ${produits.length ? `<table><tbody>${produits.map(r=>`<tr><td class="mono" style="padding:8px 12px;">${r.code}</td><td style="padding:8px 12px;">${esc(r.name)}</td><td class="tright mono" style="padding:8px 12px;">${fmtMoney(-r.balance)}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">Aucun produit enregistré.</div>`}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Charges (classe 6)</h3></div>
        <div class="panel-body" style="padding:0;">
          ${charges.length ? `<table><tbody>${charges.map(r=>`<tr><td class="mono" style="padding:8px 12px;">${r.code}</td><td style="padding:8px 12px;">${esc(r.name)}</td><td class="tright mono" style="padding:8px 12px;">${fmtMoney(r.balance)}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">Aucune charge enregistrée.</div>`}
        </div>
      </div>
    </div>
    <p style="font-size:.76rem;color:var(--ink-soft);margin-top:14px;">Résultat cumulé depuis la première écriture. Les dotations aux amortissements (compte 681) sont incluses dans les charges si vous les avez générées depuis l'onglet Immobilisations. Ce compte de résultat simplifié ne tient pas compte des provisions.</p>
  `;
}

export function renderSheetTab(){
  const rows = trialBalance();
  const bal = (code)=> (rows.find(r=>r.code===code)||{balance:0}).balance;
  const stockValue = Math.max(0, bal('311'));
  const clients = bal('411');
  const tresorerie = bal('512')+bal('571')+bal('5711');
  const immobBrut = rows.filter(r=>r.code.startsWith('2') && !r.code.startsWith('28')).reduce((s,r)=>s+Math.max(0,r.balance),0);
  const amortCumule = rows.filter(r=>r.code.startsWith('28')).reduce((s,r)=>s+Math.max(0,-r.balance),0);
  const immobNet = Math.max(0, immobBrut-amortCumule);
  const actifTotal = Math.max(0,clients) + Math.max(0,tresorerie) + stockValue + immobNet;
  const fournisseurs = -bal('401');
  const produits = rows.filter(r=>r.code.startsWith('7')).reduce((s,r)=>s-r.balance,0);
  const charges = rows.filter(r=>r.code.startsWith('6')).reduce((s,r)=>s+r.balance,0);
  const resultat = produits-charges;
  const capital = -bal('101');
  const emprunts = -bal('164');
  const passifTotal = Math.max(0,fournisseurs) + Math.max(0,capital) + Math.max(0,emprunts) + resultat;
  return `
    <div class="two-col">
      <div class="panel">
        <div class="panel-head"><h3>Actif</h3></div>
        <div class="panel-body">
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);"><span>Stock valorisé (au coût)</span><span class="mono">${fmtMoney(stockValue)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);"><span>Clients (411)</span><span class="mono">${fmtMoney(Math.max(0,clients))}</span></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);"><span>Trésorerie (Caisse + Banques)</span><span class="mono">${fmtMoney(Math.max(0,tresorerie))}</span></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);"><span>Immobilisations nettes (classe 2)</span><span class="mono">${fmtMoney(immobNet)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:700;"><span>Total actif</span><span class="mono">${fmtMoney(actifTotal)}</span></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Passif</h3></div>
        <div class="panel-body">
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);"><span>Capital (101)</span><span class="mono">${fmtMoney(Math.max(0,capital))}</span></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);"><span>Emprunts (164)</span><span class="mono">${fmtMoney(Math.max(0,emprunts))}</span></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);"><span>Fournisseurs (401)</span><span class="mono">${fmtMoney(Math.max(0,fournisseurs))}</span></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);"><span>Résultat de l'exercice</span><span class="mono" style="${resultat<0?'color:var(--rust);':''}">${fmtMoney(resultat)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:700;"><span>Total passif</span><span class="mono">${fmtMoney(passifTotal)}</span></div>
        </div>
      </div>
    </div>
    <p style="font-size:.76rem;color:var(--ink-soft);margin-top:14px;">Bilan simplifié : les immobilisations apparaissent nettes des amortissements comptabilisés (onglet Immobilisations) ; ne comprend pas les provisions. Fourni à titre indicatif — à faire établir par un expert-comptable pour tout usage officiel (dépôt légal, banque, administration fiscale).</p>
  `;
}
