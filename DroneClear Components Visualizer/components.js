// =============================================================
// components.js — Data loading, sidebar, grid rendering
// =============================================================

async function fetchAllCategories() {
    showLoader();
    try {
        const response = await fetch('/api/categories/');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const categories = await response.json();

        if (categories.length === 0) {
            showError('No component categories found in the database.');
            return;
        }

        renderSidebar(categories);
        selectCategory(categories[0].slug);
    } catch (error) {
        console.warn('Failed to fetch from Django API.', error);
        showError(i18n[currentLang].errLoadDesc);
    } finally {
        hideLoader();
    }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    showLoader();
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            processData(JSON.parse(e.target.result));
        } catch {
            showError('Invalid JSON file format.');
        }
    };
    reader.readAsText(file);
}

function processData(data) {
    schemaData = data;
    const categories = Object.keys(schemaData).map(cat => ({
        slug: cat,
        name: formatTitle(cat),
        component_count: Array.isArray(schemaData[cat]) ? schemaData[cat].length : 0
    }));

    if (categories.length === 0) {
        showError('No categories found in the uploaded JSON file.');
        return;
    }

    renderSidebar(categories);
    selectCategory(categories[0].slug);
}

function renderSidebar(categories) {
    elements.categoryNav.innerHTML = '';
    let totalParts = 0;

    categories.forEach(categoryObj => {
        const category = categoryObj.slug || categoryObj;
        const itemCount = categoryObj.count !== undefined ? categoryObj.count : (schemaData[category]?.length || 0);
        totalParts += itemCount;

        const navItem = document.createElement('a');
        navItem.className = 'nav-item';
        navItem.dataset.category = category;

        const formattedName = categoryObj.name || formatTitle(category);
        navItem.innerHTML = `<span>${formattedName}</span><span class="nav-count">${itemCount}</span>`;
        navItem.addEventListener('click', (e) => { e.preventDefault(); selectCategory(category); });
        elements.categoryNav.appendChild(navItem);
    });

    const partsCountEl = document.getElementById('total-parts-count');
    if (partsCountEl) {
        partsCountEl.textContent = `${totalParts} ${currentLang === 'fr' ? 'Pièces' : 'Parts'}`;
    }
}

async function selectCategory(category, _fromWizard = false) {
    // Block manual nav during wizard — only wizard-initiated calls pass _fromWizard=true
    if (wizardActive && !_fromWizard) {
        showToast('Complete the current wizard step first, or exit the wizard.', 'warning');
        return;
    }

    currentCategory = category;

    elements.categoryNav.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.category === category);
    });

    elements.currentCategoryTitle.textContent = formatTitle(category);
    elements.searchInput.value = '';
    resetFilters();

    await renderComponents();
}

