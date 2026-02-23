// =============================================================
// modal.js — Component detail modal and language toggle
// =============================================================

// Extract unit suffix from field name (e.g., _mm → mm, _in → ", _v → V, _a → A, _mw → mW)
function _extractUnit(fieldName) {
    if (fieldName.endsWith('_mm')) return 'mm';
    if (fieldName.endsWith('_in')) return '"';
    if (fieldName.endsWith('_v')) return 'V';
    if (fieldName.endsWith('_a')) return 'A';
    if (fieldName.endsWith('_mw')) return 'mW';
    if (fieldName.endsWith('_mah')) return 'mAh';
    if (fieldName.endsWith('_deg')) return '\u00B0';
    if (fieldName.endsWith('_g')) return 'g';
    if (fieldName.endsWith('_w')) return 'W';
    if (fieldName.endsWith('_ms')) return 'ms';
    if (fieldName.endsWith('_mhz')) return 'MHz';
    return '';
}

// Format compat key as readable label: strip unit suffixes, replace underscores, title-case
function _formatCompatLabel(key) {
    // Strip trailing unit suffixes for cleaner display
    let label = key.replace(/_(mm|in|v|a|mw|mah|deg|g|w|ms|mhz)$/i, '');
    return formatTitle(label);
}

function updateLanguage(lang) {
    currentLang = lang;
    const els = document.querySelectorAll('[data-i18n]');
    els.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const map = {
            appTitle: { en: 'Drone Models', fr: 'Modèles de Drones' },
            appSubtitle: { en: 'Builder & Visualizer', fr: 'Constructeur et Visualiseur' },
            navMasterAttr: { en: 'Master Attributes', fr: 'Attributs Principaux' },
            navLibraryEditor: { en: 'Parts Library Editor', fr: 'Éditeur de Bibliothèque' },
            navBuildWizard: { en: 'Build Wizard', fr: 'Assistant de Montage' },
            btnUploadJson: { en: 'Upload Custom JSON', fr: 'Importer JSON' },
            textLoading: { en: 'Loading Components...', fr: 'Chargement des composants...' },
            errLoadTitle: { en: 'Failed to load', fr: 'Échec du chargement' },
            errLoadDesc: { en: 'Please make sure the file is in the same directory.', fr: 'Assurez-vous que le fichier est dans le répertoire.' },
            btnAddBuild: { en: 'Add to Build', fr: 'Ajouter au Montage' },
            btnEditPart: { en: 'Edit Component', fr: 'Modifier la Pièce' }
        };
        if (map[key]?.[lang]) el.innerText = map[key][lang];
    });

    const btnEn = document.getElementById('btn-lang-en');
    const btnFr = document.getElementById('btn-lang-fr');
    if (btnEn && btnFr) {
        const isEn = lang === 'en';
        btnEn.style.background = isEn ? 'white' : 'transparent';
        btnEn.style.color = isEn ? 'var(--accent-red)' : 'var(--text-muted)';
        btnEn.style.boxShadow = isEn ? 'var(--card-shadow)' : 'none';
        btnFr.style.background = isEn ? 'transparent' : 'white';
        btnFr.style.color = isEn ? 'var(--text-muted)' : 'var(--accent-red)';
        btnFr.style.boxShadow = isEn ? 'none' : 'var(--card-shadow)';
    }

    updateBuildTotals();
}

