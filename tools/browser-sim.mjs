// Point d'entrée de test : importe réellement js/main.js (comme index.html le
// ferait), puis force DOMContentLoaded si jsdom l'a déjà émis avant l'attache
// du listener, et affiche l'état final pour vérification manuelle.
import '../js/main.js';

await new Promise(r => setTimeout(r, 50));
window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true, cancelable: true }));

await new Promise(r => setTimeout(r, 800));

const doc = window.document;
console.log('--- readyState ---', doc.readyState);
console.log('--- auth-screen hidden? ---', doc.getElementById('auth-screen')?.classList.contains('hidden'));
console.log('--- app hidden? ---', doc.getElementById('app')?.classList.contains('hidden'));
console.log('--- auth-screen contenu (300 premiers caractères) ---');
console.log(doc.getElementById('auth-screen')?.innerHTML.slice(0, 300));
