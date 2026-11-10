<?php
/* ==========================================================
   api.php — backend de persistance MySQL RELATIONNEL pour Balance
   Contrat attendu par js/core/state.js (INCHANGÉ) :
     GET  api.php?action=load&key=<API_KEY>   -> {"data": "<json ou null>"}
     POST api.php?action=save&key=<API_KEY>   -> corps = JSON brut de l'état
   Au lieu de stocker le JSON tel quel dans une seule table, ce fichier
   le décompose dans de vraies tables (clients, invoices, products,
   journal_entries, ...) — voir schema.sql — puis le recompose à
   l'identique au chargement.
   Résultat pour l'utilisateur : les données restent 100% compatibles
   avec l'application, ET on peut faire de vraies requêtes SQL dans
   phpMyAdmin (SELECT, JOIN, GROUP BY...) directement sur les tables.
   ========================================================== */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => "config.php introuvable — copiez config.example.php en config.php et renseignez vos identifiants MySQL."]);
    exit;
}
require $configPath;

const MAX_BODY_BYTES = 20 * 1024 * 1024; // 20 Mo — large marge pour une comptabilité PME

$providedKey = $_GET['key'] ?? '';
if (!hash_equals((string)API_KEY, (string)$providedKey)) {
    http_response_code(401);
    echo json_encode(['error' => 'Clé API invalide']);
    exit;
}

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Connexion à la base MySQL impossible. Vérifiez que XAMPP est démarré (Apache + MySQL) et que config.php contient les bons identifiants.']);
    exit;
}

/* ---------------- petits utilitaires ---------------- */
function g(array $a, string $k, $default = null) { return array_key_exists($k, $a) ? $a[$k] : $default; }
function gs(array $a, string $k, string $default = ''): string { $v = g($a, $k, $default); return $v === null ? $default : (string)$v; }
function gn(array $a, string $k, $default = 0) { $v = g($a, $k, $default); return $v === null || $v === '' ? $default : $v; }
function gb(array $a, string $k, bool $default = false): int { $v = g($a, $k, $default); return $v ? 1 : 0; }
function gj(array $a, string $k) { $v = g($a, $k, null); return $v === null ? null : json_encode($v, JSON_UNESCAPED_UNICODE); }
function djson($v) { if ($v === null || $v === '') return null; $d = json_decode($v, true); return $d === null ? null : $d; }
function arr($v): array { return is_array($v) ? $v : []; }

$action = $_GET['action'] ?? '';

/* ================================================================
   LOAD — reconstruit le JSON attendu par state.js depuis les tables
   ================================================================ */
