-- ==========================================================
-- schema.sql — base de données RELATIONNELLE pour le backend api.php
-- À importer via phpMyAdmin (onglet "Importer") ou en ligne de
-- commande : mysql -u root -p < schema.sql
--
-- Chaque entité de l'application a sa propre table : tu peux ouvrir
-- phpMyAdmin (ou n'importe quel client MySQL) et faire de vraies
-- requêtes SQL — SELECT, JOIN, GROUP BY, etc. — directement sur tes
-- clients, factures, produits, écritures comptables...
--
-- Chaque site a sa PROPRE base de données, indépendante des autres (pas de
-- consolidation inter-sites) : une base correspond donc à UN SEUL site, et
-- ce site a un ou plusieurs MAGASINS (les points de stockage/vente concrets).
-- L'identité du site (nom, adresse, siège) est stockée directement dans la
-- table settings, puisqu'il n'y en a qu'un par base.
--
-- Si tu réimportes ce fichier sur une base existante, TOUTES LES
-- TABLES SONT RECRÉÉES VIDES (DROP TABLE). Ne le fais qu'une fois,
-- à l'installation initiale.
-- ==========================================================

CREATE DATABASE IF NOT EXISTS balance_app
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE balance_app;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS invoice_items, invoice_payments, invoice_reminders,
  devis_items, credit_note_items, purchase_items, purchase_payments,
  purchase_receptions, supplier_credit_note_items, journal_entry_lines,
  invoices, devis, credit_notes, purchases, supplier_credit_notes,
  journal_entries, product_stock, products, treasury, stock_movements,
  audit_log, assets, fiscal_closures, chart_of_accounts, recurring_invoices,
  letter_map, users, magasins, suppliers, clients, settings, counters;

-- ---------------- paramétrage général + identité du site (une seule ligne, id=1) ----------------
CREATE TABLE settings (
  id                          TINYINT PRIMARY KEY DEFAULT 1,
  sector                      VARCHAR(40)  NOT NULL DEFAULT 'commerce',
  active_scope                VARCHAR(40)  NOT NULL DEFAULT 'all',
  site_id                     VARCHAR(40)  NOT NULL DEFAULT '',
  site_name                   VARCHAR(255) NOT NULL DEFAULT '',
  site_address                VARCHAR(255) NOT NULL DEFAULT '',
  site_is_siege                TINYINT(1)   NOT NULL DEFAULT 1,
  company_name                VARCHAR(255) NOT NULL DEFAULT 'Mon entreprise',
  company_logo                LONGTEXT     NULL,
  currency                    VARCHAR(20)  NOT NULL DEFAULT 'FCFA',
  vat_enabled                 TINYINT(1)   NOT NULL DEFAULT 0,
  vat_rate                    DECIMAL(6,2) NOT NULL DEFAULT 18,
  tax_id                      VARCHAR(80)  NOT NULL DEFAULT '',
  prefix_invoice               VARCHAR(10)  NOT NULL DEFAULT 'F',
  prefix_devis                 VARCHAR(10)  NOT NULL DEFAULT 'D',
  prefix_credit_note           VARCHAR(10)  NOT NULL DEFAULT 'A',
  prefix_purchase               VARCHAR(10)  NOT NULL DEFAULT 'BC',
  prefix_supplier_credit_note   VARCHAR(10)  NOT NULL DEFAULT 'AF',
  block_negative_stock         TINYINT(1)   NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------- compteurs de numérotation (une seule ligne, id=1) ----------------
CREATE TABLE counters (
  id                             TINYINT PRIMARY KEY DEFAULT 1,
  invoice_counter                INT NOT NULL DEFAULT 0,
  devis_counter                  INT NOT NULL DEFAULT 0,
  credit_note_counter            INT NOT NULL DEFAULT 0,
  purchase_counter                INT NOT NULL DEFAULT 0,
  supplier_credit_note_counter    INT NOT NULL DEFAULT 0,
  letter_counter                  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------- magasins du site de cette installation ----------------
CREATE TABLE magasins (
  id          VARCHAR(40) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL DEFAULT '',
  address     VARCHAR(255) NOT NULL DEFAULT '',
  is_default  TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id            VARCHAR(40) PRIMARY KEY,
  name          VARCHAR(255) NOT NULL DEFAULT '',
  username      VARCHAR(120) NOT NULL DEFAULT '',
  password_obf  VARCHAR(255) NOT NULL DEFAULT '',
  role          VARCHAR(40)  NOT NULL DEFAULT '',
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  temporary     TINYINT(1)   NOT NULL DEFAULT 0,
  expires_at    DATETIME NULL,
  granted_by    VARCHAR(255) NULL,
  granted_at    DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------- tiers ----------------
CREATE TABLE clients (
  id          VARCHAR(40) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL DEFAULT '',
  phone       VARCHAR(60)  NOT NULL DEFAULT '',
  email       VARCHAR(190) NOT NULL DEFAULT '',
  address     VARCHAR(255) NOT NULL DEFAULT '',
  created_at  VARCHAR(40)  NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE suppliers (
  id          VARCHAR(40) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL DEFAULT '',
  phone       VARCHAR(60)  NOT NULL DEFAULT '',
  email       VARCHAR(190) NOT NULL DEFAULT '',
  address     VARCHAR(255) NOT NULL DEFAULT '',
  created_at  VARCHAR(40)  NOT NULL DEFAULT '',
  created_by  VARCHAR(255) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------- catalogue & stock ----------------
CREATE TABLE products (
  id         VARCHAR(40) PRIMARY KEY,
  name       VARCHAR(255) NOT NULL DEFAULT '',
  category   VARCHAR(120) NOT NULL DEFAULT '',
  price      DECIMAL(14,2) NOT NULL DEFAULT 0,
  cost       DECIMAL(14,2) NOT NULL DEFAULT 0,
  min_stock  DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit       VARCHAR(40)  NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_stock (
  product_id  VARCHAR(40) NOT NULL,
  magasin_id  VARCHAR(40) NOT NULL,
  qty         DECIMAL(12,3) NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, magasin_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------- ventes : factures ----------------
CREATE TABLE invoices (
  id          VARCHAR(40) PRIMARY KEY,
  number      VARCHAR(60)  NOT NULL DEFAULT '',
  client_id   VARCHAR(40)  NULL,
  magasin_id  VARCHAR(40)  NULL,
  date        VARCHAR(40)  NOT NULL DEFAULT '',
  due_date    VARCHAR(40)  NOT NULL DEFAULT '',
  status      VARCHAR(60)  NOT NULL DEFAULT '',
  delivered   TINYINT(1)   NOT NULL DEFAULT 0,
  INDEX (client_id), INDEX (magasin_id), INDEX (status), INDEX (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id  VARCHAR(40) NOT NULL,
  product_id  VARCHAR(40) NULL,
  name        VARCHAR(255) NOT NULL DEFAULT '',
  qty         DECIMAL(12,3) NOT NULL DEFAULT 0,
  price       DECIMAL(14,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  INDEX (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_payments (
  id          VARCHAR(40) PRIMARY KEY,
  invoice_id  VARCHAR(40) NOT NULL,
  date        VARCHAR(40) NOT NULL DEFAULT '',
  amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
  method      VARCHAR(60) NOT NULL DEFAULT '',
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_reminders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id  VARCHAR(40) NOT NULL,
  date        VARCHAR(40) NOT NULL DEFAULT '',
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------- ventes : devis ----------------
CREATE TABLE devis (
  id           VARCHAR(40) PRIMARY KEY,
  number       VARCHAR(60) NOT NULL DEFAULT '',
  client_id    VARCHAR(40) NULL,
  magasin_id   VARCHAR(40) NULL,
  date         VARCHAR(40) NOT NULL DEFAULT '',
  valid_until  VARCHAR(40) NOT NULL DEFAULT '',
  status       VARCHAR(60) NOT NULL DEFAULT '',
  INDEX (client_id), INDEX (magasin_id), INDEX (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE devis_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  devis_id    VARCHAR(40) NOT NULL,
  product_id  VARCHAR(40) NULL,
  name        VARCHAR(255) NOT NULL DEFAULT '',
  qty         DECIMAL(12,3) NOT NULL DEFAULT 0,
  price       DECIMAL(14,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (devis_id) REFERENCES devis(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------- ventes : avoirs clients ----------------
CREATE TABLE credit_notes (
  id          VARCHAR(40) PRIMARY KEY,
  number      VARCHAR(60) NOT NULL DEFAULT '',
  invoice_id  VARCHAR(40) NULL,
  client_id   VARCHAR(40) NULL,
  magasin_id  VARCHAR(40) NULL,
  date        VARCHAR(40) NOT NULL DEFAULT '',
  reason      VARCHAR(255) NOT NULL DEFAULT '',
  restocked   TINYINT(1) NOT NULL DEFAULT 0,
  status      VARCHAR(60) NOT NULL DEFAULT '',
  INDEX (client_id), INDEX (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE credit_note_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  credit_note_id  VARCHAR(40) NOT NULL,
  product_id      VARCHAR(40) NULL,
  name            VARCHAR(255) NOT NULL DEFAULT '',
  qty             DECIMAL(12,3) NOT NULL DEFAULT 0,
  price           DECIMAL(14,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------- achats : bons de commande / réceptions ----------------
CREATE TABLE purchases (
  id             VARCHAR(40) PRIMARY KEY,
  number         VARCHAR(60) NOT NULL DEFAULT '',
  supplier_id    VARCHAR(40) NULL,
  supplier_name  VARCHAR(255) NOT NULL DEFAULT '',
  date           VARCHAR(40) NOT NULL DEFAULT '',
  due_date       VARCHAR(40) NOT NULL DEFAULT '',
  expected_date  VARCHAR(40) NOT NULL DEFAULT '',
  magasin_id     VARCHAR(40) NULL,
  status         VARCHAR(60) NOT NULL DEFAULT '',
  created_by     VARCHAR(255) NOT NULL DEFAULT '',
  INDEX (supplier_id), INDEX (magasin_id), INDEX (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id   VARCHAR(40) NOT NULL,
  product_id    VARCHAR(40) NULL,
  name          VARCHAR(255) NOT NULL DEFAULT '',
  qty           DECIMAL(12,3) NOT NULL DEFAULT 0,
  cost          DECIMAL(14,2) NOT NULL DEFAULT 0,
  received_qty  DECIMAL(12,3) NOT NULL DEFAULT 0,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_payments (
  id           VARCHAR(40) PRIMARY KEY,
  purchase_id  VARCHAR(40) NOT NULL,
  date         VARCHAR(40) NOT NULL DEFAULT '',
  amount       DECIMAL(14,2) NOT NULL DEFAULT 0,
  method       VARCHAR(60) NOT NULL DEFAULT '',
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_receptions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id   VARCHAR(40) NOT NULL,
  date          VARCHAR(40) NOT NULL DEFAULT '',
  received_by   VARCHAR(255) NOT NULL DEFAULT '',
  items         JSON NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------- achats : avoirs fournisseurs ----------------
CREATE TABLE supplier_credit_notes (
  id             VARCHAR(40) PRIMARY KEY,
  number         VARCHAR(60) NOT NULL DEFAULT '',
  purchase_id    VARCHAR(40) NULL,
  supplier_id    VARCHAR(40) NULL,
  supplier_name  VARCHAR(255) NOT NULL DEFAULT '',
  magasin_id     VARCHAR(40) NULL,
  date           VARCHAR(40) NOT NULL DEFAULT '',
  reason         VARCHAR(255) NOT NULL DEFAULT '',
  restocked      TINYINT(1) NOT NULL DEFAULT 0,
  INDEX (supplier_id), INDEX (purchase_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE supplier_credit_note_items (
  id                       INT AUTO_INCREMENT PRIMARY KEY,
  supplier_credit_note_id  VARCHAR(40) NOT NULL,
  product_id               VARCHAR(40) NULL,
  name                     VARCHAR(255) NOT NULL DEFAULT '',
  qty                      DECIMAL(12,3) NOT NULL DEFAULT 0,
  cost                     DECIMAL(14,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (supplier_credit_note_id) REFERENCES supplier_credit_notes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------- trésorerie ----------------
CREATE TABLE treasury (
  id                     VARCHAR(40) PRIMARY KEY,
  date                   VARCHAR(40) NOT NULL DEFAULT '',
  label                  VARCHAR(255) NOT NULL DEFAULT '',
  type                   VARCHAR(10) NOT NULL DEFAULT '',
  category               VARCHAR(60) NOT NULL DEFAULT '',
  magasin_id             VARCHAR(40) NULL,
  amount                 DECIMAL(14,2) NOT NULL DEFAULT 0,
  method                 VARCHAR(60) NOT NULL DEFAULT '',
  generated_from_type    VARCHAR(60) NULL,
  generated_from_id      VARCHAR(40) NULL,
  INDEX (date), INDEX (type), INDEX (magasin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------- comptabilité SYSCOHADA/OHADA ----------------
CREATE TABLE chart_of_accounts (
  code  VARCHAR(20) PRIMARY KEY,
  name  VARCHAR(255) NOT NULL DEFAULT '',
  cls   VARCHAR(5) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE journal_entries (
  id                    VARCHAR(40) PRIMARY KEY,
  ref                   VARCHAR(60) NOT NULL DEFAULT '',
  journal               VARCHAR(10) NOT NULL DEFAULT '',
  date                  VARCHAR(40) NOT NULL DEFAULT '',
  label                 VARCHAR(255) NOT NULL DEFAULT '',
  generated_from_type   VARCHAR(60) NULL,
  generated_from_id     VARCHAR(40) NULL,
  created_by            VARCHAR(255) NOT NULL DEFAULT '',
  INDEX (date), INDEX (journal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE journal_entry_lines (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  entry_id    VARCHAR(40) NOT NULL,
  line_order  INT NOT NULL DEFAULT 0,
  account     VARCHAR(20) NOT NULL DEFAULT '',
  label       VARCHAR(255) NOT NULL DEFAULT '',
  debit       DECIMAL(14,2) NOT NULL DEFAULT 0,
  credit      DECIMAL(14,2) NOT NULL DEFAULT 0,
  tiers_type  VARCHAR(20) NULL,
  tiers_id    VARCHAR(40) NULL,
  tiers_name  VARCHAR(255) NULL,
  lettre      VARCHAR(20) NULL,
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  INDEX (account), INDEX (tiers_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE fiscal_closures (
  id          VARCHAR(40) PRIMARY KEY,
  end_date    VARCHAR(40) NOT NULL DEFAULT '',
  start_date  VARCHAR(40) NULL,
  closed_at   VARCHAR(60) NOT NULL DEFAULT '',
  closed_by   VARCHAR(255) NOT NULL DEFAULT '',
  resultat    DECIMAL(14,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE letter_map (
  map_key      VARCHAR(90) PRIMARY KEY,
  source_type  VARCHAR(40) NOT NULL DEFAULT '',
  source_id    VARCHAR(40) NOT NULL DEFAULT '',
  lettre       VARCHAR(20) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------- immobilisations ----------------
CREATE TABLE assets (
  id                   VARCHAR(40) PRIMARY KEY,
  name                 VARCHAR(255) NOT NULL DEFAULT '',
  category             VARCHAR(60) NOT NULL DEFAULT '',
  acquisition_date     VARCHAR(40) NOT NULL DEFAULT '',
  acquisition_value    DECIMAL(14,2) NOT NULL DEFAULT 0,
  residual_value       DECIMAL(14,2) NOT NULL DEFAULT 0,
  useful_life_years    INT NOT NULL DEFAULT 5,
  notes                VARCHAR(500) NOT NULL DEFAULT '',
  status               VARCHAR(40) NOT NULL DEFAULT 'actif'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------- stock & audit ----------------
CREATE TABLE stock_movements (
  id          VARCHAR(40) PRIMARY KEY,
  date        VARCHAR(40) NOT NULL DEFAULT '',
  product_id  VARCHAR(40) NULL,
  magasin_id  VARCHAR(40) NULL,
  qty         DECIMAL(12,3) NOT NULL DEFAULT 0,
  type        VARCHAR(40) NOT NULL DEFAULT '',
  label       VARCHAR(255) NOT NULL DEFAULT '',
  ref_type    VARCHAR(40) NULL,
  ref_id      VARCHAR(40) NULL,
  user_id     VARCHAR(40) NULL,
  user_name   VARCHAR(255) NOT NULL DEFAULT '',
  INDEX (product_id), INDEX (magasin_id), INDEX (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_log (
  id            VARCHAR(40) PRIMARY KEY,
  date          VARCHAR(40) NOT NULL DEFAULT '',
  time          VARCHAR(60) NOT NULL DEFAULT '',
  user_id       VARCHAR(40) NULL,
  user_name     VARCHAR(255) NOT NULL DEFAULT '',
  action        VARCHAR(60) NOT NULL DEFAULT '',
  entity        VARCHAR(60) NOT NULL DEFAULT '',
  entity_id     VARCHAR(40) NULL,
  entity_label  VARCHAR(255) NOT NULL DEFAULT '',
  changes       JSON NULL,
  INDEX (entity), INDEX (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------- abonnements (factures récurrentes) ----------------
CREATE TABLE recurring_invoices (
  id          VARCHAR(40) PRIMARY KEY,
  client_id   VARCHAR(40) NULL,
  magasin_id  VARCHAR(40) NULL,
  label       VARCHAR(255) NOT NULL DEFAULT '',
  frequency   VARCHAR(20) NOT NULL DEFAULT '',
  due_days    INT NOT NULL DEFAULT 0,
  next_date   VARCHAR(40) NOT NULL DEFAULT '',
  active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at  VARCHAR(40) NOT NULL DEFAULT '',
  items       JSON NULL,
  history     JSON NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