async function renderComponents(searchTerm = '') {
    hideError();

    if (!schemaData[currentCategory]) {
        showLoader();
        elements.componentsGrid.classList.add('hidden');
        try {
            const response = await fetch(`/api/components/?category=${currentCategory}`);
            if (!response.ok) throw new Error('Failed to fetch components');
            schemaData[currentCategory] = await response.json();
        } catch (error) {
            console.error(error);
            showError('Could not load components for this category.');
            return;
        }
    }

    hideLoader();
    elements.componentsGrid.classList.remove('hidden');
    elements.componentsGrid.innerHTML = '';

    let components = schemaData[currentCategory] || [];

    // --- Wizard: Frame class filtering (Step 0 selection) ---
    if (wizardActive && wizardDroneClass && currentCategory === 'frames') {
        components = components.filter(comp => frameMatchesClass(comp, wizardDroneClass));
    }

    populateFilterControls(components);
    const filteredComponents = applyFiltersAndSort(components, searchTerm);
    updateFilterChips();

    if (filteredComponents.length === 0) {
        const hasActiveFilters = currentSort !== 'default' || currentManufacturer || currentWeightMin !== null || currentWeightMax !== null || searchTerm;
        const msg = hasActiveFilters
            ? 'No components match your current filters. Try adjusting or clearing them.'
            : 'No components found in this category.';
        elements.componentsGrid.innerHTML = `<div class="empty-filter-state"><i class="ph ph-funnel-x"></i><p>${msg}</p></div>`;
        return;
    }

    // --- Wizard: Compatibility-sorted rendering ---
    const activeWizardCategory = wizardActive && wizardCurrentStep < wizardSequence.length ? wizardSequence[wizardCurrentStep].cat : null;
    const isWizardStep = wizardActive && currentBuild && currentCategory === activeWizardCategory;

    if (isWizardStep) {
        // Partition components into 3 compatibility groups
        const compatGroup = [];
        const cautionGroup = [];
        const incompatGroup = [];

        filteredComponents.forEach(comp => {
            const simulatedBuild = { ...currentBuild, [currentCategory]: comp };
            const warnings = getBuildWarnings(simulatedBuild);
            const hasErrors = warnings.some(w => w.type === 'error');

            if (warnings.length === 0) {
                compatGroup.push({ comp, warnings, warningCount: 0 });
            } else if (!hasErrors) {
                cautionGroup.push({ comp, warnings, warningCount: warnings.length });
            } else {
                incompatGroup.push({ comp, warnings, warningCount: warnings.length });
            }
        });

        // Sort within groups
        const weightSort = (a, b) => {
            const wA = parseFloat(a.comp.schema_data?.weight_g) || 9999;
            const wB = parseFloat(b.comp.schema_data?.weight_g) || 9999;
            return wA - wB;
        };
        compatGroup.sort(weightSort);
        cautionGroup.sort((a, b) => a.warningCount - b.warningCount || weightSort(a, b));
        incompatGroup.sort((a, b) => (a.comp.name || '').localeCompare(b.comp.name || ''));

        let cardIndex = 0;

        // Helper: render a group of cards
        const renderGroup = (group, cssClass) => {
            group.forEach(({ comp, warnings }) => {
                const highlightData = { active: true, matchPids: new Set(), warningPids: new Set() };
                if (cssClass === 'compat-green') highlightData.matchPids.add(comp.pid);
                else if (cssClass === 'compat-orange') highlightData.warningPids.add(comp.pid);

                const card = createComponentCard(comp, highlightData);
                card.classList.add(`card--${cssClass}`);

                // Attach warning summary tooltip for caution cards
                if (cssClass === 'compat-orange' && warnings.length > 0) {
                    const warningSummary = warnings.map(w => w.title).join(' · ');
                    card.title = `Warnings: ${warningSummary}`;
                }

                card.style.opacity = '0';
                card.style.transform = 'translateY(10px)';
                card.style.transitionDelay = `${Math.min(cardIndex * 0.03, 0.4)}s`;
                elements.componentsGrid.appendChild(card);
                requestAnimationFrame(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                });
                cardIndex++;
            });
        };

        // 1. Render compatible group (green) — best matches first
        if (compatGroup.length > 0) {
            const header = document.createElement('div');
            header.className = 'wizard-section-divider wizard-section-divider--green';
            header.innerHTML = `<i class="ph-fill ph-check-circle"></i> <span>${compatGroup.length} Compatible Part${compatGroup.length !== 1 ? 's' : ''}</span>`;
            elements.componentsGrid.appendChild(header);
            renderGroup(compatGroup, 'compat-green');
        }

        // 2. Render caution group (orange) — warnings but no errors
        if (cautionGroup.length > 0) {
            const header = document.createElement('div');
            header.className = 'wizard-section-divider wizard-section-divider--orange';
            header.innerHTML = `<i class="ph-fill ph-warning"></i> <span>${cautionGroup.length} Part${cautionGroup.length !== 1 ? 's' : ''} with Warnings</span>`;
            elements.componentsGrid.appendChild(header);
            renderGroup(cautionGroup, 'compat-orange');
        }

        // 3. Render incompatible group — collapsed by default
        if (incompatGroup.length > 0) {
            const toggle = document.createElement('div');
            toggle.className = 'wizard-hidden-toggle';
            toggle.innerHTML = `
                <button class="wizard-hidden-toggle-btn">
                    <i class="ph ph-eye-slash"></i>
                    <span>${incompatGroup.length} incompatible part${incompatGroup.length !== 1 ? 's' : ''} hidden</span>
                    <i class="ph ph-caret-down wizard-hidden-chevron"></i>
                </button>
            `;
            elements.componentsGrid.appendChild(toggle);

            const hiddenContainer = document.createElement('div');
            hiddenContainer.className = 'wizard-hidden-container collapsed';
            hiddenContainer.style.display = 'none';
            elements.componentsGrid.appendChild(hiddenContainer);

            // Toggle expand/collapse
            toggle.querySelector('.wizard-hidden-toggle-btn').addEventListener('click', () => {
                const isCollapsed = hiddenContainer.style.display === 'none';
                hiddenContainer.style.display = isCollapsed ? 'contents' : 'none';
                toggle.querySelector('.wizard-hidden-chevron').classList.toggle('rotated', isCollapsed);
                toggle.querySelector('span').textContent = isCollapsed
                    ? `${incompatGroup.length} incompatible part${incompatGroup.length !== 1 ? 's' : ''} shown`
                    : `${incompatGroup.length} incompatible part${incompatGroup.length !== 1 ? 's' : ''} hidden`;
                toggle.querySelector('.ph-eye-slash')?.classList.replace('ph-eye-slash', 'ph-eye');
                if (!isCollapsed) {
                    toggle.querySelector('.ph-eye')?.classList.replace('ph-eye', 'ph-eye-slash');
                }
            });

            // Pre-render hidden cards into container (they stay hidden until toggled)
            incompatGroup.forEach(({ comp, warnings }) => {
                const highlightData = { active: true, matchPids: new Set(), warningPids: new Set() };
                const card = createComponentCard(comp, highlightData);
                card.classList.add('card--compat-hidden');
                if (warnings.length > 0) {
                    card.title = `Errors: ${warnings.filter(w => w.type === 'error').map(w => w.title).join(' · ')}`;
                }
                hiddenContainer.appendChild(card);
            });
        }

        // Show a count summary if all groups are empty (shouldn't happen, but safeguard)
        if (compatGroup.length === 0 && cautionGroup.length === 0 && incompatGroup.length === 0) {
            elements.componentsGrid.innerHTML = `<div class="empty-filter-state"><i class="ph ph-funnel-x"></i><p>No components found for this step.</p></div>`;
        }

    } else {
        // Non-wizard rendering (normal mode)
        let highlightData = { active: false, matchPids: new Set(), warningPids: new Set() };

        filteredComponents.forEach((comp, index) => {
            const card = createComponentCard(comp, highlightData);
            card.style.opacity = '0';
            card.style.transform = 'translateY(10px)';
            card.style.transitionDelay = `${Math.min(index * 0.05, 0.5)}s`;
            elements.componentsGrid.appendChild(card);
            requestAnimationFrame(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            });
        });
    }
}

