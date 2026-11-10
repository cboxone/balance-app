/* ==========================================================
   core/accounting-engine.js — moteur comptable partie double
   (plan comptable, écritures, lettrage, balance, clôture d'exercice)
   Extrait des lignes 366-370 et 543-680 du fichier d'origine.
   numberToLetters()/addDaysISO() vivent dans core/utils.js — importés d'ici.
   ========================================================== */
import { state, currentUser } from './state.js';
import { uid, fmtDate, numberToLetters } from './utils.js';
import { showToast } from '../components/Toast.js';

export function treasuryAccountForMethod(method){
  if(method==='Mobile Money') return '5711';
  if(method==='Espèces') return '571';
  return '512'; // Virement, Chèque
}

export function accountName(code){ const a=state.chartOfAccounts.find(x=>x.code===code); return a?`${a.code} — ${a.name}`:code; }
export function accountShort(code){ const a=state.chartOfAccounts.find(x=>x.code===code); return a?a.name:code; }
export function nextJournalRef(journal){
  const n = state.journalEntries.filter(e=>e.journal===journal).length + 1;
  return journal+"-"+String(n).padStart(4,'0');
}
/* Enregistre une écriture équilibrée. lines: [{account, label, debit, credit}].
   Lève une alerte console (jamais visible utilisateur) si l'écriture ne s'équilibre pas,
   par sécurité de développement — ne bloque pas l'opération commerciale en cours. */
export function pushJournalEntry(journal, date, label, lines, generatedFrom){
  const totalDebit = lines.reduce((s,l)=>s+(l.debit||0),0);
  const totalCredit = lines.reduce((s,l)=>s+(l.credit||0),0);
  if(Math.abs(totalDebit-totalCredit) > 0.5){
    console.error("Écriture déséquilibrée, ignorée :", journal, label, lines);
    return;
  }
  state.journalEntries.push({
    id:uid('je'), ref:nextJournalRef(journal), journal, date, label,
    lines: lines.filter(l=>(l.debit||0)>0 || (l.credit||0)>0),
    generatedFrom: generatedFrom||null, createdBy: currentUser?currentUser.name:''
  });
}
export function accountMovements(code, tiersId, sinceDate){
  const moves = [];
  state.journalEntries.forEach(e=>{
    if(sinceDate && e.date<=sinceDate) return;
    e.lines.forEach((l,idx)=>{
      if(l.account!==code) return;
      if(tiersId && (!l.tiers || l.tiers.id!==tiersId)) return;
      moves.push({date:e.date, ref:e.ref, journal:e.journal, label:l.label||e.label, debit:l.debit||0, credit:l.credit||0, tiers:l.tiers||null, lettre:l.lettre||null, entryId:e.id, lineIdx:idx});
    });
  });
  return moves.sort((a,b)=>a.date.localeCompare(b.date));
}
export function accountBalance(code){
  const moves = accountMovements(code);
  return moves.reduce((s,m)=>s+m.debit-m.credit, 0);
}
export function removeGeneratedEntries(type, id){
  state.journalEntries = state.journalEntries.filter(e=>!(e.generatedFrom && e.generatedFrom.type===type && e.generatedFrom.id===id));
}
/* ---------------- clôture d'exercice ---------------- */
export function lastClosureDate(){
  if(!state.fiscalClosures.length) return null;
  return [...state.fiscalClosures].sort((a,b)=>b.endDate.localeCompare(a.endDate))[0].endDate;
}
export function isDateLocked(date){
  const lock = lastClosureDate();
  return !!(lock && date && date <= lock);
}
export function blockIfLocked(date){
  if(isDateLocked(date)){
    showToast("Impossible : cette date fait partie d'un exercice déjà clôturé (jusqu'au "+fmtDate(lastClosureDate())+").");
    return true;
  }
  return false;
}
/* Prévisualise le résultat de la période à clôturer sans rien enregistrer. */
export function previewClosure(endDate){
  const start = lastClosureDate();
  const inPeriod = e => (!start || e.date > start) && e.date <= endDate;
  const byAccount = {};
  state.journalEntries.filter(inPeriod).forEach(e=>{
    e.lines.forEach(l=>{
      if(l.account.startsWith('6') || l.account.startsWith('7')) byAccount[l.account] = (byAccount[l.account]||0) + (l.debit||0) - (l.credit||0);
    });
  });
  let resultat = 0;
  Object.entries(byAccount).forEach(([code,net])=>{
    if(code.startsWith('7')) resultat += -net; else resultat -= net;
  });
  return { start, resultat, accountsTouched: Object.keys(byAccount).length };
}
export function closeFiscalPeriod(endDate){
  const start = lastClosureDate();
  const inPeriod = e => (!start || e.date > start) && e.date <= endDate;
  const byAccount = {};
  state.journalEntries.filter(inPeriod).forEach(e=>{
    e.lines.forEach(l=>{
      if(l.account.startsWith('6') || l.account.startsWith('7')) byAccount[l.account] = (byAccount[l.account]||0) + (l.debit||0) - (l.credit||0);
    });
  });
  const lines = [];
  let resultat = 0;
  Object.entries(byAccount).forEach(([code,net])=>{
    if(Math.abs(net)<0.5) return;
    if(code.startsWith('7')) resultat += -net; else resultat -= net;
    if(net>0) lines.push({account:code, label:"Clôture d'exercice", debit:0, credit:net});
    else lines.push({account:code, label:"Clôture d'exercice", debit:-net, credit:0});
  });
  if(!lines.length) return {ok:false, reason:"Aucun mouvement de charge ou de produit sur cette période — rien à clôturer."};
  if(resultat>=0) lines.push({account:"120", label:"Résultat de l'exercice", debit:0, credit:resultat});
  else lines.push({account:"120", label:"Résultat de l'exercice (déficitaire)", debit:-resultat, credit:0});
  pushJournalEntry("CL", endDate, `Clôture de l'exercice au ${fmtDate(endDate)}`, lines, {type:'closure', id:uid('cls')});
  state.fiscalClosures.push({id:uid('fc'), endDate, startDate:start, closedAt:new Date().toISOString(), closedBy:currentUser.name, resultat});
  return {ok:true, resultat};
}

