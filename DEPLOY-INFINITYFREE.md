# Déployer Balance sur InfinityFree

Ce guide t'emmène de "j'ai le dossier `balance-app`" à "l'app se charge
automatiquement quand j'ouvre mon domaine". Je n'ai pas la main sur ton
compte InfinityFree — je ne peux pas cliquer à ta place dans leur panneau —
mais chaque fichier du projet est déjà prêt pour cet hébergement (chemins
relatifs, `.htaccess` inclus, etc.). Suis les étapes dans l'ordre.

## 1. Créer le compte / le site sur InfinityFree

1. Crée un compte sur infinityfree.com si ce n'est pas déjà fait.
2. Crée un nouveau compte d'hébergement (un sous-domaine gratuit du type
   `tonapp.infinityfreeapp.com`, ou ton propre nom de domaine si tu en as
   un et que tu changes ses serveurs DNS vers ceux d'InfinityFree).
3. Attends que le compte passe en statut **Active** (quelques minutes en
   général) avant de continuer — rien ne fonctionnera avant.

## 2. Créer la base de données MySQL

1. Dans le panneau de contrôle (Client Area / **Control Panel**), section
   **MySQL Databases**.
2. Crée une nouvelle base — donne-lui un nom (ex. `balance_app`, il sera
   automatiquement préfixé par InfinityFree, du genre `if0_12345678_balance_app`).
3. **Note précieusement les 4 informations affichées** : hôte MySQL, nom
   complet de la base, utilisateur, mot de passe. Tu en auras besoin à
   l'étape 4. L'hôte n'est **jamais** `localhost` chez InfinityFree — il
   ressemble à `sqlXXX.infinityfree.com`.

## 3. Importer le schéma (les tables)

1. Depuis le panneau de contrôle, ouvre **phpMyAdmin** (bouton à côté de
   ta base MySQL).
2. Sélectionne ta base dans la colonne de gauche.
3. Onglet **Importer** → choisis le fichier `schema.sql` de ce projet →
   **Exécuter**.
4. ⚠️ `schema.sql` commence par `CREATE DATABASE IF NOT EXISTS balance_app`
   et `USE balance_app;` — sur InfinityFree, tu n'as pas le droit de créer
   une base par SQL (seul le panneau de contrôle le permet), et ta base a
   un nom préfixé, pas `balance_app`. **Avant d'importer**, ouvre
   `schema.sql` dans un éditeur de texte et supprime (ou mets en
   commentaire avec `--`) les deux premières lignes utiles :
   ```sql
   CREATE DATABASE IF NOT EXISTS balance_app ...;
   USE balance_app;
   ```
   phpMyAdmin exécutera alors le reste directement dans la base que tu as
   sélectionnée à l'étape précédente — ce qui est ce qu'on veut.
5. Vérifie dans l'onglet **Structure** que tu vois bien une trentaine de
   tables (`clients`, `invoices`, `settings`, `magasins`, etc.).

## 4. Configurer `config.php`

1. Dans le dossier du projet, duplique `config.example.php` et renomme la
   copie en `config.php`.
2. Remplis-le avec les 4 informations notées à l'étape 2 :
   ```php
   define('DB_HOST', 'sqlXXX.infinityfree.com');       // ton hôte exact
   define('DB_NAME', 'if0_12345678_balance_app');       // ton nom de base exact
   define('DB_USER', 'if0_12345678');                   // ton utilisateur exact
   define('DB_PASS', 'ton-mot-de-passe');
   ```
3. Choisis une vraie clé secrète pour `API_KEY` (une chaîne longue et
   imprévisible — pas la valeur `changeme-cle-secrete` par défaut).
4. Ouvre `js/core/state.js`, cherche la ligne `const API_KEY = ...` (juste
   après `const API_URL = 'api.php';`) et mets **exactement la même**
   valeur que dans `config.php`. Les deux doivent être identiques mot pour
   mot, sinon `api.php` refusera toutes les requêtes (erreur 401).

## 5. Envoyer les fichiers

Deux façons, au choix :

**Option A — File Manager du panneau de contrôle** (le plus simple, sans
rien installer) :
1. Panneau de contrôle → **File Manager**.
2. Va dans le dossier `htdocs/` (c'est la racine de ton site — tout ce que
   les visiteurs voient part de là).
3. Uploade **tout le contenu** du dossier `balance-app/` directement dans
   `htdocs/` — pas le dossier `balance-app` lui-même, son *contenu*
   (`index.html`, `api.php`, `config.php`, `.htaccess`, les dossiers `css/`
   et `js/`, etc. doivent être directement dans `htdocs/`).

**Option B — FTP** (plus rapide pour beaucoup de fichiers) :
1. Récupère les identifiants FTP dans le panneau de contrôle (**FTP
   Accounts**).
2. Connecte-toi avec un client FTP (FileZilla, par exemple) et envoie le
   même contenu dans `htdocs/`.

Dans les deux cas, assure-toi que `.htaccess` a bien été envoyé — certains
File Managers cachent les fichiers commençant par un point ; active
l'affichage des fichiers cachés si besoin.

## 6. Vérifier le lancement automatique

Ouvre ton domaine (`https://tonapp.infinityfreeapp.com`) dans le
navigateur : la page de connexion de Balance doit s'afficher directement,
sans avoir besoin de taper `/index.html`. C'est le rôle du fichier
`.htaccess` inclus dans ce projet (directive `DirectoryIndex`), déjà envoyé
à l'étape 5.

Si tu vois une page blanche ou une erreur :
- **Page blanche silencieuse** → ouvre la console du navigateur (F12) :
  s'il y a une erreur sur `js/main.js` du type "Failed to load module
  script" / mauvais type MIME, vérifie que `.htaccess` est bien présent à
  la racine de `htdocs/` (voir étape 5).
- **"Clé API invalide" ou erreur 401** → `API_KEY` diffère entre
  `config.php` et `js/core/state.js` (étape 4).
- **"Connexion à la base MySQL impossible"** → une des 4 valeurs de
  `config.php` est fausse (étape 4) ; revérifie-les dans le panneau de
  contrôle InfinityFree.
- **Page d'erreur générique InfinityFree ("Account Suspended" ou
  équivalent)** → le compte n'est pas encore Active (étape 1), ou tu as
  dépassé un des quotas gratuits (vérifie dans le panneau de contrôle).

## À savoir sur l'hébergement gratuit InfinityFree

- Serveurs partagés, donc plus lents qu'en local — normal, surtout au
  premier chargement.
- Bande passante et ressources limitées ; largement suffisant pour l'usage
  d'une PME sur cette app, mais à garder en tête si le volume de données
  grossit beaucoup.
- Pas de support HTTPS custom pour un domaine externe sur certains plans
  gratuits — le sous-domaine `infinityfreeapp.com` fourni a HTTPS inclus.