function openModal(comp) {
    activeModalComponent = comp;

    elements.modalTitle.textContent = comp.name || 'Unnamed';
    elements.modalMfg.textContent = comp.manufacturer || 'Unknown';
    elements.modalPid.textContent = comp.pid || 'N/A';
    elements.modalDesc.textContent = comp.description || '';

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
    const ignoredKeys = ['tags', 'compatibility', 'weight_g', '_compat_hard', '_compat_soft'];

    const blueprint = schemaTemplate[currentCategory]?.[0];

    if (blueprint) {
        Object.keys(blueprint).forEach(key => {
            if (ignoredKeys.includes(key)) return;
            if (key.startsWith('_')) return; // Skip internal hint/options keys

            const val = sd.hasOwnProperty(key) ? sd[key] : null;

            // Skip null/undefined/empty values — don't clutter the modal
            if (val === null || val === undefined || val === '') return;
            if (Array.isArray(val) && val.length === 0) return;

            let displayVal = val;
            let valClass = '';
            if (typeof val === 'boolean') {
                displayVal = val ? (currentLang === 'fr' ? 'Oui' : 'Yes') : (currentLang === 'fr' ? 'Non' : 'No');
                valClass = val ? 'bool-true' : 'bool-false';
            } else if (Array.isArray(val) && val.length > 0 && typeof val[0] !== 'object') {
                displayVal = val.join(', ');
            } else if (typeof val === 'object' && !Array.isArray(val)) {
                // Nested objects (e.g., dimensions_mm) — flatten to readable string
                displayVal = Object.entries(val).filter(([,v]) => v !== null).map(([k,v]) => `${k}: ${v}`).join(', ');
                if (!displayVal) return;
            }
            specsHtml.push(`<div class="spec-item"><span class="spec-label">${formatTitle(key)}</span><span class="spec-value ${valClass}">${displayVal}</span></div>`);
        });
    } else {
        // Fallback if no blueprint loaded
        Object.keys(sd).forEach(key => {
            if (ignoredKeys.includes(key)) return;
            if (key.startsWith('_')) return;
            const val = sd[key];

            // Skip null/empty values
            if (val === null || val === undefined || val === '') return;
            if (Array.isArray(val) && val.length === 0) return;

            let displayVal = val;
            let valClass = '';
            if (typeof val === 'boolean') {
                displayVal = val ? (currentLang === 'fr' ? 'Oui' : 'Yes') : (currentLang === 'fr' ? 'Non' : 'No');
                valClass = val ? 'bool-true' : 'bool-false';
            } else if (Array.isArray(val) && typeof val[0] !== 'object') {
                displayVal = val.join(', ');
            } else if (typeof val === 'object' && !Array.isArray(val)) {
                displayVal = Object.entries(val).filter(([,v]) => v !== null).map(([k,v]) => `${k}: ${v}`).join(', ');
                if (!displayVal) return;
            } else if (typeof val === 'object') {
                return; // Skip complex objects
            }
            specsHtml.push(`<div class="spec-item"><span class="spec-label">${formatTitle(key)}</span><span class="spec-value ${valClass}">${displayVal}</span></div>`);
        });
    }

    elements.modalSpecs.innerHTML = specsHtml.join('');

    if (notesHtml.length > 0) {
        elements.modalNotes.innerHTML = notesHtml.join('');
        elements.modalNotesSection.classList.remove('hidden');
    } else {
        elements.modalNotesSection.classList.add('hidden');
    }

    // Compatibility section — filter out internal _compat arrays, format values with units
    const blueprintCompat = blueprint?.compatibility || {};
    const compCompat = comp.schema_data?.compatibility || {};
    const compatInternalKeys = ['_compat_hard', '_compat_soft'];
    const hasCompatBlueprint = Object.keys(blueprintCompat).filter(k => !compatInternalKeys.includes(k)).length > 0;
    const hasCompCompat = Object.keys(compCompat).filter(k => !compatInternalKeys.includes(k)).length > 0;

    if (hasCompatBlueprint) {
        elements.modalCompat.innerHTML = Object.keys(blueprintCompat)
            .filter(k => !compatInternalKeys.includes(k))
            .map(k => {
                const v = compCompat.hasOwnProperty(k) ? compCompat[k] : null;
                if (v === null || v === undefined || v === '') return '';
                if (Array.isArray(v) && v.length === 0) return '';

                let displayVal;
                const unit = _extractUnit(k);
                if (Array.isArray(v) && v.length > 0) {
                    displayVal = v.map(item => typeof item === 'number' ? item + unit : item).join(', ');
                } else if (typeof v === 'boolean') {
                    displayVal = v ? 'Yes' : 'No';
                } else if (typeof v === 'number') {
                    displayVal = v + unit;
                } else {
                    displayVal = v;
                }
                return `
                    <div class="spec-item" style="border-color: rgba(6, 182, 212, 0.3); background: rgba(6, 182, 212, 0.05);">
                        <span class="spec-label" style="color: var(--accent-cyan);">${_formatCompatLabel(k)}</span>
                        <span class="spec-value">${displayVal}</span>
                    </div>`;
            }).filter(h => h !== '').join('');
        elements.modalCompatSection.classList.remove('hidden');
    } else if (hasCompCompat) {
        // Fallback
        elements.modalCompat.innerHTML = Object.entries(compCompat)
            .filter(([k]) => !compatInternalKeys.includes(k))
            .map(([k, v]) => {
                if (v === null || v === undefined || v === '') return '';
                if (Array.isArray(v) && v.length === 0) return '';

                let displayVal;
                const unit = _extractUnit(k);
                if (Array.isArray(v)) displayVal = v.map(item => typeof item === 'number' ? item + unit : item).join(', ');
                else if (typeof v === 'boolean') displayVal = v ? 'Yes' : 'No';
                else if (typeof v === 'number') displayVal = v + unit;
                else displayVal = v;
                return `
                    <div class="spec-item" style="border-color: rgba(6, 182, 212, 0.3); background: rgba(6, 182, 212, 0.05);">
                        <span class="spec-label" style="color: var(--accent-cyan);">${_formatCompatLabel(k)}</span>
                        <span class="spec-value">${displayVal}</span>
                    </div>`;
            }).filter(h => h !== '').join('');
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

window.switchModalItem = function (pid) {
    if (!schemaData[currentCategory]) return;
    const item = schemaData[currentCategory].find(c => c.pid === pid);
    if (item) {
        elements.modal.classList.add('hidden');
        setTimeout(() => openModal(item), 50);
    }
};
