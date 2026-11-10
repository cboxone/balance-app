/* ==========================================================
   core/constants.js — données de référence statiques
   (secteurs, rôles, plan comptable, icônes, catégories)
   Extrait de l'app monolithique d'origine, lignes 285-386 et 774
   ========================================================== */

export const ICONS = {
  dashboard:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12L12 3l9 9"/><path d="M5 10v10h14V10"/></svg>`,
  clients:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.2"/><path d="M2 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/><circle cx="18" cy="9" r="2.4"/><path d="M15.5 13.2c2.8.4 4.5 2.5 4.5 6.3"/></svg>`,
  products:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5L12 12l8-4.5"/><path d="M12 12v9"/></svg>`,
  sales:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h2l2.6 13.2A2 2 0 0010.56 19H18a2 2 0 001.96-1.6L21 8H6"/><circle cx="10" cy="22" r="1"/><circle cx="18" cy="22" r="1"/></svg>`,
  purchases:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>`,
  suppliers:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="10" width="18" height="10" rx="1"/><path d="M7 10V7a5 5 0 0110 0v3"/><path d="M3 14h18"/></svg>`,
  treasury:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8l8-5 8 5"/><path d="M4 8v11h16V8"/><path d="M9 19v-6h6v6"/></svg>`,
  reports:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10"/><path d="M11 20V4"/><path d="M18 20v-7"/></svg>`,
  settings:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.14-1.4l2-1.5-2-3.4-2.3.9a7 7 0 00-2.4-1.4L14 2h-4l-.16 2.2a7 7 0 00-2.4 1.4l-2.3-.9-2 3.4 2 1.5A7 7 0 005 12c0 .48.05.94.14 1.4l-2 1.5 2 3.4 2.3-.9a7 7 0 002.4 1.4L10 22h4l.16-2.2a7 7 0 002.4-1.4l2.3.9 2-3.4-2-1.5c.09-.46.14-.92.14-1.4z"/></svg>`,
  users:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="7" r="3.2"/><path d="M2.5 20c0-4 3-6.8 6.5-6.8s6.5 2.8 6.5 6.8"/><path d="M16.5 4.5a3.2 3.2 0 010 6.2"/><path d="M19 13.5c2.4.6 3.8 2.8 3.8 6.5"/></svg>`,
  accounting:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="9" y2="21"/></svg>`,
  stockcard:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`,
  auditlog:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`
};

export const SECTORS = {
  commerce:  {label:"Commerce général",  products:"Produits",   product:"Produit",   stock:true,  clientNoun:"Clients"},
  restauration:{label:"Restauration",    products:"Plats",      product:"Plat",      stock:true,  clientNoun:"Clients"},
  services:  {label:"Services",          products:"Prestations",product:"Prestation",stock:false, clientNoun:"Clients"},
  artisanat: {label:"Artisanat & atelier",products:"Créations", product:"Création",  stock:true,  clientNoun:"Clients"},
  import_export:{label:"Import-export",  products:"Marchandises",product:"Marchandise",stock:true, clientNoun:"Partenaires"}
};

export const TREASURY_CATEGORIES = {
  in:  [["ventes","Ventes"],["apport","Apport personnel"],["financement","Prêt / financement"],["autre","Autre entrée"]],
  out: [["achats","Achats marchandises"],["loyer","Loyer"],["salaires","Salaires"],["transport","Transport & logistique"],["services","Services & abonnements"],["taxes","Impôts & taxes"],["entretien","Entretien & réparations"],["autre","Autre dépense"]]
};

/* Plan comptable simplifié, inspiré du référentiel SYSCOHADA (OHADA).
   Volontairement réduit aux comptes utiles à une gestion commerciale courante.
   Une validation par un expert-comptable reste nécessaire avant tout usage officiel. */
