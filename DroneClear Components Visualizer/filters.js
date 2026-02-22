// =============================================================
// filters.js — Filter, sort, and view-toggle logic
// =============================================================

function applyFiltersAndSort(components, searchTerm) {
    let result = [...components];

    // 1. Text search
    if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        result = result.filter(comp => {
            const nameSearch = (comp.name || '').toLowerCase().includes(lowerTerm);
            const mfgSearch = (comp.manufacturer || '').toLowerCase().includes(lowerTerm);
            const descSearch = (comp.description || '').toLowerCase().includes(lowerTerm);
            const tagSearch = (comp.schema_data?.tags || []).some(tag => String(tag).toLowerCase().includes(lowerTerm));
            return nameSearch || mfgSearch || descSearch || tagSearch;
        });
    }

    // 2. Manufacturer filter
    if (currentManufacturer) {
        result = result.filter(comp => (comp.manufacturer || '') === currentManufacturer);
    }

    // 3. Weight range filter
    if (currentWeightMin !== null || currentWeightMax !== null) {
        result = result.filter(comp => {
            const w = parseFloat(comp.schema_data?.weight_g);
            if (isNaN(w)) return false;
            if (currentWeightMin !== null && w < currentWeightMin) return false;
            if (currentWeightMax !== null && w > currentWeightMax) return false;
            return true;
        });
    }

    // 4. Sort
    if (currentSort !== 'default') {
        result.sort((a, b) => {
            switch (currentSort) {
                case 'name-asc': return (a.name || '').localeCompare(b.name || '');
                case 'name-desc': return (b.name || '').localeCompare(a.name || '');
                case 'weight-asc': {
                    const wa = parseFloat(a.schema_data?.weight_g) || Infinity;
                    const wb = parseFloat(b.schema_data?.weight_g) || Infinity;
                    return wa - wb;
                }
                case 'weight-desc': {
                    const wa = parseFloat(a.schema_data?.weight_g) || -Infinity;
                    const wb = parseFloat(b.schema_data?.weight_g) || -Infinity;
                    return wb - wa;
                }
                case 'price-asc': {
                    const pa = parsePrice(a.approx_price) ?? Infinity;
                    const pb = parsePrice(b.approx_price) ?? Infinity;
                    return pa - pb;
                }
                case 'price-desc': {
                    const pa = parsePrice(a.approx_price) ?? -Infinity;
                    const pb = parsePrice(b.approx_price) ?? -Infinity;
                    return pb - pa;
                }
                default: return 0;
            }
        });
    }

    return result;
}

function populateFilterControls(components) {
    const mfgs = [...new Set(components.map(c => c.manufacturer).filter(Boolean))].sort();
    const mfgSelect = elements.manufacturerSelect;
    const prevMfg = mfgSelect.value;
    mfgSelect.innerHTML = '<option value="">All Manufacturers</option>';
    mfgs.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === prevMfg) opt.selected = true;
        mfgSelect.appendChild(opt);
    });

    const hasWeight = components.some(c => c.schema_data?.weight_g !== undefined && c.schema_data?.weight_g !== null);
    elements.weightFilterGroup.classList.toggle('hidden', !hasWeight);
    elements.filterToolbar.classList.remove('hidden');
}