function createComponentCard(comp, highlightData = null) {
    const card = document.createElement('div');
    card.className = 'card';

    const tagsArray = comp.schema_data?.tags || [];
    const weightG = comp.schema_data?.weight_g;
    const tagsHtml = tagsArray.slice(0, 4).map(t => `<span class="tag">${t}</span>`).join('');

    const tooltipCompat = i18n[currentLang].lblCompatible;
    const tooltipIncompat = i18n[currentLang].lblIncompatible;

    // "In Build" state — highlight card if this component is already selected for the current slot
    const isInBuild = currentBuild[currentCategory]?.pid === comp.pid;
    if (isInBuild) {
        card.classList.add('card--in-build');
    }

    if (highlightData?.active) {
        if (highlightData.matchPids.has(comp.pid)) {
            if (!isInBuild) {
                card.style.borderColor = 'var(--accent-green)';
                card.style.boxShadow = '0 0 15px rgba(34, 197, 94, 0.2)';
            }
            card.title = tooltipCompat;
        } else if (highlightData.warningPids.has(comp.pid)) {
            if (!isInBuild) card.style.borderColor = 'var(--accent-yellow)';
            card.title = tooltipCompat + ' (Warnings)';
        } else if (!isInBuild) {
            card.style.opacity = '0.5';
            card.title = tooltipIncompat;
        }
    }

    let compatHtml = '';
    const compatData = comp.schema_data?.compatibility || {};
    // Filter out internal _compat arrays and empty values for badge display
    const compatKeys = Object.keys(compatData).filter(k => !k.startsWith('_'));
    if (compatKeys.length > 0) {
        const badges = compatKeys.slice(0, 3).map(k => {
            let val = compatData[k];
            if (val === null || val === undefined || val === '') return '';
            const unit = _extractUnit(k);
            const label = _formatCompatLabel(k);
            if (Array.isArray(val)) {
                if (val.length === 0) return '';
                const first = typeof val[0] === 'number' ? val[0] + unit : val[0];
                val = first + (val.length > 1 ? '+' : '');
            } else if (typeof val === 'boolean') {
                val = val ? 'Yes' : 'No';
            } else if (typeof val === 'number') {
                val = val + unit;
            }
            return `<span class="compat-badge" title="${label}"><i class="ph ph-wrench"></i> ${val}</span>`;
        }).filter(b => b !== '').join('');
        compatHtml = `<div class="card-compat-badges">${badges}</div>`;
    }

    const priceHtml = comp.approx_price ? `<span class="card-price">${comp.approx_price}</span>` : '';
    const inBuildBadge = isInBuild ? `<span class="card-in-build-badge" style="font-size:12px; color:#10b981; font-weight:600;"><i class="ph-fill ph-check-circle"></i> In Build</span>` : '';

    // =========================================================================
    // COLLABORATION NOTE (For other agent):
    // Tier 3 Builder Skip Flow: Injected an inline "Quick Add" button onto the card.
    // We detect if we're in Builder mode simply by checking if the global `addToBuild` 
    // function is available (it's only loaded in `build.js` on the index page).
    // =========================================================================
    let quickAddHtml = '';
    if (!isInBuild && typeof addToBuild === 'function') {
        quickAddHtml = `<button class="btn-quick-add" title="Quick Add to Build"><i class="ph ph-plus-circle"></i></button>`;
    }

    const thumbHtml = comp.image_file
        ? `<div class="card-thumb"><img src="${comp.image_file}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'"></div>`
        : '';

    card.innerHTML = `
        ${thumbHtml}
        <div class="card-header">
            <span class="card-pid">${comp.pid || 'N/A'}</span>
            <div style="display:flex; align-items:center; gap:8px;">
                ${weightG ? `<span class="tag weight-tag">${weightG}g</span>` : ''}
                ${priceHtml}
                ${inBuildBadge}
                ${quickAddHtml}
            </div>
        </div>
        <div class="list-name-col">
            <div class="card-mfg">${comp.manufacturer || 'Unknown'}</div>
            <h3 class="card-title">${comp.name || 'Unnamed Component'}</h3>
        </div>
        ${compatHtml}
        <p class="card-desc">${comp.description || ''}</p>
        <div class="card-tags">${tagsHtml}</div>
    `;

    card.addEventListener('click', () => openModal(comp));

    // Hook up Quick Add button if it exists
    const quickAddEl = card.querySelector('.btn-quick-add');
    if (quickAddEl) {
        quickAddEl.addEventListener('click', (e) => {
            e.stopPropagation(); // crucial: don't open the detail modal!

            const existingComp = currentBuild[currentCategory];
            if (existingComp && existingComp.pid !== comp.pid) {
                // Inline card replacement confirmation
                const originalHtml = quickAddEl.innerHTML;
                quickAddEl.style.width = 'auto';
                quickAddEl.style.borderRadius = '16px';
                quickAddEl.style.padding = '0 10px';
                quickAddEl.style.background = 'var(--bg-panel)';
                quickAddEl.innerHTML = `
                    <span style="font-size:11px; margin-right:6px; font-weight:600;">Replace?</span>
                    <i class="ph-fill ph-check-circle" id="quick-yes" style="color:#10b981; margin-right:4px;"></i>
                    <i class="ph-fill ph-x-circle" id="quick-no" style="color:#ef4444;"></i>
                `;

                const cancelBtn = quickAddEl.querySelector('#quick-no');
                const confirmBtn = quickAddEl.querySelector('#quick-yes');

                cancelBtn.onclick = (ev) => {
                    ev.stopPropagation();
                    quickAddEl.style.width = '28px';
                    quickAddEl.style.borderRadius = '50%';
                    quickAddEl.style.padding = '0';
                    quickAddEl.style.background = 'transparent';
                    quickAddEl.innerHTML = originalHtml;
                };

                confirmBtn.onclick = (ev) => {
                    ev.stopPropagation();
                    addToBuild(comp);
                    if (wizardActive) {
                        wizardNextStep();
                    } else {
                        triggerRerender();
                    }
                };
            } else {
                addToBuild(comp);
                if (wizardActive) {
                    wizardNextStep();
                } else {
                    triggerRerender();
                }
            }
        });
    }

    return card;
}

