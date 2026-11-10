<?php
/* ==========================================================
   config.example.php — modèle de configuration pour api.php
   Copiez ce fichier en config.php (à la racine, à côté d'api.php).
   config.php ne doit JAMAIS être partagé ni versionné (voir .gitignore).

   EN LOCAL (XAMPP) : les valeurs par défaut ci-dessous conviennent déjà
   (utilisateur "root" sans mot de passe).

   SUR INFINITYFREE : remplacez les 4 valeurs par celles de VOTRE base,
   visibles dans le Panneau de contrôle → MySQL Databases :
     DB_HOST  -> l'hôte donné par InfinityFree, PAS "localhost"
                 (ressemble à "sqlXXX.infinityfree.com")
     DB_NAME  -> le nom complet donné par InfinityFree
                 (ressemble à "if0_12345678_balance_app")
     DB_USER  -> l'utilisateur donné par InfinityFree
                 (ressemble à "if0_12345678")
     DB_PASS  -> le mot de passe que vous avez choisi à la création de la base
   Voir DEPLOY-INFINITYFREE.md pour le pas-à-pas complet.
   ========================================================== */

// Identifiants MySQL — valeurs par défaut d'une installation XAMPP standard
// (utilisateur "root" sans mot de passe). Adaptez si vous avez changé ces réglages,
// ou si vous déployez sur un hébergement mutualisé (voir note ci-dessus).
define('DB_HOST', 'localhost');
define('DB_NAME', 'balance_app');
define('DB_USER', 'root');
define('DB_PASS', '');

// Clé secrète partagée avec le frontend. Cette valeur DOIT être identique à la
// constante API_KEY dans js/core/state.js. Changez les deux ensemble.
define('API_KEY', 'changeme-cle-secrete');
