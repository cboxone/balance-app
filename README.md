# Balance — architecture modulaire

Refactoring complet de l'application monolithique (un seul fichier HTML de
5062 lignes) vers une architecture multi-pages avec Layout commun
(Navbar + Sidebar), routage, et séparation claire affichage / navigation /
logique métier / composants réutilisables.

**Migration terminée à 100%** — les 13 modules de l'application originale
sont tous migrés et vérifiés. Voir `MIGRATION.md` pour le détail.

**Aucun outil de build requis.** Le projet utilise les modules ES natifs du
navigateur (`<script type="module">`), cohérent avec l'esprit « application
autonome » du projet d'origine.

## Démarrer avec XAMPP (MySQL local)

> Pour mettre l'app en ligne sur un hébergement mutualisé gratuit
> (InfinityFree), voir **[DEPLOY-INFINITYFREE.md](./DEPLOY-INFINITYFREE.md)**
> — la section ci-dessous concerne le développement en local.


Cette app se sert nativement (sans backend) via `window.storage` → `api.php`
→ `localStorage`, dans cet ordre. Pour que **tes données soient stockées
dans MySQL** via XAMPP plutôt que dans le stockage local du navigateur :

1. **Copie le dossier `balance-app`** entier dans `htdocs` de XAMPP
   (généralement `C:\xampp\htdocs\balance-app` sous Windows, ou
   `/Applications/XAMPP/htdocs/balance-app` sur Mac).
2. **Démarre Apache et MySQL** depuis le panneau de contrôle XAMPP.
3. **Crée la base de données** : ouvre phpMyAdmin
   (`http://localhost/phpmyadmin`), onglet **Importer**, choisis le fichier
   `schema.sql` de ce projet, puis **Exécuter**. Ça crée la base
   `balance_app` avec une table `kv_store` (un seul enregistrement — toutes
   les données de l'app y sont stockées sous forme d'un bloc JSON, comme le
   ferait `window.storage` côté Claude).
4. **Configure l'accès à la base** : copie `config.example.php` en
   `config.php` (même dossier), et adapte si besoin :
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'balance_app');
   define('DB_USER', 'root');   // valeurs par défaut XAMPP
   define('DB_PASS', '');
   define('API_KEY', 'changeme-cle-secrete');
   ```
   Les valeurs par défaut ci-dessus correspondent à une installation XAMPP
   standard (root sans mot de passe) — tu n'as normalement rien à changer,
   **sauf `API_KEY`** si tu veux une vraie clé secrète (voir plus bas).
5. **Ouvre l'app** via Apache, pas via un simple double-clic sur le fichier :
   `http://localhost/balance-app/`

### Vérifier que ça fonctionne

Ouvre les outils de développement du navigateur (F12) → onglet Réseau, et
recharge la page. Tu dois voir une requête `api.php?action=load...` qui
répond `200`. Après avoir créé ou modifié une donnée dans l'app, une requête
`api.php?action=save...` doit aussi apparaître. Tu peux vérifier le contenu
stocké directement dans phpMyAdmin → base `balance_app` → onglet **Structure**
(toutes les tables listées ci-dessous).

### Une vraie base relationnelle — pas un blob JSON

