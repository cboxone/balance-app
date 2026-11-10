/* ==========================================================
   core/state.js — état global de l'application + persistance
   (window.storage → backend PHP local → localStorage)
   Regroupe l'état applicatif qui était en variables globales
   dans le fichier monolithique d'origine (lignes 387-410, 823-1050)
   ========================================================== */
import { DEFAULT_CHART_OF_ACCOUNTS, SECTORS } from './constants.js';
import { uid, todayISO } from './utils.js';
import { showToast } from '../components/Toast.js';
// Imports circulaires assumés : ces fonctions ne sont utilisées qu'à l'intérieur
// de seedDemoData()/migrateSites(), jamais à l'évaluation du module — donc sûr en ESM.
import { pushJournalEntry, getOrCreateLettre } from './accounting-engine.js';
import { clientName } from '../pages/Clients.js';
import { defaultMagasin } from './sites.js';

export let currentUser = null;
export function setCurrentUser(u){ currentUser = u; }
export function sectorCfg(){ return SECTORS[state.sector]; }

export let state = {
  sector:"commerce",
  view:"dashboard",
  salesTab:"factures",
  accountingTab:"journal",
  activeScope:"all",
  settings:{ companyName:"Mon entreprise", companyLogo:"", currency:"FCFA", vatEnabled:false, vatRate:18, taxId:"", prefixInvoice:"F", prefixDevis:"D", prefixCreditNote:"A", prefixPurchase:"BC", prefixSupplierCreditNote:"AF", blockNegativeStock:false },
  counters:{ invoice:0, devis:0, creditNote:0, purchase:0, supplierCreditNote:0 },
  site:null, magasins:[], users:[], clients:[], suppliers:[], products:[], invoices:[], devis:[], creditNotes:[], purchases:[], treasury:[], supplierCreditNotes:[],
  chartOfAccounts:[], journalEntries:[], fiscalClosures:[], letterMap:{}, letterCounter:0, assets:[], stockMovements:[], recurringInvoices:[], auditLog:[]
};
let draftInvoice = null;
let draftRecurring = null;
let draftDevis = null;
let draftPurchase = null;
let draftCreditNote = null;
let draftSupplierCreditNote = null;
let draftMagasin = null;
let paletteSel = 0;
let paletteItems = [];