if ($action === 'load') {
    $stmt = $pdo->query('SELECT * FROM settings WHERE id = 1');
    $settingsRow = $stmt->fetch();
    if (!$settingsRow) { echo json_encode(['data' => null]); exit; }

    $countersRow = $pdo->query('SELECT * FROM counters WHERE id = 1')->fetch() ?: [];

    $fetchAll = function (string $sql) use ($pdo) { return $pdo->query($sql)->fetchAll(); };

    // ---- produits + stock par magasin ----
    $products = $fetchAll('SELECT * FROM products');
    $stockRows = $fetchAll('SELECT * FROM product_stock');
    $stockByProduct = [];
    foreach ($stockRows as $r) { $stockByProduct[$r['product_id']][$r['magasin_id']] = $r['qty'] + 0; }
    $products = array_map(function ($p) use ($stockByProduct) {
        return [
            'id' => $p['id'], 'name' => $p['name'], 'category' => $p['category'],
            'price' => $p['price'] + 0, 'cost' => $p['cost'] + 0, 'minStock' => $p['min_stock'] + 0,
            'unit' => $p['unit'], 'stockByMagasin' => $stockByProduct[$p['id']] ?? new stdClass(),
        ];
    }, $products);

    // ---- factures + lignes + paiements + relances ----
    $invItems = $fetchAll('SELECT * FROM invoice_items ORDER BY id');
    $invPays  = $fetchAll('SELECT * FROM invoice_payments ORDER BY date');
    $invRem   = $fetchAll('SELECT * FROM invoice_reminders ORDER BY id');
    $itemsBy = []; foreach ($invItems as $it) $itemsBy[$it['invoice_id']][] = ['productId'=>$it['product_id'],'name'=>$it['name'],'qty'=>$it['qty']+0,'price'=>$it['price']+0];
    $paysBy  = []; foreach ($invPays as $p) $paysBy[$p['invoice_id']][] = ['id'=>$p['id'],'date'=>$p['date'],'amount'=>$p['amount']+0,'method'=>$p['method']];
    $remBy   = []; foreach ($invRem as $r) $remBy[$r['invoice_id']][] = ['date'=>$r['date']];
    $invoices = array_map(function ($i) use ($itemsBy, $paysBy, $remBy) {
        return [
            'id'=>$i['id'],'number'=>$i['number'],'clientId'=>$i['client_id'],'magasinId'=>$i['magasin_id'],
            'date'=>$i['date'],'dueDate'=>$i['due_date'],'status'=>$i['status'],'delivered'=>(bool)$i['delivered'],
            'reminders'=>$remBy[$i['id']] ?? [], 'payments'=>$paysBy[$i['id']] ?? [], 'items'=>$itemsBy[$i['id']] ?? [],
        ];
    }, $fetchAll('SELECT * FROM invoices'));

    // ---- devis ----
    $devisItems = $fetchAll('SELECT * FROM devis_items ORDER BY id');
    $devisItemsBy = []; foreach ($devisItems as $it) $devisItemsBy[$it['devis_id']][] = ['productId'=>$it['product_id'],'name'=>$it['name'],'qty'=>$it['qty']+0,'price'=>$it['price']+0];
    $devis = array_map(function ($d) use ($devisItemsBy) {
        return ['id'=>$d['id'],'number'=>$d['number'],'clientId'=>$d['client_id'],'magasinId'=>$d['magasin_id'],'date'=>$d['date'],'validUntil'=>$d['valid_until'],'status'=>$d['status'],'items'=>$devisItemsBy[$d['id']] ?? []];
    }, $fetchAll('SELECT * FROM devis'));

    // ---- avoirs clients ----
    $cnItems = $fetchAll('SELECT * FROM credit_note_items ORDER BY id');
    $cnItemsBy = []; foreach ($cnItems as $it) $cnItemsBy[$it['credit_note_id']][] = ['productId'=>$it['product_id'],'name'=>$it['name'],'qty'=>$it['qty']+0,'price'=>$it['price']+0];
    $creditNotes = array_map(function ($n) use ($cnItemsBy) {
        return ['id'=>$n['id'],'number'=>$n['number'],'invoiceId'=>$n['invoice_id'],'clientId'=>$n['client_id'],'magasinId'=>$n['magasin_id'],'date'=>$n['date'],'reason'=>$n['reason'],'restocked'=>(bool)$n['restocked'],'status'=>$n['status'],'items'=>$cnItemsBy[$n['id']] ?? []];
    }, $fetchAll('SELECT * FROM credit_notes'));

    // ---- achats ----
    $puItems = $fetchAll('SELECT * FROM purchase_items ORDER BY id');
    $puPays  = $fetchAll('SELECT * FROM purchase_payments ORDER BY date');
    $puRecep = $fetchAll('SELECT * FROM purchase_receptions ORDER BY id');
    $puItemsBy = []; foreach ($puItems as $it) $puItemsBy[$it['purchase_id']][] = ['productId'=>$it['product_id'],'name'=>$it['name'],'qty'=>$it['qty']+0,'cost'=>$it['cost']+0,'receivedQty'=>$it['received_qty']+0];
    $puPaysBy  = []; foreach ($puPays as $p) $puPaysBy[$p['purchase_id']][] = ['id'=>$p['id'],'date'=>$p['date'],'amount'=>$p['amount']+0,'method'=>$p['method']];
    $puRecepBy = []; foreach ($puRecep as $r) $puRecepBy[$r['purchase_id']][] = ['date'=>$r['date'],'receivedBy'=>$r['received_by'],'items'=>djson($r['items']) ?? []];
    $purchases = array_map(function ($p) use ($puItemsBy, $puPaysBy, $puRecepBy) {
        return [
            'id'=>$p['id'],'number'=>$p['number'],'supplierId'=>$p['supplier_id'],'supplier'=>$p['supplier_name'],
            'date'=>$p['date'],'dueDate'=>$p['due_date'],'expectedDate'=>$p['expected_date'],'magasinId'=>$p['magasin_id'],
            'status'=>$p['status'],'createdBy'=>$p['created_by'],
            'payments'=>$puPaysBy[$p['id']] ?? [], 'receptions'=>$puRecepBy[$p['id']] ?? [], 'items'=>$puItemsBy[$p['id']] ?? [],
        ];
    }, $fetchAll('SELECT * FROM purchases'));

    // ---- avoirs fournisseurs ----
    $scnItems = $fetchAll('SELECT * FROM supplier_credit_note_items ORDER BY id');
    $scnItemsBy = []; foreach ($scnItems as $it) $scnItemsBy[$it['supplier_credit_note_id']][] = ['productId'=>$it['product_id'],'name'=>$it['name'],'qty'=>$it['qty']+0,'cost'=>$it['cost']+0];
    $supplierCreditNotes = array_map(function ($n) use ($scnItemsBy) {
        return ['id'=>$n['id'],'number'=>$n['number'],'purchaseId'=>$n['purchase_id'],'supplierId'=>$n['supplier_id'],'supplier'=>$n['supplier_name'],'magasinId'=>$n['magasin_id'],'date'=>$n['date'],'reason'=>$n['reason'],'restocked'=>(bool)$n['restocked'],'items'=>$scnItemsBy[$n['id']] ?? []];
    }, $fetchAll('SELECT * FROM supplier_credit_notes'));

    // ---- comptabilité ----
    $jLines = $fetchAll('SELECT * FROM journal_entry_lines ORDER BY entry_id, line_order, id');
    $linesBy = [];
    foreach ($jLines as $l) {
        $line = ['account'=>$l['account'],'label'=>$l['label'],'debit'=>$l['debit']+0,'credit'=>$l['credit']+0];
        if ($l['tiers_id'] !== null) $line['tiers'] = ['type'=>$l['tiers_type'],'id'=>$l['tiers_id'],'name'=>$l['tiers_name']];
        if ($l['lettre'] !== null) $line['lettre'] = $l['lettre'];
        $linesBy[$l['entry_id']][] = $line;
    }
    $journalEntries = array_map(function ($e) use ($linesBy) {
        $entry = ['id'=>$e['id'],'ref'=>$e['ref'],'journal'=>$e['journal'],'date'=>$e['date'],'label'=>$e['label'],'lines'=>$linesBy[$e['id']] ?? [],'createdBy'=>$e['created_by']];
        $entry['generatedFrom'] = $e['generated_from_type'] !== null ? ['type'=>$e['generated_from_type'],'id'=>$e['generated_from_id']] : null;
        return $entry;
    }, $fetchAll('SELECT * FROM journal_entries'));

    $chartOfAccounts = array_map(fn($a) => ['code'=>$a['code'],'name'=>$a['name'],'cls'=>$a['cls']], $fetchAll('SELECT * FROM chart_of_accounts'));

    $fiscalClosures = array_map(fn($c) => ['id'=>$c['id'],'endDate'=>$c['end_date'],'startDate'=>$c['start_date'],'closedAt'=>$c['closed_at'],'closedBy'=>$c['closed_by'],'resultat'=>$c['resultat']+0], $fetchAll('SELECT * FROM fiscal_closures'));

    $letterMap = new stdClass();
    foreach ($fetchAll('SELECT * FROM letter_map') as $lm) { $letterMap->{$lm['map_key']} = $lm['lettre']; }

    // ---- immobilisations, mouvements de stock, audit, abonnements ----
    $assets = array_map(function ($a) {
        return ['id'=>$a['id'],'name'=>$a['name'],'category'=>$a['category'],'acquisitionDate'=>$a['acquisition_date'],'acquisitionValue'=>$a['acquisition_value']+0,'residualValue'=>$a['residual_value']+0,'usefulLifeYears'=>(int)$a['useful_life_years'],'notes'=>$a['notes'],'status'=>$a['status']];
    }, $fetchAll('SELECT * FROM assets'));

    $stockMovements = array_map(function ($m) {
        return ['id'=>$m['id'],'date'=>$m['date'],'productId'=>$m['product_id'],'magasinId'=>$m['magasin_id'],'qty'=>$m['qty']+0,'type'=>$m['type'],'label'=>$m['label'],'refType'=>$m['ref_type'],'refId'=>$m['ref_id'],'userId'=>$m['user_id'],'userName'=>$m['user_name']];
    }, $fetchAll('SELECT * FROM stock_movements'));

    $auditLog = array_map(function ($a) {
        return ['id'=>$a['id'],'date'=>$a['date'],'time'=>$a['time'],'userId'=>$a['user_id'],'userName'=>$a['user_name'],'action'=>$a['action'],'entity'=>$a['entity'],'entityId'=>$a['entity_id'],'entityLabel'=>$a['entity_label'],'changes'=>djson($a['changes']) ?? []];
    }, $fetchAll('SELECT * FROM audit_log'));

    $recurringInvoices = array_map(function ($r) {
        return ['id'=>$r['id'],'clientId'=>$r['client_id'],'magasinId'=>$r['magasin_id'],'label'=>$r['label'],'frequency'=>$r['frequency'],'dueDays'=>(int)$r['due_days'],'nextDate'=>$r['next_date'],'active'=>(bool)$r['active'],'createdAt'=>$r['created_at'],'items'=>djson($r['items']) ?? [],'history'=>djson($r['history']) ?? []];
    }, $fetchAll('SELECT * FROM recurring_invoices'));

    $users = array_map(function ($u) {
        $out = ['id'=>$u['id'],'name'=>$u['name'],'username'=>$u['username'],'passwordObf'=>$u['password_obf'],'role'=>$u['role'],'active'=>(bool)$u['active']];
        if ($u['temporary']) {
            $out['temporary'] = true; $out['expiresAt'] = $u['expires_at']; $out['grantedBy'] = $u['granted_by']; $out['grantedAt'] = $u['granted_at'];
        }
        return $out;
    }, $fetchAll('SELECT * FROM users'));

    $data = [
        'sector' => $settingsRow['sector'],
        'activeScope' => $settingsRow['active_scope'],
        'settings' => [
            'companyName' => $settingsRow['company_name'], 'companyLogo' => $settingsRow['company_logo'] ?? '',
            'currency' => $settingsRow['currency'], 'vatEnabled' => (bool)$settingsRow['vat_enabled'],
            'vatRate' => $settingsRow['vat_rate'] + 0, 'taxId' => $settingsRow['tax_id'],
            'prefixInvoice' => $settingsRow['prefix_invoice'], 'prefixDevis' => $settingsRow['prefix_devis'],
            'prefixCreditNote' => $settingsRow['prefix_credit_note'], 'prefixPurchase' => $settingsRow['prefix_purchase'],
            'prefixSupplierCreditNote' => $settingsRow['prefix_supplier_credit_note'],
            'blockNegativeStock' => (bool)$settingsRow['block_negative_stock'],
        ],
        'counters' => [
            'invoice' => (int)($countersRow['invoice_counter'] ?? 0), 'devis' => (int)($countersRow['devis_counter'] ?? 0),
            'creditNote' => (int)($countersRow['credit_note_counter'] ?? 0), 'purchase' => (int)($countersRow['purchase_counter'] ?? 0),
            'supplierCreditNote' => (int)($countersRow['supplier_credit_note_counter'] ?? 0),
        ],
        'site' => ['id'=>$settingsRow['site_id'], 'name'=>$settingsRow['site_name'], 'address'=>$settingsRow['site_address'], 'isSiege'=>(bool)$settingsRow['site_is_siege']],
        'magasins' => array_map(fn($m) => ['id'=>$m['id'],'name'=>$m['name'],'address'=>$m['address'],'isDefault'=>(bool)$m['is_default']], $fetchAll('SELECT * FROM magasins')),
        'users' => $users,
        'clients' => array_map(fn($c) => ['id'=>$c['id'],'name'=>$c['name'],'phone'=>$c['phone'],'email'=>$c['email'],'address'=>$c['address'],'createdAt'=>$c['created_at']], $fetchAll('SELECT * FROM clients')),
        'suppliers' => array_map(fn($s) => ['id'=>$s['id'],'name'=>$s['name'],'phone'=>$s['phone'],'email'=>$s['email'],'address'=>$s['address'],'createdAt'=>$s['created_at'],'createdBy'=>$s['created_by']], $fetchAll('SELECT * FROM suppliers')),
        'products' => $products,
        'invoices' => $invoices,
        'devis' => $devis,
        'creditNotes' => $creditNotes,
        'purchases' => $purchases,
        'supplierCreditNotes' => $supplierCreditNotes,
        'treasury' => array_map(function ($t) {
            $out = ['id'=>$t['id'],'date'=>$t['date'],'label'=>$t['label'],'type'=>$t['type'],'category'=>$t['category'],'magasinId'=>$t['magasin_id'],'amount'=>$t['amount']+0,'method'=>$t['method']];
            if ($t['generated_from_type'] !== null) $out['generatedFrom'] = ['type'=>$t['generated_from_type'],'id'=>$t['generated_from_id']];
            return $out;
        }, $fetchAll('SELECT * FROM treasury')),
        'chartOfAccounts' => $chartOfAccounts,
        'journalEntries' => $journalEntries,
        'fiscalClosures' => $fiscalClosures,
        'letterMap' => $letterMap,
        'letterCounter' => (int)($countersRow['letter_counter'] ?? 0),
        'assets' => $assets,
        'stockMovements' => $stockMovements,
        'recurringInvoices' => $recurringInvoices,
        'auditLog' => $auditLog,
    ];

    echo json_encode(['data' => json_encode($data, JSON_UNESCAPED_UNICODE)]);
    exit;
}

