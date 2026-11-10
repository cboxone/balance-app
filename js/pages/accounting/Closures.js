/* ==========================================================
   pages/accounting/Closures.js — clôture d'exercice comptable
   Extrait des lignes 4338-4390 du fichier d'origine.
   ========================================================== */
import { state, saveState } from '../../core/state.js';
import { todayISO, fmtMoney, fmtDate, esc } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { renderLayout } from '../../components/Layout.js';
import { lastClosureDate, previewClosure, closeFiscalPeriod } from '../../core/accounting-engine.js';

export function renderClosuresTab(){
  const since = lastClosureDate();
  const defaultEnd = todayISO();
  const history = [...state.fiscalClosures].sort((a,b)=>b.endDate.localeCompare(a.endDate));
  return `
    <div class="panel" style="max-width:640px;">
      <div class="panel-head"><h3>Clôturer l'exercice en cours</h3></div>
      <div class="panel-body">
        <p style="font-size:.82rem;color:var(--ink-soft);margin-top:0;">Clôturer fige définitivement toutes les écritures jusqu'à la date choisie : elles ne pourront plus être modifiées ni supprimées. Le résultat de la période (produits − charges) est calculé et enregistré, puis les comptes de charges et de produits repartent de zéro pour le nouvel exercice. <strong>Cette action est irréversible.</strong></p>
        <p style="font-size:.82rem;">Période à clôturer : <strong>${since?'du '+fmtDate(since):'depuis le début'}</strong> au <strong id="cl-end-label">${fmtDate(defaultEnd)}</strong></p>
        <div class="field" style="max-width:220px;"><label>Date de clôture</label><input id="cl-end-date" type="date" value="${defaultEnd}" onchange="updateClosurePreview()"></div>
        <div id="cl-preview" style="margin-top:10px;padding:12px 14px;background:var(--surface-2);border-radius:8px;font-size:.85rem;"></div>
        <button class="btn btn-danger" style="margin-top:14px;" onclick="performClosure()">Clôturer l'exercice</button>
      </div>
    </div>
    <div class="panel" style="max-width:640px;margin-top:16px;">
      <div class="panel-head"><h3>Historique des clôtures</h3></div>
      <div class="panel-body" style="padding:0;">
        ${history.length ? `<table><thead><tr><th>Période</th><th>Clôturé le</th><th>Par</th><th class="tright">Résultat</th></tr></thead><tbody>
          ${history.map(c=>`<tr>
            <td>${c.startDate?'du '+fmtDate(c.startDate)+' au ':"jusqu'au "}${fmtDate(c.endDate)}</td>
            <td>${fmtDate(c.closedAt.slice(0,10))}</td>
            <td>${esc(c.closedBy)}</td>
            <td class="tright mono" style="${c.resultat<0?'color:var(--rust);':'color:var(--sage);'}">${fmtMoney(c.resultat)}</td>
          </tr>`).join('')}
        </tbody></table>` : `<div class="empty"><div class="display">Aucune clôture effectuée</div>Toutes les écritures sont modifiables tant qu'aucun exercice n'a été clôturé.</div>`}
      </div>
    </div>
  `;
}

export function updateClosurePreview(){
  const end = document.getElementById('cl-end-date').value;
  document.getElementById('cl-end-label').textContent = fmtDate(end);
  const since = lastClosureDate();
  const el = document.getElementById('cl-preview');
  if(since && end<=since){ el.innerHTML = `<span style="color:var(--rust);">Cette date est antérieure ou égale à la dernière clôture (${fmtDate(since)}).</span>`; return; }
  const preview = previewClosure(end);
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;"><span>Comptes de charges/produits concernés</span><span class="mono">${preview.accountsTouched}</span></div>
    <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:6px;padding-top:6px;border-top:1px dashed var(--line-strong);color:${preview.resultat>=0?'var(--sage)':'var(--rust)'};"><span>Résultat de la période</span><span class="mono">${fmtMoney(preview.resultat)}</span></div>
  `;
}

export function performClosure(){
  const end = document.getElementById('cl-end-date').value;
  if(!end){ showToast("Choisissez une date de clôture"); return; }
  const since = lastClosureDate();
  if(since && end<=since){ showToast("La date doit être postérieure à la dernière clôture ("+fmtDate(since)+")"); return; }
  const preview = previewClosure(end);
  if(!confirm(`Clôturer l'exercice jusqu'au ${fmtDate(end)} ?\n\nRésultat calculé : ${fmtMoney(preview.resultat)}\n\nCette action verrouille définitivement toutes les écritures de cette période. Continuer ?`)) return;
  const result = closeFiscalPeriod(end);
  if(!result.ok){ showToast(result.reason); return; }
  saveState(); renderLayout(); showToast("Exercice clôturé — résultat : "+fmtMoney(result.resultat));
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { updateClosurePreview, performClosure });
