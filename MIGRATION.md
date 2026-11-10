# Migration terminée ✅

Les 13 modules de l'application originale (`balance-gestion-commerciale.html`,
un seul fichier de 5062 lignes) ont été intégralement migrés vers cette
architecture multi-fichiers : **51 fichiers JS, 5766 lignes** au total,
organisés en `core/` (logique métier pure), `components/` (Layout, Sidebar,
Navbar, Modal, Toast, CommandPalette, AlertCenter) et `pages/` (un fichier —
ou un petit groupe de fichiers pour les modules les plus riches — par module
métier).

## Modules migrés

| Module | Fichier(s) |
|---|---|
| Connexion | `pages/Login.js` |
| Tableau de bord | `pages/Dashboard.js` |
| Clients | `pages/Clients.js` |
| Produits | `pages/Products.js` |
| Fournisseurs | `pages/Suppliers.js` |
| Trésorerie | `pages/Treasury.js` |
| Achats | `pages/Purchases.js` |
| Fiche de Stock | `pages/StockCard.js` |
| Ventes (devis, factures, avoirs, abonnements) | `pages/Sales.js` + `pages/sales/{Devis,Invoices,CreditNotes,Recurring,shared}.js` |
| Comptabilité (journal, grand livre, immobilisations, TVA, FEC, clôtures…) | `pages/Accounting.js` + `pages/accounting/{Opening,Journal,Ledger,Reconciliation,Reports,Assets,Vat,FecExport,Closures,Chart}.js` |
| Rapports (analyse des ventes, bilan d'activité) | `pages/Reports.js` + `pages/reports/{SalesAnalysis,ActivitySummary}.js` |
| Paramètres | `pages/Settings.js` + `pages/settings/{Organization,TempAccess,Backup}.js` |
| Utilisateurs | `pages/Users.js` |
| Journal d'audit | `pages/AuditLog.js` |

Chaque module a été vérifié avec la même méthode : `node --check` sur
chaque fichier, `python3 tools/check_imports.py` pour la cohérence des
imports/exports, puis un scénario réel exécuté via le harnais de test
(`npm run test:boot` — voir README.md) : création de données, navigation
entre toutes les vues, sauvegarde, suppression.

## Pattern suivi partout

- **`core/`** : aucune fonction n'y touche au DOM — état, calculs,
  persistance, permissions, moteur comptable.
- **`components/`** : briques d'interface réutilisées par toutes les pages
  (Layout, Sidebar, Navbar…), câblées via `addEventListener`.
- **`pages/`** : un module métier = un fichier (ou un petit dossier pour les
  plus gros : `sales/`, `accounting/`, `reports/`, `settings/`). Les
  gabarits HTML gardent leurs `onclick="..."` identiques à l'app d'origine ;
  chaque page expose ses fonctions sur `window` en bas de fichier — voir la
  note complète dans `pages/Clients.js`. Ce choix a permis de ne **jamais**
  modifier la logique métier ni les gabarits pendant la migration.

## Si tu ajoutes un nouveau module à l'avenir

1. Crée `js/pages/MonModule.js` (ou un sous-dossier si le module a plusieurs
   onglets internes, comme `sales/` ou `accounting/`).
2. Suis le pattern ci-dessus : imports depuis `core/`, fonctions exposées
   sur `window` en bas de fichier si des gabarits utilisent `onclick=""`.
3. Ajoute la route dans `js/router.js` (import + entrée dans `ROUTES`).
4. Ajoute l'entrée correspondante dans `js/components/Sidebar.js` si le
   module doit apparaître dans la navigation, et dans les permissions par
   rôle (`core/constants.js`, `ROLES`).
5. Vérifie avec `npm run check` puis `npm run test:boot`.