function updateFilterChips() {
    if (!elements.filterChips) return;
    const chips = [];

    if (currentSort !== 'default') {
        const labels = {
            'name-asc': 'Name A→Z', 'name-desc': 'Name Z→A',
            'weight-asc': 'Weight ↑', 'weight-desc': 'Weight ↓',
            'price-asc': 'Price ↑', 'price-desc': 'Price ↓'
        };
        chips.push({ label: `Sort: ${labels[currentSort]}`, action: () => { currentSort = 'default'; elements.sortSelect.value = 'default'; triggerRerender(); } });
    }
    if (currentManufacturer) {
        chips.push({ label: `Brand: ${currentManufacturer}`, action: () => { currentManufacturer = ''; elements.manufacturerSelect.value = ''; triggerRerender(); } });
    }
    if (currentWeightMin !== null) {
        chips.push({ label: `Min ${currentWeightMin}g`, action: () => { currentWeightMin = null; elements.weightMin.value = ''; triggerRerender(); } });
    }
    if (currentWeightMax !== null) {
        chips.push({ label: `Max ${currentWeightMax}g`, action: () => { currentWeightMax = null; elements.weightMax.value = ''; triggerRerender(); } });
    }

    const hasActiveFilters = chips.length > 0;

    elements.filterChips.innerHTML = chips.map((chip, i) =>
        `<span class="filter-chip" data-chip-index="${i}"><span class="chip-label">${chip.label}</span><button class="chip-remove" title="Remove filter"><i class="ph ph-x"></i></button></span>`
    ).join('');

    elements.filterChips.querySelectorAll('.filter-chip').forEach((el, i) => {
        el.querySelector('.chip-remove').addEventListener('click', chips[i].action);
    });

    elements.filterClearBtn?.classList.toggle('hidden', !hasActiveFilters);
}

function resetFilters() {
    currentSort = 'default';
    currentManufacturer = '';
    currentWeightMin = null;
    currentWeightMax = null;

    if (elements.sortSelect) elements.sortSelect.value = 'default';
    if (elements.manufacturerSelect) elements.manufacturerSelect.value = '';
    if (elements.weightMin) elements.weightMin.value = '';
    if (elements.weightMax) elements.weightMax.value = '';

    updateFilterChips();
}

function triggerRerender() {
    const searchTerm = elements.searchInput?.value.trim() || '';
    renderComponents(searchTerm);
}

function setupFilterListeners() {
    elements.sortSelect?.addEventListener('change', (e) => { currentSort = e.target.value; triggerRerender(); });
    elements.manufacturerSelect?.addEventListener('change', (e) => { currentManufacturer = e.target.value; triggerRerender(); });

    // =========================================================================
    // COLLABORATION NOTE (For other agent):
    // Added cross-validation logic to the weight filters. If the user types a Min 
    // that is greater than the current Max, we auto-correct it down to the Max 
    // (and vice-versa). We also trigger visual error cues using the existing CSS.
    // =========================================================================

    elements.weightMin?.addEventListener('input', () => {
        clearTimeout(weightDebounceTimer);
        weightDebounceTimer = setTimeout(() => {
            let val = parseFloat(elements.weightMin.value);

            // Bounds check: Min cannot be strictly greater than Max
            if (!isNaN(val) && currentWeightMax !== null && val > currentWeightMax) {
                val = currentWeightMax;
                elements.weightMin.value = val;

                // Visual feedback
                elements.weightMin.classList.add('input-error');
                setTimeout(() => elements.weightMin.classList.remove('input-error'), 800);
            }

            currentWeightMin = isNaN(val) ? null : val;
            triggerRerender();
        }, 350);
    });

    elements.weightMax?.addEventListener('input', () => {
        clearTimeout(weightDebounceTimer);
        weightDebounceTimer = setTimeout(() => {
            let val = parseFloat(elements.weightMax.value);

            // Bounds check: Max cannot be strictly less than Min
            if (!isNaN(val) && currentWeightMin !== null && val < currentWeightMin) {
                val = currentWeightMin;
                elements.weightMax.value = val;

                // Visual feedback
                elements.weightMax.classList.add('input-error');
                setTimeout(() => elements.weightMax.classList.remove('input-error'), 800);
            }

            currentWeightMax = isNaN(val) ? null : val;
            triggerRerender();
        }, 350);
    });

    elements.filterClearBtn?.addEventListener('click', () => { resetFilters(); triggerRerender(); });
    elements.btnViewGrid?.addEventListener('click', () => setView('grid'));
    elements.btnViewList?.addEventListener('click', () => setView('list'));
}

function setView(view) {
    currentView = view;
    const grid = elements.componentsGrid;
    if (view === 'list') {
        grid.classList.add('list-view');
        elements.btnViewList?.classList.add('active');
        elements.btnViewGrid?.classList.remove('active');
    } else {
        grid.classList.remove('list-view');
        elements.btnViewGrid?.classList.add('active');
        elements.btnViewList?.classList.remove('active');
    }
}