export const DEFAULT_CHART_OF_ACCOUNTS = [
  {code:"101", name:"Capital", cls:"1"},
  {code:"110", name:"Report à nouveau", cls:"1"},
  {code:"120", name:"Résultat de l'exercice", cls:"1"},
  {code:"164", name:"Emprunts et dettes assimilées", cls:"1"},
  {code:"2182", name:"Matériel de transport", cls:"2"},
  {code:"2183", name:"Matériel de bureau et informatique", cls:"2"},
  {code:"2184", name:"Mobilier de bureau", cls:"2"},
  {code:"2181", name:"Agencements, aménagements", cls:"2"},
  {code:"2188", name:"Autres immobilisations corporelles", cls:"2"},
  {code:"2832", name:"Amortissements du matériel de transport", cls:"2"},
  {code:"2833", name:"Amortissements du matériel de bureau et informatique", cls:"2"},
  {code:"2834", name:"Amortissements du mobilier de bureau", cls:"2"},
  {code:"2831", name:"Amortissements des agencements, aménagements", cls:"2"},
  {code:"2838", name:"Amortissements des autres immobilisations", cls:"2"},
  {code:"311", name:"Marchandises (stocks)", cls:"3"},
  {code:"401", name:"Fournisseurs", cls:"4"},
  {code:"411", name:"Clients", cls:"4"},
  {code:"4431", name:"État, TVA collectée", cls:"4"},
  {code:"4452", name:"État, TVA déductible", cls:"4"},
  {code:"512", name:"Banques", cls:"5"},
  {code:"571", name:"Caisse", cls:"5"},
  {code:"5711", name:"Caisse — Mobile Money", cls:"5"},
  {code:"601", name:"Achats de marchandises", cls:"6"},
  {code:"6031", name:"Variation de stocks de marchandises", cls:"6"},
  {code:"609", name:"RRR obtenus (avoirs fournisseurs)", cls:"6"},
  {code:"613", name:"Locations", cls:"6"},
  {code:"615", name:"Entretien et réparations", cls:"6"},
  {code:"622", name:"Services extérieurs & abonnements", cls:"6"},
  {code:"624", name:"Transports", cls:"6"},
  {code:"641", name:"Impôts et taxes", cls:"6"},
  {code:"658", name:"Charges diverses", cls:"6"},
  {code:"661", name:"Rémunérations du personnel", cls:"6"},
  {code:"675", name:"Valeurs comptables des cessions d'immobilisations", cls:"6"},
  {code:"681", name:"Dotations aux amortissements", cls:"6"},
  {code:"707", name:"Ventes de marchandises", cls:"7"},
  {code:"709", name:"RRR accordés (avoirs)", cls:"7"},
  {code:"758", name:"Produits divers de gestion courante", cls:"7"},
  {code:"775", name:"Produits des cessions d'immobilisations", cls:"7"},
];

/* catégories d'immobilisations : compte de valeur brute + compte d'amortissement cumulé associé */
export const ASSET_CATEGORIES = {
  transport:  {label:"Matériel de transport",              account:"2182", amortAccount:"2832"},
  bureau_info:{label:"Matériel de bureau et informatique",  account:"2183", amortAccount:"2833"},
  mobilier:   {label:"Mobilier de bureau",                  account:"2184", amortAccount:"2834"},
  agencement: {label:"Agencements, aménagements",           account:"2181", amortAccount:"2831"},
  autre:      {label:"Autres immobilisations",              account:"2188", amortAccount:"2838"}
};

/* correspondance entre une catégorie de trésorerie "manuelle" et un compte de charge/produit */
export const CATEGORY_TO_ACCOUNT = {
  in:  { ventes:"707", apport:"101", financement:"164", autre:"758" },
  out: { achats:"601", loyer:"613", salaires:"661", transport:"624", services:"622", taxes:"641", entretien:"615", autre:"658" }
};

export const ROLES = {
  admin:      {label:"Administrateur", desc:"Accès complet : configuration, utilisateurs et supervision globale.", views:["dashboard","clients","suppliers","products","stockcard","sales","purchases","treasury","accounting","reports","auditlog","settings","users"], canDelete:true},
  manager:    {label:"Gérant",         desc:"Directeur général / gérant : pilote l'activité et arbitre les décisions stratégiques.", views:["dashboard","clients","suppliers","products","stockcard","sales","purchases","treasury","accounting","reports","auditlog"],                     canDelete:true},
  vendeur:    {label:"Vendeur",        desc:"Enregistre les ventes et signale les ruptures ou besoins de réassort.", views:["dashboard","clients","products","stockcard","sales","reports"],                                            canDelete:false},
  comptable:  {label:"Comptable",      desc:"Valorise le stock, tient la comptabilité et vérifie la cohérence des écritures.", views:["dashboard","sales","suppliers","purchases","treasury","accounting","reports"],                                          canDelete:false},
  stock:      {label:"Magasinier",     desc:"Réceptionne, range et suit les stocks au quotidien ; réalise les inventaires physiques.", views:["dashboard","products","stockcard","suppliers","purchases"],                                                            canDelete:false},
  achats:     {label:"Responsable des achats",  desc:"Analyse les besoins de réapprovisionnement et passe les commandes fournisseurs.", views:["dashboard","suppliers","products","stockcard","purchases","reports"],                                        canDelete:false},
  logistique: {label:"Responsable logistique",  desc:"Coordonne les flux entre sites et optimise les niveaux de stock.", views:["dashboard","products","stockcard","suppliers","purchases","sales","reports"],                                canDelete:false},
  auditeur:   {label:"Auditeur interne",        desc:"Contrôle la fiabilité des stocks et des procédures, sans droit de modification.", views:["dashboard","products","stockcard","sales","purchases","treasury","accounting","reports","auditlog"],                    canDelete:false}
};

export const STOCK_MOVEMENT_LABELS = { vente:"Vente", achat:"Achat / réception", retour_client:"Retour client (avoir)", retour_fournisseur:"Retour fournisseur (avoir)", ajustement:"Ajustement d'inventaire" };