export function migrateSites(){
  if(!state.chartOfAccounts || !state.chartOfAccounts.length) state.chartOfAccounts = DEFAULT_CHART_OF_ACCOUNTS.map(a=>({...a}));
  if(!state.journalEntries) state.journalEntries = [];
  if(!state.fiscalClosures) state.fiscalClosures = [];
  if(!state.letterMap) state.letterMap = {};
  if(state.letterCounter==null) state.letterCounter = 0;
  if(!state.assets) state.assets = [];
  if(!state.stockMovements) state.stockMovements = [];
  if(!state.recurringInvoices) state.recurringInvoices = [];
  if(!state.auditLog) state.auditLog = [];
  if(!state.site){
    // Compatibilité avec une ancienne base qui listait plusieurs sites (state.sites) :
    // on ne consolide plus entre sites, donc on ne garde que l'identité du site de
    // CETTE installation (le siège s'il y en avait un, sinon le premier).
    const legacySites = Array.isArray(state.sites) ? state.sites : [];
    const chosen = legacySites.find(s=>s.isSiege) || legacySites[0];
    state.site = chosen ? {id:chosen.id, name:chosen.name, address:chosen.address, isSiege:true} : {id:uid('site'), name:"Mon site", address:"", isSiege:true};
  }
  delete state.sites;
  if(!state.magasins || !state.magasins.length){
    const m = {id:uid('mag'), name: state.settings.companyName || "Magasin principal", address:"", isDefault:true};
    state.magasins = [m];
  }
  state.magasins.forEach(m=>{ delete m.siteId; });
  const def = defaultMagasin();
  state.products.forEach(p=>{
    if(!p.stockByMagasin){
      p.stockByMagasin = p.stockBySite || { [def.id]: typeof p.stock==='number' ? p.stock : 0 };
      delete p.stockBySite;
      delete p.stock;
    }
  });
  [...state.invoices, ...state.devis, ...state.purchases, ...state.treasury].forEach(x=>{
    if(!x.magasinId){ x.magasinId = x.siteId!==undefined ? x.siteId : def.id; delete x.siteId; }
  });
  if(!state.counters) state.counters = {invoice:0, devis:0, creditNote:0, purchase:0};
  const numSuffix = (s)=>{ const m=/(\d+)$/.exec(s||''); return m ? parseInt(m[1],10) : 0; };
  state.counters.invoice = Math.max(state.counters.invoice||0, state.invoices.length, ...state.invoices.map(i=>numSuffix(i.number)));
  state.counters.devis = Math.max(state.counters.devis||0, state.devis.length, ...state.devis.map(d=>numSuffix(d.number)));
  state.counters.creditNote = Math.max(state.counters.creditNote||0, state.creditNotes.length, ...state.creditNotes.map(n=>numSuffix(n.number)));
  state.counters.purchase = Math.max(state.counters.purchase||0, state.purchases.length, ...state.purchases.map(p=>numSuffix(p.number)));
  if(!state.supplierCreditNotes) state.supplierCreditNotes = [];
  state.counters.supplierCreditNote = Math.max(state.counters.supplierCreditNote||0, state.supplierCreditNotes.length, ...state.supplierCreditNotes.map(n=>numSuffix(n.number)));
  if(state.settings.vatEnabled===undefined) state.settings.vatEnabled = false;
  if(!state.settings.vatRate && state.settings.vatRate!==0) state.settings.vatRate = 18;
  if(!state.settings.prefixInvoice) state.settings.prefixInvoice = "F";
  if(!state.settings.prefixDevis) state.settings.prefixDevis = "D";
  if(!state.settings.prefixCreditNote) state.settings.prefixCreditNote = "A";
  if(!state.settings.prefixPurchase) state.settings.prefixPurchase = "BC";
  if(!state.settings.prefixSupplierCreditNote) state.settings.prefixSupplierCreditNote = "AF";
  if(!state.activeScope) state.activeScope = "all";
  if(state.activeScope && state.activeScope!=='all' && !state.magasins.find(m=>m.id===state.activeScope)){
    state.activeScope='all';
  }
  purgeExpiredAccess();
}
export function purgeExpiredAccess(){
  if(!state.users) return;
  const now = new Date().toISOString();
  state.users = state.users.filter(u => !(u.temporary && u.expiresAt && u.expiresAt < now));
}

/* ---------------- storage ---------------- */
/* Ordre de résolution : window.storage (environnement Claude) → backend MySQL local (api.php) → localStorage.
   Adaptez API_URL si api.php n'est pas servi depuis le même dossier que ce fichier,
   et API_KEY pour qu'elle corresponde exactement à celle définie dans config.php. */