function handleSearch(e) {
    const term = e.target.value.trim();
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        if (currentCategory) renderComponents(term);
    }, 250);
}

function findSimilarComponents(targetComp) {
    if (!currentCategory || !schemaData[currentCategory]) return [];
    const allComps = schemaData[currentCategory];
    const scoredComps = [];

    allComps.forEach(comp => {
        if (comp.pid === targetComp.pid) return;
        let score = 0;

        if (comp.manufacturer && targetComp.manufacturer &&
            comp.manufacturer.toLowerCase() === targetComp.manufacturer.toLowerCase()) score += 3;

        const tTags = targetComp.schema_data?.tags || [];
        const cTags = comp.schema_data?.tags || [];
        score += tTags.filter(t => cTags.includes(t)).length * 2;

        const tWeight = parseFloat(targetComp.schema_data?.weight_g);
        const cWeight = parseFloat(comp.schema_data?.weight_g);
        if (tWeight && cWeight) {
            const diff = Math.abs(tWeight - cWeight);
            if (diff <= tWeight * 0.10) score += 4;
            else if (diff <= tWeight * 0.25) score += 2;
        }

        const tCompat = targetComp.schema_data?.compatibility || {};
        const cCompat = comp.schema_data?.compatibility || {};
        Object.keys(tCompat).forEach(k => {
            if (cCompat[k] !== undefined && JSON.stringify(tCompat[k]) === JSON.stringify(cCompat[k])) score += 5;
        });

        if (score > 0) scoredComps.push({ comp, score });
    });

    scoredComps.sort((a, b) => b.score - a.score);
    return scoredComps.slice(0, 3).map(obj => obj.comp);
}
