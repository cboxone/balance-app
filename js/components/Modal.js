/* ==========================================================
   components/Modal.js — modale générique réutilisée par tous les modules
   (chaque page continue de fournir son propre innerHTML de contenu ;
   ce composant ne gère que l'ouverture/fermeture de l'overlay)
   Extrait des lignes 4984-4987 du fichier d'origine.
   ========================================================== */
export function openModal(){ document.getElementById('modal-overlay').classList.add('open'); }
export function closeModal(){ document.getElementById('modal-overlay').classList.remove('open'); }