Contrairement à une première version de ce backend, **les données ne sont
plus stockées sous forme d'un seul enregistrement JSON.** `schema.sql` crée
une trentaine de tables normalisées (`clients`, `invoices`, `invoice_items`,
`invoice_payments`, `products`, `product_stock`, `purchases`,
`journal_entries`, `journal_entry_lines`, `treasury`, `audit_log`, etc.),
avec les bonnes clés étrangères (`client_id`, `magasin_id`, `product_id`...).
Chaque site (au sens de l'organisation — voir plus bas) a sa propre base,
donc sa propre installation de ce schéma.

Tu peux donc ouvrir **phpMyAdmin → onglet SQL** (ou n'importe quel client
MySQL — DBeaver, TablePlus, la ligne de commande `mysql`...) et faire de
vraies requêtes directement sur tes données. Quelques exemples utiles :

```sql
-- Chiffre d'affaires facturé par mois
SELECT DATE_FORMAT(date, '%Y-%m') AS mois, SUM(ii.qty * ii.price) AS total
FROM invoices i JOIN invoice_items ii ON ii.invoice_id = i.id
GROUP BY mois ORDER BY mois;

-- Les 10 clients qui doivent le plus (factures non soldées)
SELECT c.name, SUM(ii.qty*ii.price) - COALESCE(SUM(ip.amount),0) AS solde
FROM invoices i
JOIN clients c ON c.id = i.client_id
LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
LEFT JOIN invoice_payments ip ON ip.invoice_id = i.id
WHERE i.status <> 'Payée'
GROUP BY c.id ORDER BY solde DESC LIMIT 10;

-- Produits sous leur seuil de stock minimum, par magasin
SELECT p.name, m.name AS magasin, ps.qty, p.min_stock
FROM product_stock ps
JOIN products p ON p.id = ps.product_id
JOIN magasins m ON m.id = ps.magasin_id
WHERE ps.qty < p.min_stock;

-- Balance d'un compte comptable (ex. 411 Clients)
SELECT jl.account, SUM(jl.debit) AS total_debit, SUM(jl.credit) AS total_credit,
       SUM(jl.debit - jl.credit) AS solde
FROM journal_entry_lines jl WHERE jl.account = '411';
```

### Organisation : un site par base, plusieurs magasins

Une entreprise qui a plusieurs sites (dans des villes ou pays différents)
utilise **une installation — et donc une base — par site** : il n'y a pas
de consolidation automatique entre les bases de plusieurs sites. À
l'intérieur d'une base, l'identité du site (nom, adresse, siège ou non) vit
dans la table `settings` (colonnes `site_name`, `site_address`,
`site_is_siege`), et ses magasins (entrepôts, points de vente) dans la table
`magasins` — sans lien vers une autre base.

**Comment ça marche côté technique**, si tu es curieux : l'application
(`js/core/state.js`) n'a **pas changé** — elle continue d'envoyer/recevoir
un seul objet JSON à `api.php`, exactement comme avant. C'est `api.php` qui
a changé : à chaque sauvegarde, il décompose ce JSON dans les vraies tables
(en remplaçant leur contenu dans une transaction) ; à chaque chargement, il
recompose l'objet JSON attendu par l'app en interrogeant les tables. Tu as
donc le meilleur des deux mondes : l'app fonctionne exactement pareil, et
tes données vivent dans un vrai schéma relationnel interrogeable.

⚠️ Si tu modifies directement des données depuis phpMyAdmin (UPDATE/DELETE
manuel), le changement ne sera visible dans l'app qu'après un rechargement
de page (qui déclenche `action=load`) — et une prochaine sauvegarde depuis
l'app régénérera les tables à partir de son propre état en mémoire. Pour de
la consultation/du reporting, modifie librement ; pour de la correction de
données, fais-le plutôt depuis l'app quand c'est possible.

### Sécurité de `API_KEY`

C'est une clé partagée simple (pas un vrai système d'authentification) qui
empêche un script tiers sur le même réseau d'écrire dans ta base par
erreur. Pour un usage strictement local (`localhost`), la valeur par défaut
suffit. Si tu exposes un jour ce serveur au-delà de ta machine, change
`API_KEY` dans **`config.php` ET dans `js/core/state.js`** (même valeur des
deux côtés) pour une chaîne longue et aléatoire.

### Fichiers ajoutés pour ce backend

```
balance-app/
├── api.php                 # point d'entrée du backend (load/save) —
│                            # décompose/recompose le JSON dans les tables
├── config.example.php      # modèle — à copier en config.php
├── schema.sql               # structure relationnelle complète à importer
│                            # (~30 tables : clients, invoices, products...)
└── .gitignore                # exclut config.php (contient tes identifiants)
```

## Démarrer sans XAMPP (test rapide, sans MySQL)

Si tu veux juste tester l'app sans passer par MySQL (les données restent
alors dans le `localStorage` du navigateur) :

