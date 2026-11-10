/* ==========================================================
   pages/settings/Backup.js — sauvegarde / restauration / réinitialisation
   Extrait des lignes 4685-4744 du fichier d'origine.
   ========================================================== */
import { state, setCurrentUser, saveState, seedDemoData, migrateSites } from '../../core/state.js';
import { todayISO } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { can } from '../../core/auth.js';
import { renderRoot } from '../../main.js';

export function exportBackup(){
  if(!can('settings')){ showToast("Action réservée aux administrateurs"); return; }
  const payload = {
    __balanceBackup: true, version: 1, exportedAt: new Date().toISOString(),
    sector: state.sector, activeScope: state.activeScope, settings: state.settings,
    counters: state.counters, site: state.site, magasins: state.magasins, suppliers: state.suppliers,
    users: state.users.map(u=>({...u})), clients: state.clients, products: state.products,
    invoices: state.invoices, devis: state.devis, creditNotes: state.creditNotes,
    purchases: state.purchases, treasury: state.treasury, supplierCreditNotes: state.supplierCreditNotes,
    chartOfAccounts: state.chartOfAccounts, journalEntries: state.journalEntries, fiscalClosures: state.fiscalClosures,
    letterMap: state.letterMap, letterCounter: state.letterCounter, assets: state.assets, stockMovements: state.stockMovements, recurringInvoices: state.recurringInvoices, auditLog: state.auditLog
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = todayISO();
  a.href = url; a.download = `balance-sauvegarde-${stamp}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
  showToast("Sauvegarde téléchargée");
}

export function restoreBackup(file){
  if(!can('settings')){ showToast("Action réservée aux administrateurs"); return; }
  if(!file) return;
  if(!confirm("Restaurer une sauvegarde remplace TOUTES les données actuelles. Avez-vous téléchargé une sauvegarde récente avant de continuer ?")) {
    document.getElementById('restore-file-input').value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      const d = JSON.parse(e.target.result);
      if(!d || !d.__balanceBackup){ showToast("Ce fichier ne semble pas être une sauvegarde Balance valide"); return; }
      // Compatibilité avec les sauvegardes faites avant l'évolution du modèle :
      // - format le plus ancien : Annexe → Site (d.annexes / d.sites avec annexeId)
      // - format intermédiaire : Site → Magasin, plusieurs sites (d.sites / d.magasins avec siteId)
      // - format actuel : un seul site par base (d.site / d.magasins sans siteId)
      // migrateSites() sait déjà tout collapser vers le format actuel — on lui laisse
      // le travail en lui passant les champs bruts de la sauvegarde, quel que soit son âge.
      let sites, magasins;
      if(d.annexes){
        sites = d.annexes.map((a,i)=>({id:a.id, name:a.name, address:a.address, isSiege:i===0}));
        magasins = (d.sites||[]).map(s=>({id:s.id, siteId:s.annexeId, name:s.name, address:s.address, isDefault:s.isDefault}));
      } else {
        sites = d.sites || (d.site ? [d.site] : []);
        magasins = d.magasins || [];
      }
      Object.assign(state, {
        sector:d.sector, activeScope: d.activeScope || 'all', settings:d.settings, counters:d.counters,
        site: d.site || null, sites, magasins, suppliers:d.suppliers||[], users:d.users||[],
        clients:d.clients||[], products:d.products||[], invoices:d.invoices||[], devis:d.devis||[],
        creditNotes:d.creditNotes||[], purchases:d.purchases||[], treasury:d.treasury||[], supplierCreditNotes:d.supplierCreditNotes||[],
        chartOfAccounts:d.chartOfAccounts||[], journalEntries:d.journalEntries||[], fiscalClosures:d.fiscalClosures||[],
        letterMap:d.letterMap||{}, letterCounter:d.letterCounter||0, assets:d.assets||[], stockMovements:d.stockMovements||[], recurringInvoices:d.recurringInvoices||[], auditLog:d.auditLog||[]
      });
      migrateSites();
      setCurrentUser(null);
      saveState();
      showToast("Sauvegarde restaurée — reconnectez-vous");
      renderRoot();
    }catch(err){
      showToast("Fichier invalide ou corrompu");
    }
    document.getElementById('restore-file-input').value = '';
  };
  reader.readAsText(file);
}

export function resetData(){
  if(!can('settings')){ showToast("Action réservée aux administrateurs"); return; }
  if(!confirm("Cette action supprime toutes les données, y compris les comptes utilisateurs. Continuer ?")) return;
  state.site=null; state.magasins=[]; state.activeScope='all'; state.users=[]; state.clients=[]; state.suppliers=[]; state.products=[]; state.invoices=[]; state.devis=[]; state.creditNotes=[]; state.purchases=[]; state.supplierCreditNotes=[]; state.treasury=[]; state.chartOfAccounts=[]; state.journalEntries=[]; state.fiscalClosures=[]; state.letterMap={}; state.letterCounter=0; state.assets=[]; state.stockMovements=[]; state.recurringInvoices=[]; state.auditLog=[];
  seedDemoData(); saveState(); setCurrentUser(null); renderRoot(); showToast("Données réinitialisées");
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { exportBackup, restoreBackup, resetData });
