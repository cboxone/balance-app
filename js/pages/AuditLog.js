/* ==========================================================
   pages/AuditLog.js — journal d'audit (consultation)
   Extrait des lignes 4747-4812 du fichier d'origine.
   ========================================================== */
import { state } from '../core/state.js';
import { todayISO, fmtDate, esc, downloadCSV } from '../core/utils.js';
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from '../core/audit.js';

export function renderAuditLog(){
  const entityFilter = window.__auditEntity || '';
  const userFilter = window.__auditUser || '';
  const start = window.__auditStart || '';
  const end = window.__auditEnd || todayISO();
  const entries = [...(state.auditLog||[])]
    .filter(e=>(!start||e.date>=start) && (!end||e.date<=end))
    .filter(e=>!entityFilter || e.entity===entityFilter)
    .filter(e=>!userFilter || e.userId===userFilter)
    .sort((a,b)=> b.time.localeCompare(a.time));
  const usersInLog = [...new Map((state.auditLog||[]).map(e=>[e.userId, e.userName])).entries()];
  return `
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-body" style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;">
        <div class="field" style="max-width:160px;margin:0;"><label>Du</label><input type="date" value="${start}" onchange="window.__auditStart=this.value; renderLayout();"></div>
        <div class="field" style="max-width:160px;margin:0;"><label>Au</label><input type="date" value="${end}" onchange="window.__auditEnd=this.value; renderLayout();"></div>
        <div class="field" style="max-width:180px;margin:0;"><label>Type</label>
          <select onchange="window.__auditEntity=this.value; renderLayout();">
            <option value="">Tous</option>
            ${Object.entries(AUDIT_ENTITY_LABELS).map(([k,l])=>`<option value="${k}" ${entityFilter===k?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>
        <div class="field" style="max-width:200px;margin:0;"><label>Utilisateur</label>
          <select onchange="window.__auditUser=this.value; renderLayout();">
            <option value="">Tous</option>
            ${usersInLog.map(([id,name])=>`<option value="${id||''}" ${userFilter===id?'selected':''}>${esc(name)}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1;"></div>
        <button class="btn btn-sm btn-ghost" onclick="exportAuditLogCSV()">Exporter CSV</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        ${entries.length ? `<div style="max-height:560px;overflow:auto;">
          <table><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Type</th><th>Élément</th><th>Détail des changements</th></tr></thead><tbody>
            ${entries.map(e=>`<tr>
              <td style="white-space:nowrap;">${fmtDate(e.date)}</td>
              <td>${esc(e.userName)}</td>
              <td><span class="badge ${e.action==='suppression'?'badge-neutral':'badge-good'}">${AUDIT_ACTION_LABELS[e.action]||e.action}</span></td>
              <td>${AUDIT_ENTITY_LABELS[e.entity]||e.entity}</td>
              <td>${esc(e.entityLabel)}</td>
              <td style="font-size:.78rem;">${e.changes && e.changes.length ? e.changes.map(c=>`${esc(c.field)} : « ${esc(c.from)||'—'} » → « ${esc(c.to)||'—'} »`).join('<br>') : '—'}</td>
            </tr>`).join('')}
          </tbody></table>
        </div>` : `<div class="empty" style="padding:30px 0;"><div class="display">Aucune activité enregistrée</div>Les créations, modifications et suppressions de clients, fournisseurs, articles, utilisateurs et paramètres apparaîtront ici automatiquement.</div>`}
      </div>
    </div>
    <p style="font-size:.76rem;color:var(--ink-soft);margin-top:14px;">Trace toutes les créations, modifications (avec l'ancienne et la nouvelle valeur) et suppressions sur les clients, fournisseurs, articles, utilisateurs et paramètres. Les mouvements de stock ont leur propre historique détaillé dans la Fiche de Stock de chaque article.</p>
  `;
}

export function exportAuditLogCSV(){
  const entityFilter = window.__auditEntity || '';
  const userFilter = window.__auditUser || '';
  const start = window.__auditStart || '';
  const end = window.__auditEnd || todayISO();
  const entries = [...(state.auditLog||[])]
    .filter(e=>(!start||e.date>=start) && (!end||e.date<=end))
    .filter(e=>!entityFilter || e.entity===entityFilter)
    .filter(e=>!userFilter || e.userId===userFilter)
    .sort((a,b)=> b.time.localeCompare(a.time));
  downloadCSV('journal-audit.csv',
    ['Date','Utilisateur','Action','Type','Élément','Changements'],
    entries.map(e=>[e.date, e.userName, AUDIT_ACTION_LABELS[e.action]||e.action, AUDIT_ENTITY_LABELS[e.entity]||e.entity, e.entityLabel,
      (e.changes||[]).map(c=>`${c.field}: "${c.from||'—'}" -> "${c.to||'—'}"`).join(' | ')]));
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { exportAuditLogCSV });