```bash
cd balance-app
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Structure du projet

```
balance-app/
├── index.html                  # squelette HTML unique (Login + Layout authentifié)
├── css/
│   └── styles.css              # tout le CSS d'origine (un correctif : overflow du sidebar)
├── js/
│   ├── main.js                 # point d'entrée : bootstrap, renderRoot, expose les fonctions globales
│   ├── router.js                # table des routes (vue -> page), goView(), changeSector(), changeActiveScope()
│   ├── core/                    # logique métier pure (aucun DOM)
│   │   ├── state.js             #   état global + persistance (window.storage / PHP / localStorage)
│   │   ├── constants.js         #   secteurs, rôles, plan comptable, icônes
│   │   ├── utils.js             #   formatage, échappement, export CSV
│   │   ├── auth.js              #   permissions, connexion/déconnexion
│   │   ├── sites.js             #   magasins du site de cette base / portée / vérifications de stock
│   │   ├── audit.js             #   journal d'audit + mouvements de stock
│   │   ├── accounting-engine.js #   écritures en partie double, lettrage, clôtures
│   │   └── print-shell.js       #   habillage d'impression générique (rapports)
│   ├── components/               # briques d'interface réutilisables
│   │   ├── Layout.js             #   assemble Sidebar + Navbar + zone de contenu
│   │   ├── Sidebar.js            #   navigation latérale (filtrée par rôle)
│   │   ├── Navbar.js             #   barre supérieure (badge utilisateur, recherche)
│   │   ├── AlertCenter.js        #   cloche d'alertes
│   │   ├── CommandPalette.js     #   palette de commandes (Ctrl/Cmd+K)
│   │   ├── Modal.js              #   modale générique
│   │   └── Toast.js              #   notifications
│   └── pages/                    # un module métier = un fichier (ou un petit dossier)
│       ├── Login.js
│       ├── Dashboard.js
│       ├── Clients.js
│       ├── Products.js
│       ├── Suppliers.js
│       ├── Treasury.js
│       ├── Purchases.js
│       ├── StockCard.js
│       ├── Sales.js              # orchestrateur d'onglets
│       ├── sales/                # Devis, Invoices, CreditNotes, Recurring, shared
│       ├── Accounting.js         # orchestrateur d'onglets
│       ├── accounting/           # Opening, Journal, Ledger, Reconciliation, Reports, Assets, Vat, FecExport, Closures, Chart
│       ├── Reports.js            # orchestrateur d'onglets
│       ├── reports/              # SalesAnalysis, ActivitySummary
│       ├── Settings.js
│       ├── settings/             # Organization, TempAccess, Backup
│       ├── Users.js
│       └── AuditLog.js
├── tools/
│   ├── check_imports.py          # vérifie la cohérence imports/exports du projet
│   ├── preload-dom.mjs           # (dev) simule un environnement navigateur avec jsdom
│   └── browser-sim.mjs           # (dev) scénario de démarrage automatisé
└── MIGRATION.md                  # détail de la migration effectuée
```

## Convention de câblage des événements

Deux mécanismes coexistent volontairement :

- **Composants d'infrastructure** (`Sidebar`, `Navbar`, `Layout`,
  `CommandPalette`) : `addEventListener` classique, câblé après chaque rendu.
- **Pages métier** (tous les modules) : les gabarits HTML gardent leurs
  attributs `onclick="..."` **strictement identiques à l'original**, et
  chaque page expose ses fonctions sur `window` en bas de fichier. Ce choix
  a permis de migrer 5062 lignes sans jamais toucher à la logique métier ni
  aux gabarits eux-mêmes — voir la note complète dans `pages/Clients.js`.

`state` est également exposé sur `window` (voir `main.js`) car plusieurs
gabarits font `onclick="state.salesTab='...'; renderLayout()"` directement,
comme dans l'app d'origine où `state` était une variable globale.

## Vérifier le projet

```bash
# Syntaxe de tous les fichiers JS + cohérence des imports/exports
npm run check
```

### Harnais de test « démarrage réel de l'app » (optionnel)

En plus de la vérification statique ci-dessus, ce projet inclut un harnais
qui simule un vrai chargement de navigateur (jsdom + Node) pour attraper les
erreurs qu'une simple vérification de syntaxe ne peut pas voir :

```bash
npm install          # installe jsdom (dev uniquement, l'app elle-même n'en a pas besoin)
npm run test:boot    # démarre l'app, crée un compte admin, navigue dans les modules
```

**Limite connue du harnais** : jsdom n'implémente pas `URL.createObjectURL`
(utilisé par les exports CSV/backup/FEC pour déclencher un téléchargement).
C'est une limitation de l'environnement de test, pas un bug — cette API est
universellement supportée par les vrais navigateurs.

## Sécurité — rappel important

Comme dans l'application d'origine, le système de comptes (`obf()` dans
`core/auth.js`) sépare les usages au sein d'une équipe de confiance mais ne
constitue **pas** une vraie barrière de sécurité cryptographique. Ne pas
présenter cela comme une protection contre un accès malveillant.
