/* ==========================================================
   pages/Settings.js — Paramètres (page principale)
   Extrait des lignes 4412-4567 et 4623-4684 du fichier d'origine.
   Les sous-sections vivent dans pages/settings/{TempAccess,Backup,Organization}.js
   ========================================================== */
import { state, sectorCfg, saveState } from '../core/state.js';
import { esc } from '../core/utils.js';
import { showToast } from '../components/Toast.js';
import { can } from '../core/auth.js';
import { logAudit, diffFields } from '../core/audit.js';
import { renderLayout } from '../components/Layout.js';
import { SECTORS } from '../core/constants.js';

// Ré-exporte les sous-modules pour que router.js n'ait qu'un seul import à faire,
// et pour que leurs fonctions onclick="" (déjà exposées sur window par chaque fichier) se chargent.
export { openTempAccessModal, generateTempAccess, revokeTempAccess } from './settings/TempAccess.js';
export { exportBackup, restoreBackup, resetData } from './settings/Backup.js';
export { openSiteModal, saveSite, openMagasinModal, saveMagasin, deleteMagasin } from './settings/Organization.js';

export function renderSettings(){
  const sectorOptions = Object.entries(SECTORS).map(([k,v])=>`<option value="${k}" ${k===state.sector?'selected':''}>${v.label}</option>`).join('');
  return `
    <div class="two-col">
      <div>
        <div class="panel">
          <div class="panel-head"><h3>Informations de l'entreprise</h3></div>
          <div class="panel-body">
            <div class="field"><label>Nom de l'entreprise</label><input id="s-name" value="${esc(state.settings.companyName)}"></div>
            <div class="field">
              <label>Logo de l'entreprise (facultatif)</label>
              <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
                ${state.settings.companyLogo ? `<img src="${state.settings.companyLogo}" alt="Logo" style="height:48px;max-width:140px;object-fit:contain;border:1px solid var(--line);border-radius:6px;padding:4px;background:#fff;">` : `<div style="height:48px;width:80px;border:1px dashed var(--line);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.68rem;color:var(--ink-soft);text-align:center;">Aucun logo</div>`}
                <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('logo-file-input').click()">Choisir une image</button>
                ${state.settings.companyLogo ? `<button type="button" class="btn btn-ghost btn-sm" onclick="removeLogo()">Supprimer</button>` : ''}
                <input type="file" id="logo-file-input" accept="image/*" class="hidden" onchange="handleLogoUpload(this)">
              </div>
              <p style="font-size:.74rem;color:var(--ink-soft);margin:6px 0 0;">Apparaît en en-tête de vos factures, devis et avoirs imprimés. PNG ou JPG recommandé ; l'image est automatiquement redimensionnée.</p>
            </div>
            <div class="field-row">
              <div class="field"><label>Devise</label>
                <select id="s-currency">
                  <option value="FCFA" ${state.settings.currency==='FCFA'?'selected':''}>FCFA</option>
                  <option value="EUR" ${state.settings.currency==='EUR'?'selected':''}>EUR</option>
                  <option value="USD" ${state.settings.currency==='USD'?'selected':''}>USD</option>
                </select>
              </div>
              <div class="field"><label>Secteur d'activité</label>
                <select id="s-sector">${sectorOptions}</select>
              </div>
            </div>
            <p style="font-size:.78rem;color:var(--ink-soft);margin:-6px 0 12px;">Le secteur adapte le vocabulaire et les modules affichés (ex. « Produits » devient « Prestations » en secteur Services).</p>
            <button class="btn btn-primary" onclick="saveSettings()">Enregistrer</button>
          </div>
        </div>

        <div class="panel" style="margin-top:16px;">
          <div class="panel-head"><h3>Numérotation des documents</h3></div>
          <div class="panel-body">
            <div class="field-row">
              <div class="field"><label>Préfixe factures</label><input id="s-prefix-invoice" value="${esc(state.settings.prefixInvoice)}" maxlength="6"></div>
              <div class="field"><label>Préfixe devis</label><input id="s-prefix-devis" value="${esc(state.settings.prefixDevis)}" maxlength="6"></div>
            </div>
            <div class="field-row">
              <div class="field"><label>Préfixe avoirs clients</label><input id="s-prefix-creditnote" value="${esc(state.settings.prefixCreditNote)}" maxlength="6"></div>
              <div class="field"><label>Préfixe bons de commande</label><input id="s-prefix-purchase" value="${esc(state.settings.prefixPurchase)}" maxlength="6"></div>
            </div>
            <div class="field-row">
              <div class="field"><label>Préfixe avoirs fournisseurs</label><input id="s-prefix-supplier-creditnote" value="${esc(state.settings.prefixSupplierCreditNote)}" maxlength="6"></div>
            </div>
            <p style="font-size:.78rem;color:var(--ink-soft);margin:6px 0 12px;">Exemple : préfixe « ${esc(state.settings.prefixInvoice)} » donne des numéros du type ${esc(state.settings.prefixInvoice)}-0001. Le changement ne s'applique qu'aux prochains documents ; les numéros déjà émis ne sont jamais modifiés.</p>
            <button class="btn btn-primary" onclick="saveSettings()">Enregistrer</button>
          </div>
        </div>

        <div class="panel" style="margin-top:16px;">
          <div class="panel-head"><h3>Taxes (TVA)</h3></div>
          <div class="panel-body">
            <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;margin-bottom:12px;cursor:pointer;">
              <input type="checkbox" id="s-vat-enabled" ${state.settings.vatEnabled?'checked':''} style="width:16px;height:16px;">
              Assujetti à la TVA
            </label>
            <div class="field" style="max-width:220px;"><label>Taux standard (%)</label><input id="s-vat-rate" type="number" min="0" max="100" step="0.5" value="${state.settings.vatRate}"></div>
            <div class="field"><label>Identifiant fiscal (IFU / SIREN…)</label><input id="s-tax-id" value="${esc(state.settings.taxId||'')}" placeholder="Ex : 3202100000000"></div>
            <p style="font-size:.78rem;color:var(--ink-soft);margin:6px 0 12px;">Si désactivé, aucune TVA n'est calculée et les montants restent nets. Un taux différent peut être défini par article (fiche produit) pour les cas dérogatoires. L'identifiant fiscal sert à nommer le fichier d'export comptable (FEC).</p>
            <button class="btn btn-primary" onclick="saveSettings()">Enregistrer</button>
          </div>
        </div>

        ${sectorCfg().stock ? `
        <div class="panel" style="margin-top:16px;">
          <div class="panel-head"><h3>Stock</h3></div>
          <div class="panel-body">
            <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;margin-bottom:8px;cursor:pointer;">
              <input type="checkbox" id="s-block-negative-stock" ${state.settings.blockNegativeStock?'checked':''} style="width:16px;height:16px;">
              Bloquer les ventes en cas de stock insuffisant
            </label>
            <p style="font-size:.78rem;color:var(--ink-soft);margin:6px 0 12px;">
              <strong>Activé</strong> : impossible d'enregistrer une vente ou un retour fournisseur si la quantité disponible est insuffisante — la vente est refusée jusqu'à réapprovisionnement.<br>
              <strong>Désactivé</strong> (par défaut) : un avertissement s'affiche mais la vente peut être forcée, le stock devenant alors négatif jusqu'au réapprovisionnement.
            </p>
            <button class="btn btn-primary" onclick="saveSettings()">Enregistrer</button>
          </div>
        </div>` : ''}
      </div>

      <div>
        <div class="panel">
          <div class="panel-head"><h3>Accès de maintenance</h3></div>
          <div class="panel-body">
            <p style="font-size:.78rem;color:var(--ink-soft);margin-top:0;">Autorisez temporairement votre développeur ou prestataire technique à se connecter, pour une durée limitée. L'accès expire automatiquement et vous pouvez le révoquer à tout moment — vous gardez le contrôle.</p>
            ${state.users.filter(u=>u.temporary).length ? state.users.filter(u=>u.temporary).map(u=>`
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);font-size:.85rem;">
                <div>
                  <strong>${esc(u.name)}</strong>
                  <div style="font-size:.72rem;color:var(--ink-soft);">Accordé par ${esc(u.grantedBy)} · expire le ${new Date(u.expiresAt).toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                </div>
                <button class="btn btn-danger btn-sm" onclick="revokeTempAccess('${u.id}')">Révoquer</button>
              </div>
            `).join('') : `<p style="font-size:.82rem;color:var(--ink-soft);">Aucun accès technique actif actuellement.</p>`}
            <button class="btn btn-primary" style="margin-top:12px;" onclick="openTempAccessModal()">+ Générer un accès technique</button>
          </div>
        </div>

        <div class="panel" style="margin-top:16px;">
          <div class="panel-head"><h3>Données</h3></div>
          <div class="panel-body">
            <p style="font-size:.85rem;color:var(--ink-soft);margin-top:0;">Toutes les données sont enregistrées automatiquement et de façon privée pour votre compte.</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
              <button class="btn btn-ghost" onclick="exportBackup()">Télécharger une sauvegarde complète</button>
              <button class="btn btn-ghost" onclick="document.getElementById('restore-file-input').click()">Restaurer depuis une sauvegarde</button>
              <input type="file" id="restore-file-input" accept="application/json" class="hidden" onchange="restoreBackup(this.files[0])">
            </div>
            <p style="font-size:.76rem;color:var(--ink-soft);margin:-6px 0 14px;">La sauvegarde contient toutes vos données (clients, factures, stock, utilisateurs…) dans un fichier .json à conserver en lieu sûr. À faire régulièrement, et impérativement avant toute restauration ou réinitialisation.</p>
            <button class="btn btn-danger" onclick="resetData()">Réinitialiser toutes les données</button>
          </div>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top:16px;">
      <div class="panel-head"><h3>Organisation — site &amp; magasins</h3></div>
      <div class="panel-body">
        <p style="font-size:.78rem;color:var(--ink-soft);margin-top:0;">Chaque site a sa propre base de données, indépendante des autres — cette base correspond à un seul site, qui peut regrouper plusieurs magasins (entrepôts, points de vente). Le stock est suivi magasin par magasin ; le sélecteur de portée (barre latérale) permet de basculer entre une vue par magasin ou consolidée pour ce site.</p>
        <div style="border:1px solid var(--line);border-radius:8px;padding:14px 16px;max-width:480px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <strong>${esc(state.site.name)}</strong>${state.site.isSiege?' <span class="badge badge-neutral">siège</span>':''}
              <div style="font-size:.78rem;color:var(--ink-soft);">${esc(state.site.address)||'—'}</div>
            </div>
            <button class="icon-btn" onclick="openSiteModal()" title="Modifier">✎</button>
          </div>
        </div>
        <h4 style="margin:18px 0 8px;font-size:.9rem;">Magasins de ce site</h4>
        <div class="grid-kpi" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr));margin-bottom:12px;">
          ${state.magasins.map(m=>`
            <div style="display:flex;justify-content:space-between;align-items:center;border:1px solid var(--line);border-radius:8px;padding:10px 14px;font-size:.85rem;">
              <span>${esc(m.name)}${m.isDefault?' <span class="badge badge-neutral">par défaut</span>':''}</span>
              <div class="row-actions">
                <button class="icon-btn" onclick="openMagasinModal('${m.id}')" title="Modifier">✎</button>
                <button class="icon-btn" onclick="deleteMagasin('${m.id}')" title="Supprimer">✕</button>
              </div>
            </div>
          `).join('') || `<div class="empty" style="padding:14px 0;">Aucun magasin pour l'instant.</div>`}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="openMagasinModal()">+ Nouveau magasin</button>
      </div>
    </div>
  `;
}

export function handleLogoUpload(input){
  const file = input.files && input.files[0];
  if(!file) return;
  if(!file.type.startsWith('image/')){ showToast("Choisissez un fichier image (PNG, JPG…)"); return; }
  if(file.size > 4*1024*1024){ showToast("Image trop lourde (max 4 Mo)"); return; }
  const reader = new FileReader();
  reader.onload = function(e){
    const img = new Image();
    img.onload = function(){
      const maxW = 320, maxH = 160;
      const ratio = Math.min(1, maxW/img.width, maxH/img.height);
      const w = Math.max(1, Math.round(img.width*ratio)), h = Math.max(1, Math.round(img.height*ratio));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      state.settings.companyLogo = canvas.toDataURL('image/png');
      logAudit('modification','parametres','settings',"Paramètres généraux",[{field:'Logo', from:'—', to:'mis à jour'}]);
      saveState(); renderLayout(); showToast("Logo mis à jour");
    };
    img.onerror = function(){ showToast("Impossible de lire cette image"); };
    img.src = e.target.result;
  };
  reader.onerror = function(){ showToast("Erreur de lecture du fichier"); };
  reader.readAsDataURL(file);
}
export function removeLogo(){
  state.settings.companyLogo = "";
  logAudit('modification','parametres','settings',"Paramètres généraux",[{field:'Logo', from:'présent', to:'supprimé'}]);
  saveState(); renderLayout(); showToast("Logo supprimé");
}

export function saveSettings(){
  if(!can('settings')){ showToast("Action réservée aux administrateurs"); return; }
  const before = {...state.settings};
  const beforeSector = state.sector;
  state.settings.companyName = document.getElementById('s-name').value.trim() || "Mon entreprise";
  state.settings.currency = document.getElementById('s-currency').value;
  state.sector = document.getElementById('s-sector').value;
  state.settings.vatEnabled = document.getElementById('s-vat-enabled').checked;
  state.settings.vatRate = Number(document.getElementById('s-vat-rate').value)||0;
  const bns = document.getElementById('s-block-negative-stock');
  if(bns) state.settings.blockNegativeStock = bns.checked;
  const taxId = document.getElementById('s-tax-id');
  if(taxId) state.settings.taxId = taxId.value.trim();
  const pi = document.getElementById('s-prefix-invoice');
  if(pi){
    state.settings.prefixInvoice = pi.value.trim().toUpperCase() || "F";
    state.settings.prefixDevis = document.getElementById('s-prefix-devis').value.trim().toUpperCase() || "D";
    state.settings.prefixCreditNote = document.getElementById('s-prefix-creditnote').value.trim().toUpperCase() || "A";
    state.settings.prefixPurchase = document.getElementById('s-prefix-purchase').value.trim().toUpperCase() || "BC";
    state.settings.prefixSupplierCreditNote = document.getElementById('s-prefix-supplier-creditnote').value.trim().toUpperCase() || "AF";
  }
  const changes = diffFields(before, state.settings, {
    companyName:"Nom de l'entreprise", currency:'Devise', vatEnabled:'TVA activée', vatRate:'Taux de TVA',
    blockNegativeStock:'Blocage stock négatif', taxId:'Identifiant fiscal', prefixInvoice:'Préfixe factures',
    prefixDevis:'Préfixe devis', prefixCreditNote:'Préfixe avoirs clients', prefixPurchase:'Préfixe commandes',
    prefixSupplierCreditNote:'Préfixe avoirs fournisseurs'
  });
  if(state.sector!==beforeSector) changes.push({field:'Secteur d\'activité', from:beforeSector, to:state.sector});
  if(changes.length) logAudit('modification','parametres', 'settings', "Paramètres généraux", changes);
  saveState(); renderLayout(); showToast("Paramètres enregistrés");
}

// Exposition sur window pour les gabarits HTML (onclick="...") — voir pages/Clients.js pour la note complète.
Object.assign(window, { handleLogoUpload, removeLogo, saveSettings });