/* ================================================================
   SAVE — décompose le JSON reçu et remplace le contenu des tables
   (remplacement complet dans une transaction : simple et fiable pour
   ce volume de données ; les FK sont désactivées le temps du remplacement)
   ================================================================ */
if ($action === 'save') {
    $body = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
    if ($body === false || $body === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Corps de requête vide']);
        exit;
    }
    if (strlen($body) > MAX_BODY_BYTES) {
        http_response_code(413);
        echo json_encode(['error' => 'Données trop volumineuses']);
        exit;
    }
    $d = json_decode($body, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($d)) {
        http_response_code(400);
        echo json_encode(['error' => 'JSON invalide : ' . json_last_error_msg()]);
        exit;
    }

    try {
        $pdo->beginTransaction();
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');

        $tables = ['invoice_items','invoice_payments','invoice_reminders','devis_items','credit_note_items',
            'purchase_items','purchase_payments','purchase_receptions','supplier_credit_note_items',
            'journal_entry_lines','invoices','devis','credit_notes','purchases','supplier_credit_notes',
            'journal_entries','product_stock','products','treasury','stock_movements','audit_log','assets',
            'fiscal_closures','chart_of_accounts','recurring_invoices','letter_map','users','magasins',
            'suppliers','clients'];
        foreach ($tables as $t) { $pdo->exec("DELETE FROM `$t`"); }

        $settings = arr(g($d, 'settings'));
        $site = arr(g($d, 'site'));
        $pdo->prepare('REPLACE INTO settings (id, sector, active_scope, site_id, site_name, site_address, site_is_siege, company_name, company_logo, currency, vat_enabled, vat_rate, tax_id, prefix_invoice, prefix_devis, prefix_credit_note, prefix_purchase, prefix_supplier_credit_note, block_negative_stock) VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            ->execute([gs($d,'sector','commerce'), gs($d,'activeScope','all'), gs($site,'id'), gs($site,'name'), gs($site,'address'), gb($site,'isSiege',true), gs($settings,'companyName','Mon entreprise'), gs($settings,'companyLogo',''), gs($settings,'currency','FCFA'), gb($settings,'vatEnabled'), gn($settings,'vatRate',18), gs($settings,'taxId',''), gs($settings,'prefixInvoice','F'), gs($settings,'prefixDevis','D'), gs($settings,'prefixCreditNote','A'), gs($settings,'prefixPurchase','BC'), gs($settings,'prefixSupplierCreditNote','AF'), gb($settings,'blockNegativeStock')]);

        $counters = arr(g($d, 'counters'));
        $pdo->prepare('REPLACE INTO counters (id, invoice_counter, devis_counter, credit_note_counter, purchase_counter, supplier_credit_note_counter, letter_counter) VALUES (1,?,?,?,?,?,?)')
            ->execute([gn($counters,'invoice',0), gn($counters,'devis',0), gn($counters,'creditNote',0), gn($counters,'purchase',0), gn($counters,'supplierCreditNote',0), gn($d,'letterCounter',0)]);

        $ins = fn(string $sql) => $pdo->prepare($sql);

        $stMag = $ins('INSERT INTO magasins (id,name,address,is_default) VALUES (?,?,?,?)');
        foreach (arr(g($d,'magasins')) as $m) $stMag->execute([gs($m,'id'), gs($m,'name'), gs($m,'address'), gb($m,'isDefault')]);

        $stUser = $ins('INSERT INTO users (id,name,username,password_obf,role,active,temporary,expires_at,granted_by,granted_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
        foreach (arr(g($d,'users')) as $u) {
            $exp = g($u,'expiresAt'); $grantedAt = g($u,'grantedAt');
            $stUser->execute([gs($u,'id'), gs($u,'name'), gs($u,'username'), gs($u,'passwordObf'), gs($u,'role'), gb($u,'active',true), gb($u,'temporary'), $exp ? date('Y-m-d H:i:s', strtotime($exp)) : null, g($u,'grantedBy'), $grantedAt ? date('Y-m-d H:i:s', strtotime($grantedAt)) : null]);
        }

        $stCli = $ins('INSERT INTO clients (id,name,phone,email,address,created_at) VALUES (?,?,?,?,?,?)');
        foreach (arr(g($d,'clients')) as $c) $stCli->execute([gs($c,'id'), gs($c,'name'), gs($c,'phone'), gs($c,'email'), gs($c,'address'), gs($c,'createdAt')]);

        $stSup = $ins('INSERT INTO suppliers (id,name,phone,email,address,created_at,created_by) VALUES (?,?,?,?,?,?,?)');
        foreach (arr(g($d,'suppliers')) as $s) $stSup->execute([gs($s,'id'), gs($s,'name'), gs($s,'phone'), gs($s,'email'), gs($s,'address'), gs($s,'createdAt'), gs($s,'createdBy')]);

        $stProd = $ins('INSERT INTO products (id,name,category,price,cost,min_stock,unit) VALUES (?,?,?,?,?,?,?)');
        $stStock = $ins('INSERT INTO product_stock (product_id,magasin_id,qty) VALUES (?,?,?)');
        foreach (arr(g($d,'products')) as $p) {
            $stProd->execute([gs($p,'id'), gs($p,'name'), gs($p,'category'), gn($p,'price',0), gn($p,'cost',0), gn($p,'minStock',0), gs($p,'unit')]);
            foreach (arr(g($p,'stockByMagasin')) as $magasinId => $qty) $stStock->execute([gs($p,'id'), $magasinId, $qty]);
        }

        $stInv = $ins('INSERT INTO invoices (id,number,client_id,magasin_id,date,due_date,status,delivered) VALUES (?,?,?,?,?,?,?,?)');
        $stInvItem = $ins('INSERT INTO invoice_items (invoice_id,product_id,name,qty,price) VALUES (?,?,?,?,?)');
        $stInvPay = $ins('INSERT INTO invoice_payments (id,invoice_id,date,amount,method) VALUES (?,?,?,?,?)');
        $stInvRem = $ins('INSERT INTO invoice_reminders (invoice_id,date) VALUES (?,?)');
        foreach (arr(g($d,'invoices')) as $i) {
            $stInv->execute([gs($i,'id'), gs($i,'number'), g($i,'clientId'), g($i,'magasinId'), gs($i,'date'), gs($i,'dueDate'), gs($i,'status'), gb($i,'delivered')]);
            foreach (arr(g($i,'items')) as $it) $stInvItem->execute([gs($i,'id'), g($it,'productId'), gs($it,'name'), gn($it,'qty',0), gn($it,'price',0)]);
            foreach (arr(g($i,'payments')) as $p) $stInvPay->execute([gs($p,'id'), gs($i,'id'), gs($p,'date'), gn($p,'amount',0), gs($p,'method')]);
            foreach (arr(g($i,'reminders')) as $r) $stInvRem->execute([gs($i,'id'), gs($r,'date')]);
        }

        $stDev = $ins('INSERT INTO devis (id,number,client_id,magasin_id,date,valid_until,status) VALUES (?,?,?,?,?,?,?)');
        $stDevItem = $ins('INSERT INTO devis_items (devis_id,product_id,name,qty,price) VALUES (?,?,?,?,?)');
        foreach (arr(g($d,'devis')) as $dv) {
            $stDev->execute([gs($dv,'id'), gs($dv,'number'), g($dv,'clientId'), g($dv,'magasinId'), gs($dv,'date'), gs($dv,'validUntil'), gs($dv,'status')]);
            foreach (arr(g($dv,'items')) as $it) $stDevItem->execute([gs($dv,'id'), g($it,'productId'), gs($it,'name'), gn($it,'qty',0), gn($it,'price',0)]);
        }

        $stCn = $ins('INSERT INTO credit_notes (id,number,invoice_id,client_id,magasin_id,date,reason,restocked,status) VALUES (?,?,?,?,?,?,?,?,?)');
        $stCnItem = $ins('INSERT INTO credit_note_items (credit_note_id,product_id,name,qty,price) VALUES (?,?,?,?,?)');
        foreach (arr(g($d,'creditNotes')) as $n) {
            $stCn->execute([gs($n,'id'), gs($n,'number'), g($n,'invoiceId'), g($n,'clientId'), g($n,'magasinId'), gs($n,'date'), gs($n,'reason'), gb($n,'restocked'), gs($n,'status')]);
            foreach (arr(g($n,'items')) as $it) $stCnItem->execute([gs($n,'id'), g($it,'productId'), gs($it,'name'), gn($it,'qty',0), gn($it,'price',0)]);
        }

        $stPu = $ins('INSERT INTO purchases (id,number,supplier_id,supplier_name,date,due_date,expected_date,magasin_id,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)');
        $stPuItem = $ins('INSERT INTO purchase_items (purchase_id,product_id,name,qty,cost,received_qty) VALUES (?,?,?,?,?,?)');
        $stPuPay = $ins('INSERT INTO purchase_payments (id,purchase_id,date,amount,method) VALUES (?,?,?,?,?)');
        $stPuRec = $ins('INSERT INTO purchase_receptions (purchase_id,date,received_by,items) VALUES (?,?,?,?)');
        foreach (arr(g($d,'purchases')) as $p) {
            $stPu->execute([gs($p,'id'), gs($p,'number'), g($p,'supplierId'), gs($p,'supplier'), gs($p,'date'), gs($p,'dueDate'), gs($p,'expectedDate'), g($p,'magasinId'), gs($p,'status'), gs($p,'createdBy')]);
            foreach (arr(g($p,'items')) as $it) $stPuItem->execute([gs($p,'id'), g($it,'productId'), gs($it,'name'), gn($it,'qty',0), gn($it,'cost',0), gn($it,'receivedQty',0)]);
            foreach (arr(g($p,'payments')) as $pay) $stPuPay->execute([gs($pay,'id'), gs($p,'id'), gs($pay,'date'), gn($pay,'amount',0), gs($pay,'method')]);
            foreach (arr(g($p,'receptions')) as $rec) $stPuRec->execute([gs($p,'id'), gs($rec,'date'), gs($rec,'receivedBy'), gj($rec,'items') ?? json_encode(arr(g($rec,'items')))]);
        }

        $stScn = $ins('INSERT INTO supplier_credit_notes (id,number,purchase_id,supplier_id,supplier_name,magasin_id,date,reason,restocked) VALUES (?,?,?,?,?,?,?,?,?)');
        $stScnItem = $ins('INSERT INTO supplier_credit_note_items (supplier_credit_note_id,product_id,name,qty,cost) VALUES (?,?,?,?,?)');
        foreach (arr(g($d,'supplierCreditNotes')) as $n) {
            $stScn->execute([gs($n,'id'), gs($n,'number'), g($n,'purchaseId'), g($n,'supplierId'), gs($n,'supplier'), g($n,'magasinId'), gs($n,'date'), gs($n,'reason'), gb($n,'restocked')]);
            foreach (arr(g($n,'items')) as $it) $stScnItem->execute([gs($n,'id'), g($it,'productId'), gs($it,'name'), gn($it,'qty',0), gn($it,'cost',0)]);
        }

        $stTrs = $ins('INSERT INTO treasury (id,date,label,type,category,magasin_id,amount,method,generated_from_type,generated_from_id) VALUES (?,?,?,?,?,?,?,?,?,?)');
        foreach (arr(g($d,'treasury')) as $t) {
            $gf = g($t,'generatedFrom');
            $stTrs->execute([gs($t,'id'), gs($t,'date'), gs($t,'label'), gs($t,'type'), gs($t,'category'), g($t,'magasinId'), gn($t,'amount',0), gs($t,'method'), $gf ? gs($gf,'type') : null, $gf ? gs($gf,'id') : null]);
        }

        $stCoa = $ins('INSERT INTO chart_of_accounts (code,name,cls) VALUES (?,?,?)');
        foreach (arr(g($d,'chartOfAccounts')) as $a) $stCoa->execute([gs($a,'code'), gs($a,'name'), gs($a,'cls')]);

        $stJe = $ins('INSERT INTO journal_entries (id,ref,journal,date,label,generated_from_type,generated_from_id,created_by) VALUES (?,?,?,?,?,?,?,?)');
        $stJl = $ins('INSERT INTO journal_entry_lines (entry_id,line_order,account,label,debit,credit,tiers_type,tiers_id,tiers_name,lettre) VALUES (?,?,?,?,?,?,?,?,?,?)');
        foreach (arr(g($d,'journalEntries')) as $e) {
            $gf = g($e,'generatedFrom');
            $stJe->execute([gs($e,'id'), gs($e,'ref'), gs($e,'journal'), gs($e,'date'), gs($e,'label'), $gf ? gs($gf,'type') : null, $gf ? gs($gf,'id') : null, gs($e,'createdBy')]);
            $order = 0;
            foreach (arr(g($e,'lines')) as $l) {
                $tiers = g($l,'tiers');
                $stJl->execute([gs($e,'id'), $order++, gs($l,'account'), gs($l,'label'), gn($l,'debit',0), gn($l,'credit',0), $tiers ? gs($tiers,'type') : null, $tiers ? gs($tiers,'id') : null, $tiers ? gs($tiers,'name') : null, g($l,'lettre')]);
            }
        }

        $stFc = $ins('INSERT INTO fiscal_closures (id,end_date,start_date,closed_at,closed_by,resultat) VALUES (?,?,?,?,?,?)');
        foreach (arr(g($d,'fiscalClosures')) as $c) $stFc->execute([gs($c,'id'), gs($c,'endDate'), g($c,'startDate'), gs($c,'closedAt'), gs($c,'closedBy'), gn($c,'resultat',0)]);

        $stLm = $ins('INSERT INTO letter_map (map_key,source_type,source_id,lettre) VALUES (?,?,?,?)');
        foreach (arr(g($d,'letterMap')) as $key => $lettre) {
            $parts = explode(':', (string)$key, 2);
            $stLm->execute([(string)$key, $parts[0] ?? '', $parts[1] ?? '', (string)$lettre]);
        }

        $stAst = $ins('INSERT INTO assets (id,name,category,acquisition_date,acquisition_value,residual_value,useful_life_years,notes,status) VALUES (?,?,?,?,?,?,?,?,?)');
        foreach (arr(g($d,'assets')) as $a) $stAst->execute([gs($a,'id'), gs($a,'name'), gs($a,'category'), gs($a,'acquisitionDate'), gn($a,'acquisitionValue',0), gn($a,'residualValue',0), (int)gn($a,'usefulLifeYears',5), gs($a,'notes'), gs($a,'status','actif')]);

        $stMvt = $ins('INSERT INTO stock_movements (id,date,product_id,magasin_id,qty,type,label,ref_type,ref_id,user_id,user_name) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
        foreach (arr(g($d,'stockMovements')) as $m) $stMvt->execute([gs($m,'id'), gs($m,'date'), g($m,'productId'), g($m,'magasinId'), gn($m,'qty',0), gs($m,'type'), gs($m,'label'), g($m,'refType'), g($m,'refId'), g($m,'userId'), gs($m,'userName')]);

        $stAud = $ins('INSERT INTO audit_log (id,date,time,user_id,user_name,action,entity,entity_id,entity_label,changes) VALUES (?,?,?,?,?,?,?,?,?,?)');
        foreach (arr(g($d,'auditLog')) as $a) $stAud->execute([gs($a,'id'), gs($a,'date'), gs($a,'time'), g($a,'userId'), gs($a,'userName'), gs($a,'action'), gs($a,'entity'), g($a,'entityId'), gs($a,'entityLabel'), gj($a,'changes')]);

        $stRec = $ins('INSERT INTO recurring_invoices (id,client_id,magasin_id,label,frequency,due_days,next_date,active,created_at,items,history) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
        foreach (arr(g($d,'recurringInvoices')) as $r) $stRec->execute([gs($r,'id'), g($r,'clientId'), g($r,'magasinId'), gs($r,'label'), gs($r,'frequency'), (int)gn($r,'dueDays',0), gs($r,'nextDate'), gb($r,'active',true), gs($r,'createdAt'), gj($r,'items') ?? json_encode(arr(g($r,'items'))), gj($r,'history') ?? json_encode(arr(g($r,'history')))]);

        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        $pdo->commit();
        echo json_encode(['ok' => true]);
    } catch (Throwable $e) {
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Échec de l\'enregistrement en base : ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(400);
echo json_encode(['error' => "Action inconnue — utilisez action=load ou action=save"]);
