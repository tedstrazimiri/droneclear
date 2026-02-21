// =============================================================
// modal.js — Component detail modal and language toggle
// =============================================================

function updateLanguage(lang) {
    currentLang = lang;
    const els = document.querySelectorAll('[data-i18n]');
    els.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const map = {
            appTitle:        { en: 'Drone Models',                        fr: 'Modèles de Drones' },
            appSubtitle:     { en: 'Builder & Visualizer',                fr: 'Constructeur et Visualiseur' },
            navMasterAttr:   { en: 'Master Attributes',                   fr: 'Attributs Principaux' },
            navLibraryEditor:{ en: 'Parts Library Editor',                fr: 'Éditeur de Bibliothèque' },
            navBuildWizard:  { en: 'Build Wizard',                        fr: 'Assistant de Montage' },
            btnUploadJson:   { en: 'Upload Custom JSON',                  fr: 'Importer JSON' },
            textLoading:     { en: 'Loading Components...',               fr: 'Chargement des composants...' },
            errLoadTitle:    { en: 'Failed to load',                      fr: 'Échec du chargement' },
            errLoadDesc:     { en: 'Please make sure the file is in the same directory.', fr: 'Assurez-vous que le fichier est dans le répertoire.' },
            btnAddBuild:     { en: 'Add to Build',                        fr: 'Ajouter au Montage' },
            btnEditPart:     { en: 'Edit Component',                      fr: 'Modifier la Pièce' }
        };
        if (map[key]?.[lang]) el.innerText = map[key][lang];
    });

    const btnEn = document.getElementById('btn-lang-en');
    const btnFr = document.getElementById('btn-lang-fr');
    if (btnEn && btnFr) {
        const isEn = lang === 'en';
        btnEn.style.background    = isEn ? 'white' : 'transparent';
        btnEn.style.color         = isEn ? 'var(--accent-red)' : 'var(--text-muted)';
        btnEn.style.boxShadow     = isEn ? 'var(--card-shadow)' : 'none';
        btnFr.style.background    = isEn ? 'transparent' : 'white';
        btnFr.style.color         = isEn ? 'var(--text-muted)' : 'var(--accent-red)';
        btnFr.style.boxShadow     = isEn ? 'none' : 'var(--card-shadow)';
    }

    updateBuildTotals();
}

function openModal(comp) {
    activeModalComponent = comp;

    elements.modalTitle.textContent = comp.name || 'Unnamed';
    elements.modalMfg.textContent   = comp.manufacturer || 'Unknown';
    elements.modalPid.textContent   = comp.pid || 'N/A';
    elements.modalDesc.textContent  = comp.description || '';

    if (comp.link) {
        elements.modalLink.href = comp.link;
        elements.modalLink.style.display = 'inline-flex';
    } else {
        elements.modalLink.style.display = 'none';
    }

    elements.modalTags.innerHTML = (comp.schema_data?.tags || []).map(t => `<span class="tag">${t}</span>`).join('');

    // Specs & Notes
    const specsHtml = [];
    const notesHtml = [];
    const sd = comp.schema_data || {};
    const ignoredKeys = ['tags', 'compatibility', 'weight_g'];

    Object.keys(sd).forEach(key => {
        if (ignoredKeys.includes(key)) return;
        const val = sd[key];

        if (key.startsWith('_')) {
            notesHtml.push(`<div class="note-item"><strong>${key}</strong><span>${val}</span></div>`);
        } else if (val !== null && typeof val !== 'object') {
            let displayVal = val;
            let valClass = '';
            if (typeof val === 'boolean') {
                displayVal = val ? (currentLang === 'fr' ? 'Oui' : 'Yes') : (currentLang === 'fr' ? 'Non' : 'No');
                valClass = val ? 'bool-true' : 'bool-false';
            }
            specsHtml.push(`<div class="spec-item"><span class="spec-label">${formatTitle(key)}</span><span class="spec-value ${valClass}">${displayVal}</span></div>`);
        } else if (Array.isArray(val) && typeof val[0] !== 'object') {
            specsHtml.push(`<div class="spec-item"><span class="spec-label">${formatTitle(key)}</span><span class="spec-value">${val.join(', ')}</span></div>`);
        }
    });

    elements.modalSpecs.innerHTML = specsHtml.join('');

    if (notesHtml.length > 0) {
        elements.modalNotes.innerHTML = notesHtml.join('');
        elements.modalNotesSection.classList.remove('hidden');
    } else {
        elements.modalNotesSection.classList.add('hidden');
    }

    // Compatibility section
    const compCompat = comp.schema_data?.compatibility || {};
    if (Object.keys(compCompat).length > 0) {
        elements.modalCompat.innerHTML = Object.entries(compCompat).map(([k, v]) => {
            let displayVal = v;
            if (Array.isArray(v)) displayVal = v.join(', ');
            else if (typeof v === 'boolean') displayVal = v ? 'Yes' : 'No';
            return `
                <div class="spec-item" style="border-color: rgba(6, 182, 212, 0.3); background: rgba(6, 182, 212, 0.05);">
                    <span class="spec-label" style="color: var(--accent-cyan);">${formatTitle(k)}</span>
                    <span class="spec-value">${displayVal}</span>
                </div>`;
        }).join('');
        elements.modalCompatSection.classList.remove('hidden');
    } else {
        elements.modalCompatSection.classList.add('hidden');
    }

    // Similar alternatives
    const similarComps = findSimilarComponents(comp);
    if (similarComps.length > 0) {
        elements.modalSimilarGrid.innerHTML = similarComps.map(simItem => {
            const priceHtml = simItem.approx_price ? `<span style="color:var(--accent-green);font-size:12px;">${simItem.approx_price}</span>` : '';
            return `
                <div class="similar-card" title="Switch to ${simItem.name}" style="cursor:pointer;padding:10px;border:1px solid rgba(255,255,255,0.1);border-radius:6px;background:rgba(0,0,0,0.2);" onclick="switchModalItem('${simItem.pid}')">
                    <div style="font-size:11px;color:var(--text-muted);">${simItem.manufacturer || 'Unknown'}</div>
                    <div style="font-weight:600;font-size:13px;margin:4px 0;">${simItem.name}</div>
                    ${priceHtml}
                </div>`;
        }).join('');
        elements.modalSimilarSection.classList.remove('hidden');
    } else {
        elements.modalSimilarSection.classList.add('hidden');
    }

    // Image
    if (comp.image_file) {
        elements.modalImageContainer.innerHTML = `<img src="${comp.image_file}" alt="Component Image" class="modal-image" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'ph ph-image-broken\\'></i>';">`;
    } else {
        elements.modalImageContainer.innerHTML = `<i class="ph ph-image"></i>`;
    }

    elements.modalEditBtn.href = `/editor/?edit_pid=${comp.pid}`;
    elements.modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    elements.modal.classList.add('hidden');
    document.body.style.overflow = '';
}

window.switchModalItem = function(pid) {
    if (!schemaData[currentCategory]) return;
    const item = schemaData[currentCategory].find(c => c.pid === pid);
    if (item) {
        elements.modal.classList.add('hidden');
        setTimeout(() => openModal(item), 50);
    }
};
