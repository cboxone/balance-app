// Préchargé via `node --import` : simule un environnement navigateur minimal
// (jsdom) AVANT que le vrai graphe de modules (js/main.js) ne s'exécute,
// pour pouvoir dérouler tout le vrai chargement de l'app et attraper les
// erreurs réelles avec nom de fichier + numéro de ligne, comme le ferait
// un navigateur.
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(appDir, 'index.html'), 'utf-8');

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  pretendToBeVisual: true,
  resources: undefined
});
const { window } = dom;

globalThis.window = window;
globalThis.document = window.document;
globalThis.localStorage = window.localStorage;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Event = window.Event;
globalThis.URL = window.URL;
globalThis.Blob = window.Blob;
globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
globalThis.confirm = () => true;
globalThis.fetch = async () => { throw new Error('fetch désactivé dans le harnais de test'); };

window.addEventListener('error', (e) => {
  console.error('[window error]', e.error?.stack || e.message);
});
process.on('unhandledRejection', (e) => {
  console.error('[unhandledRejection]', e?.stack || e);
});

console.log('[preload-dom] environnement DOM simulé prêt');