const API_URL = 'api.php';
const API_KEY = 'changeme-cle-secrete';
export function buildStatePayload(){
  return JSON.stringify({
    sector: state.sector, activeScope: state.activeScope, settings: state.settings,
    counters: state.counters, site: state.site, magasins: state.magasins, users: state.users, clients: state.clients, suppliers: state.suppliers,
    products: state.products, invoices: state.invoices, devis: state.devis,
    creditNotes: state.creditNotes, purchases: state.purchases, supplierCreditNotes: state.supplierCreditNotes,
    treasury: state.treasury, chartOfAccounts: state.chartOfAccounts, journalEntries: state.journalEntries,
    fiscalClosures: state.fiscalClosures, letterMap: state.letterMap, letterCounter: state.letterCounter,
    assets: state.assets, stockMovements: state.stockMovements, recurringInvoices: state.recurringInvoices, auditLog: state.auditLog
  });
}
export async function saveState(){
  const payload = buildStatePayload();
  if(window.storage){
    try{ await window.storage.set('balance-app-data', payload); return; }
    catch(e){ console.error('window.storage indisponible, tentative via le backend local', e); }
  }
  try{
    const res = await fetch(API_URL+'?action=save&key='+encodeURIComponent(API_KEY), {
      method:'POST', headers:{'Content-Type':'application/json'}, body: payload
    });
    if(res.ok) return;
    console.error('Échec de sauvegarde côté serveur', res.status);
  }catch(e){ console.error('Backend MySQL local injoignable', e); }
  try{ localStorage.setItem('balance-app-data', payload); }
  catch(e){ console.error('localStorage indisponible', e); showToast("Erreur d'enregistrement"); }
}
export async function loadState(){
  let raw = null;
  if(window.storage){
    try{ const res = await window.storage.get('balance-app-data'); if(res && res.value) raw = res.value; }
    catch(e){ /* pas de données côté Claude — on tente le backend local */ }
  }
  if(!raw){
    try{
      const res = await fetch(API_URL+'?action=load&key='+encodeURIComponent(API_KEY));
      if(res.ok){ const j = await res.json(); if(j && j.data) raw = j.data; }
    }catch(e){ /* pas de backend local disponible */ }
  }
  if(!raw){
    try{ raw = localStorage.getItem('balance-app-data'); }catch(e){}
  }
  if(raw){
    try{
      const d = JSON.parse(raw);
      const mergedSettings = Object.assign({}, state.settings, d.settings||{});
      const mergedCounters = Object.assign({}, state.counters, d.counters||{});
      Object.assign(state, d);
      state.settings = mergedSettings;
      state.counters = mergedCounters;
      migrateSites();
      return;
    }catch(e){ console.error('Données existantes illisibles', e); }
  }
  seedDemoData();
  await saveState();
}
export function seedDemoData(){
  const c1=uid('cli'), c2=uid('cli'), c3=uid('cli');
  state.clients = [
    {id:c1,name:"Adjovi & Fils",phone:"+229 97 00 11 22",email:"contact@adjovi.bj",address:"Cotonou, Akpakpa",createdAt:todayISO()},
    {id:c2,name:"Librairie Notre Dame",phone:"+229 96 45 78 90",email:"",address:"Cotonou, Cadjehoun",createdAt:todayISO()},
    {id:c3,name:"Restaurant Le Baobab",phone:"+229 95 33 21 10",email:"lebaobab@mail.com",address:"Cotonou, Fidjrossè",createdAt:todayISO()}
  ];
  const siteId = uid('site');
  state.site = {id:siteId, name:"Cotonou", address:"Cotonou", isSiege:true};
  const magA1 = uid('mag'), magA2 = uid('mag'), magB1 = uid('mag');
  state.magasins = [
    {id:magA1, name:"Boutique Akpakpa", address:"Cotonou, Akpakpa", isDefault:true},
    {id:magA2, name:"Boutique Fidjrossè", address:"Cotonou, Fidjrossè", isDefault:false},
    {id:magB1, name:"Boutique Centre", address:"Cotonou, Centre", isDefault:false}
  ];
  const p1=uid('prd'), p2=uid('prd'), p3=uid('prd'), p4=uid('prd');
  state.products=[
    {id:p1,name:"Sac de riz 25kg",category:"Alimentaire",price:14000,cost:11500,minStock:10,unit:"sac",stockByMagasin:{[magA1]:18,[magA2]:6,[magB1]:10}},
    {id:p2,name:"Bidon d'huile 20L",category:"Alimentaire",price:21000,cost:18000,minStock:8,unit:"bidon",stockByMagasin:{[magA1]:3,[magA2]:1,[magB1]:2}},
    {id:p3,name:"Casier de boissons",category:"Boisson",price:6000,cost:4500,minStock:15,unit:"casier",stockByMagasin:{[magA1]:22,[magA2]:10,[magB1]:20}},
    {id:p4,name:"Ramette papier A4",category:"Bureautique",price:2800,cost:2100,minStock:10,unit:"ramette",stockByMagasin:{[magA1]:3,[magA2]:0,[magB1]:0}}
  ];
  const today = new Date();
  function iso(offsetDays){ const d=new Date(today); d.setDate(d.getDate()+offsetDays); return d.toISOString().slice(0,10); }
  state.invoices=[
    {id:uid('inv'),number:"F-0001",clientId:c1,magasinId:magA1,date:iso(-20),dueDate:iso(-5),status:"Payée",delivered:true,reminders:[],payments:[{id:uid('pay'),date:iso(-19),amount:140000,method:"Espèces"}],items:[{productId:p1,name:"Sac de riz 25kg",qty:10,price:14000}]},
    {id:uid('inv'),number:"F-0002",clientId:c3,magasinId:magB1,date:iso(-12),dueDate:iso(2),status:"En attente",delivered:true,reminders:[],payments:[],items:[{productId:p3,name:"Casier de boissons",qty:8,price:6000},{productId:p2,name:"Bidon d'huile 20L",qty:2,price:21000}]},
    {id:uid('inv'),number:"F-0003",clientId:c2,magasinId:magA2,date:iso(-40),dueDate:iso(-25),status:"En attente",delivered:false,reminders:[{date:iso(-10)}],payments:[],items:[{productId:p4,name:"Ramette papier A4",qty:15,price:2800}]}
  ];
  state.devis=[
    {id:uid('dev'),number:"D-0001",clientId:c3,magasinId:magB1,date:iso(-3),validUntil:iso(27),status:"Envoyé",items:[{productId:p2,name:"Bidon d'huile 20L",qty:4,price:21000},{productId:p3,name:"Casier de boissons",qty:6,price:6000}]}
  ];
  state.creditNotes=[];
  state.treasury=[
    {id:uid('trs'),date:iso(-20),label:"Encaissement F-0001",type:"in",category:"ventes",magasinId:magA1,amount:140000},
    {id:uid('trs'),date:iso(-18),label:"Loyer boutique",type:"out",category:"loyer",method:"Virement",magasinId:null,amount:60000},
    {id:uid('trs'),date:iso(-6),label:"Achat marchandises",type:"out",category:"achats",magasinId:magA1,amount:95000}
  ];
  const supplier1 = uid('sup');
  state.suppliers = [
    {id:supplier1, name:"Grossiste Dantokpa", phone:"+229 21 30 45 60", email:"", address:"Cotonou, Dantokpa", createdAt:todayISO(), createdBy:""}
  ];
  state.purchases=[
    {id:uid('pur'),number:"BC-0001",supplierId:supplier1,supplier:"Grossiste Dantokpa",date:iso(-7),dueDate:iso(23),expectedDate:iso(-2),magasinId:magA1,status:"Reçue",payments:[{id:uid('pay'),date:iso(-6),amount:230000,method:"Espèces"}],receptions:[{date:iso(-3),items:[{name:"Sac de riz 25kg",qty:20}],receivedBy:"Michel"}],createdBy:"",items:[{productId:p1,name:"Sac de riz 25kg",qty:20,cost:11500,receivedQty:20}]},
    {id:uid('pur'),number:"BC-0002",supplierId:supplier1,supplier:"Grossiste Dantokpa",date:iso(-10),dueDate:iso(20),expectedDate:iso(-3),magasinId:magA1,status:"Commandée",payments:[],receptions:[],createdBy:"",items:[{productId:p2,name:"Bidon d'huile 20L",qty:15,cost:18000,receivedQty:0}]}
  ];
  state.treasury.push({id:uid('trs'),date:state.purchases[0].payments[0].date,label:"Paiement BC-0001 — Grossiste Dantokpa — Espèces",type:"out",category:"achats",method:"Espèces",magasinId:magA1,amount:230000,generatedFrom:{type:'purchase', id:state.purchases[0].id}});
  state.counters = { invoice: state.invoices.length, devis: state.devis.length, creditNote: state.creditNotes.length, purchase: state.purchases.length, supplierCreditNote: 0 };

  /* comptabilité : plan comptable + écritures reflétant les opérations ci-dessus */
  state.chartOfAccounts = DEFAULT_CHART_OF_ACCOUNTS.map(a=>({...a}));
  state.journalEntries = [];
  state.fiscalClosures = [];
  state.letterMap = {};
  state.letterCounter = 0;
  const inv1 = state.invoices[0], inv2 = state.invoices[1], inv3 = state.invoices[2];
  pushJournalEntry("VE", inv1.date, "Facture "+inv1.number+" — "+clientName(c1), [
    {account:"411", label:"Client Adjovi & Fils", debit:140000, credit:0, tiers:{type:'client',id:c1,name:"Adjovi & Fils"}, lettre:getOrCreateLettre('invoice',inv1.id)},
    {account:"707", label:"Vente "+inv1.number, debit:0, credit:140000}
  ], {type:'invoice', id:inv1.id});
  pushJournalEntry("VE", inv1.date, "Coût des marchandises vendues — "+inv1.number, [
    {account:"6031", label:"Sortie de stock "+inv1.number, debit:115000, credit:0},
    {account:"311", label:"Stock — "+inv1.number, debit:0, credit:115000}
  ], {type:'invoice', id:inv1.id});
  pushJournalEntry("BQ", inv1.payments[0].date, "Encaissement "+inv1.number+" — "+clientName(c1), [
    {account:"571", label:"Caisse", debit:140000, credit:0},
    {account:"411", label:"Client Adjovi & Fils", debit:0, credit:140000, tiers:{type:'client',id:c1,name:"Adjovi & Fils"}, lettre:getOrCreateLettre('invoice',inv1.id)}
  ], {type:'payment', id:inv1.payments[0].id});
  pushJournalEntry("VE", inv2.date, "Facture "+inv2.number+" — "+clientName(c3), [
    {account:"411", label:"Client Restaurant Le Baobab", debit:90000, credit:0, tiers:{type:'client',id:c3,name:"Restaurant Le Baobab"}, lettre:getOrCreateLettre('invoice',inv2.id)},
    {account:"707", label:"Vente "+inv2.number, debit:0, credit:90000}
  ], {type:'invoice', id:inv2.id});
  pushJournalEntry("VE", inv2.date, "Coût des marchandises vendues — "+inv2.number, [
    {account:"6031", label:"Sortie de stock "+inv2.number, debit:72000, credit:0},
    {account:"311", label:"Stock — "+inv2.number, debit:0, credit:72000}
  ], {type:'invoice', id:inv2.id});
  pushJournalEntry("VE", inv3.date, "Facture "+inv3.number+" — "+clientName(c2), [
    {account:"411", label:"Client Librairie Notre Dame", debit:42000, credit:0, tiers:{type:'client',id:c2,name:"Librairie Notre Dame"}, lettre:getOrCreateLettre('invoice',inv3.id)},
    {account:"707", label:"Vente "+inv3.number, debit:0, credit:42000}
  ], {type:'invoice', id:inv3.id});
  pushJournalEntry("VE", inv3.date, "Coût des marchandises vendues — "+inv3.number, [
    {account:"6031", label:"Sortie de stock "+inv3.number, debit:31500, credit:0},
    {account:"311", label:"Stock — "+inv3.number, debit:0, credit:31500}
  ], {type:'invoice', id:inv3.id});
  const pur1 = state.purchases[0];
  pushJournalEntry("AC", pur1.receptions[0].date, "Réception "+pur1.number+" — "+pur1.supplier, [
    {account:"311", label:"Stock — "+pur1.supplier, debit:230000, credit:0},
    {account:"401", label:"Fournisseur "+pur1.supplier, debit:0, credit:230000, tiers:{type:'supplier',id:supplier1,name:pur1.supplier}, lettre:getOrCreateLettre('purchase',pur1.id)}
  ], {type:'reception', id:pur1.id});
  pushJournalEntry("BQ", pur1.payments[0].date, "Paiement fournisseur "+pur1.number+" — "+pur1.supplier, [
    {account:"401", label:"Fournisseur "+pur1.supplier, debit:230000, credit:0, tiers:{type:'supplier',id:supplier1,name:pur1.supplier}, lettre:getOrCreateLettre('purchase',pur1.id)},
    {account:"571", label:"Caisse", debit:0, credit:230000}
  ], {type:'supplierPayment', id:pur1.payments[0].id});
  pushJournalEntry("OD", state.treasury[1].date, "Loyer boutique", [
    {account:"613", label:"Loyer boutique", debit:60000, credit:0},
    {account:"512", label:"Banque", debit:0, credit:60000}
  ], {type:'treasury', id:state.treasury[1].id});
  pushJournalEntry("OD", state.treasury[2].date, "Achat marchandises", [
    {account:"601", label:"Achat marchandises", debit:95000, credit:0},
    {account:"571", label:"Caisse", debit:0, credit:95000}
  ], {type:'treasury', id:state.treasury[2].id});
}