export function getOrCreateLettre(sourceType, sourceId){
  if(!state.letterMap) state.letterMap = {};
  const key = sourceType+':'+sourceId;
  if(state.letterMap[key]) return state.letterMap[key];
  state.letterCounter = (state.letterCounter||0) + 1;
  const letter = numberToLetters(state.letterCounter);
  state.letterMap[key] = letter;
  return letter;
}
export function manualLettre(){
  state.letterCounter = (state.letterCounter||0) + 1;
  return numberToLetters(state.letterCounter);
}

export function trialBalance(sinceDate){
  const codes = [...new Set(state.journalEntries.filter(e=>!sinceDate||e.date>sinceDate).flatMap(e=>e.lines.map(l=>l.account)))].sort();
  return codes.map(code=>{
    const moves = accountMovements(code, null, sinceDate);
    const debit = moves.reduce((s,m)=>s+m.debit,0);
    const credit = moves.reduce((s,m)=>s+m.credit,0);
    return {code, name:accountShort(code), debit, credit, balance:debit-credit};
  });
}
/* balance des comptes sur une période bornée [start, end] (utilisée par le bilan d'activité) */
export function periodTrialBalance(start, end){
  const inRange = e => (!start || e.date>=start) && (!end || e.date<=end);
  const entries = state.journalEntries.filter(inRange);
  const codes = [...new Set(entries.flatMap(e=>e.lines.map(l=>l.account)))].sort();
  return codes.map(code=>{
    let debit=0, credit=0;
    entries.forEach(e=>e.lines.forEach(l=>{ if(l.account===code){ debit+=l.debit||0; credit+=l.credit||0; } }));
    return {code, name:accountShort(code), debit, credit, balance:debit-credit};
  });
}
