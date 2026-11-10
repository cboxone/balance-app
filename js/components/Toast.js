/* ==========================================================
   components/Toast.js — notification toast en bas de l'écran
   Extrait des lignes 1053-1058 du fichier d'origine.
   ========================================================== */
let toastTimer;
export function showToast(msg){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2400);
}
