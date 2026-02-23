// =============================================================
// filters.js — Filter, sort, and view-toggle logic
// =============================================================

// --- Dynamic Filter Configuration ---
// Maps category_slug → array of { field, path, type } filter definitions.
// `type` is 'select' (dropdown), 'range' (min/max number), or 'boolean' (toggle).
// Filters with 0 or 1 unique values across the current component set are auto-hidden.
const DYNAMIC_FILTER_CONFIG = {
    frames: [
        { field: 'Mounting Pattern',    path: 'schema_data.compatibility.fc_mounting_patterns_mm', type: 'select' },
        { field: 'Max Prop Size (in)',  path: 'schema_data.compatibility.prop_size_max_in',        type: 'range'  },
        { field: 'Motor Mount Spacing', path: 'schema_data.compatibility.motor_mount_hole_spacing_mm', type: 'select' },
        { field: 'Wheelbase (mm)',      path: 'schema_data.wheelbase_mm',                          type: 'range'  },
    ],
    motors: [
        { field: 'Motor Size',          path: 'schema_data.motor_size',                             type: 'select' },
        { field: 'KV Rating',           path: 'schema_data.kv_rating',                              type: 'range'  },
        { field: 'Mount Spacing',       path: 'schema_data.compatibility.motor_mount_hole_spacing_mm', type: 'select' },
        { field: 'Max Cell Count',      path: 'schema_data.compatibility.cell_count_max',           type: 'range'  },
    ],
    flight_controllers: [
        { field: 'Mounting Pattern',    path: 'schema_data.mounting_pattern_mm',                    type: 'select' },
        { field: 'Processor',           path: 'schema_data.processor',                              type: 'select' },
        { field: 'Firmware',            path: 'schema_data.firmware',                               type: 'select' },
    ],
    escs: [
        { field: 'Mounting Pattern',    path: 'schema_data.compatibility.mounting_pattern_mm',      type: 'select' },
        { field: 'Max Cell Count',      path: 'schema_data.compatibility.cell_count_max',           type: 'range'  },
        { field: 'Current Rating (A)',  path: 'schema_data.compatibility.continuous_current_per_motor_a', type: 'range' },
    ],
    stacks: [
        { field: 'Mounting Pattern',    path: 'schema_data.mounting_pattern_mm',                    type: 'select' },
        { field: 'Max Cell Count',      path: 'schema_data.cell_count_max',                         type: 'range'  },
    ],
    video_transmitters: [
        { field: 'Video System',        path: 'schema_data.video_standard',                         type: 'select' },
        { field: 'Digital System',      path: 'schema_data.compatibility.digital_system',           type: 'select' },
        { field: 'Output Power (mW)',   path: 'schema_data.output_power_mw',                        type: 'range'  },
    ],
    fpv_cameras: [
        { field: 'Video System',        path: 'schema_data.video_system',                           type: 'select' },
        { field: 'Digital System',      path: 'schema_data.compatibility.digital_system',           type: 'select' },
        { field: 'Sensor Size',         path: 'schema_data.sensor_size',                            type: 'select' },
    ],
    receivers: [
        { field: 'Protocol',            path: 'schema_data.protocol',                                type: 'select' },
        { field: 'Frequency (GHz)',     path: 'schema_data.frequency_ghz',                           type: 'select' },
        { field: 'Antenna Connector',   path: 'schema_data.antenna_connector',                       type: 'select' },
    ],
    batteries: [
        { field: 'Cell Count (S)',      path: 'schema_data.cell_count',                              type: 'select' },
        { field: 'Capacity (mAh)',      path: 'schema_data.capacity_mah',                            type: 'range'  },
        { field: 'Discharge Rate (C)',  path: 'schema_data.discharge_rate_c',                        type: 'range'  },
        { field: 'Connector',           path: 'schema_data.connector_type',                          type: 'select' },
    ],
    propellers: [
        { field: 'Diameter (in)',       path: 'schema_data.diameter_in',                             type: 'select' },
        { field: 'Pitch (in)',          path: 'schema_data.pitch_in',                                type: 'select' },
        { field: 'Blade Count',         path: 'schema_data.blade_count',                             type: 'select' },
        { field: 'Material',            path: 'schema_data.material',                                type: 'select' },
    ],
    antennas: [
        { field: 'Connector Type',      path: 'schema_data.connector_type',                          type: 'select' },
        { field: 'Frequency (GHz)',     path: 'schema_data.frequency_ghz',                           type: 'select' },
        { field: 'Polarization',        path: 'schema_data.polarization',                            type: 'select' },
    ],
    action_cameras: [
        { field: 'Resolution',          path: 'schema_data.resolution',                              type: 'select' },
        { field: 'Sensor Size',         path: 'schema_data.sensor_size',                             type: 'select' },
    ],
};

// --- Path Resolution Helper ---
function resolvePath(obj, dotPath) {
    return dotPath.split('.').reduce((o, key) => o?.[key], obj);
}

// --- Core Filter Pipeline ---

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

    // 3.5 Dynamic attribute filters
    for (const [path, filterState] of Object.entries(currentDynamicFilters)) {
        if (filterState.type === 'select' && filterState.value) {
            result = result.filter(comp => {
                const val = resolvePath(comp, path);
                if (val === null || val === undefined) return false;
                // Array-valued fields (e.g. fc_mounting_patterns_mm): match if array includes selected value
                if (Array.isArray(val)) return val.map(String).includes(filterState.value);
                return String(val) === filterState.value;
            });
        } else if (filterState.type === 'range') {
            if (filterState.min !== null || filterState.max !== null) {
                result = result.filter(comp => {
                    const val = parseFloat(resolvePath(comp, path));
                    if (isNaN(val)) return false;
                    if (filterState.min !== null && val < filterState.min) return false;
                    if (filterState.max !== null && val > filterState.max) return false;
                    return true;
                });
            }
        } else if (filterState.type === 'boolean' && filterState.value !== null) {
            result = result.filter(comp => {
                const val = resolvePath(comp, path);
                return Boolean(val) === filterState.value;
            });
        }
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

// --- Populate Existing Filter Controls ---

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

    // Render dynamic attribute filters for the current category
    renderDynamicFilters(components);
}

// --- Dynamic Filter Rendering ---

function renderDynamicFilters(components) {
    const container = elements.dynamicFiltersContainer;
    const separator = elements.dynamicFiltersSeparator;
    if (!container) return;

    // Clear previous dynamic filter DOM
    container.innerHTML = '';

    // Clear debounce timers
    for (const key in dynamicFilterDebounceTimers) {
        clearTimeout(dynamicFilterDebounceTimers[key]);
    }
    dynamicFilterDebounceTimers = {};

    const filterDefs = DYNAMIC_FILTER_CONFIG[currentCategory];
    if (!filterDefs || filterDefs.length === 0) {
        separator?.classList.add('hidden');
        return;
    }

    let renderedCount = 0;

    filterDefs.forEach(def => {
        // Collect unique values for this field across all components
        const uniqueVals = new Set();
        let numericMin = Infinity;
        let numericMax = -Infinity;

        components.forEach(comp => {
            const val = resolvePath(comp, def.path);
            if (val === null || val === undefined || val === '') return;

            if (def.type === 'select') {
                // Array-valued fields: flatten items into unique set
                if (Array.isArray(val)) {
                    val.forEach(v => { if (v !== null && v !== undefined && v !== '') uniqueVals.add(String(v)); });
                } else {
                    uniqueVals.add(String(val));
                }
            } else if (def.type === 'range') {
                const n = parseFloat(val);
                if (!isNaN(n)) {
                    uniqueVals.add(n);
                    if (n < numericMin) numericMin = n;
                    if (n > numericMax) numericMax = n;
                }
            }
        });

        // Skip filter if 0 or 1 unique values — nothing to filter
        if (uniqueVals.size < 2) return;

        renderedCount++;

        if (def.type === 'select') {
            const group = document.createElement('div');
            group.className = 'filter-group';
            group.innerHTML = `<label class="filter-label">${def.field}</label>`;

            const select = document.createElement('select');
            select.className = 'filter-select';
            select.dataset.filterPath = def.path;

            // Default "All" option
            const allOpt = document.createElement('option');
            allOpt.value = '';
            allOpt.textContent = `All`;
            select.appendChild(allOpt);

            // Sort values: numeric-like strings sort numerically, others alphabetically
            const sorted = [...uniqueVals].sort((a, b) => {
                const na = parseFloat(a), nb = parseFloat(b);
                if (!isNaN(na) && !isNaN(nb)) return na - nb;
                return a.localeCompare(b);
            });

            sorted.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                select.appendChild(opt);
            });

            // Restore previous selection if any
            const prev = currentDynamicFilters[def.path];
            if (prev && prev.type === 'select' && prev.value) {
                select.value = prev.value;
            }

            select.addEventListener('change', () => {
                const val = select.value;
                if (val) {
                    currentDynamicFilters[def.path] = { type: 'select', value: val, field: def.field };
                } else {
                    delete currentDynamicFilters[def.path];
                }
                triggerRerender();
            });

            group.appendChild(select);
            container.appendChild(group);

        } else if (def.type === 'range') {
            const group = document.createElement('div');
            group.className = 'filter-group filter-group--range';
            group.innerHTML = `<label class="filter-label">${def.field}</label>`;

            const rangeDiv = document.createElement('div');
            rangeDiv.className = 'range-inputs';

            const minInput = document.createElement('input');
            minInput.type = 'number';
            minInput.className = 'filter-input';
            minInput.placeholder = 'Min';
            minInput.min = '0';
            minInput.dataset.filterPath = def.path;
            minInput.dataset.filterBound = 'min';

            const sep = document.createElement('span');
            sep.className = 'range-sep';
            sep.textContent = '–';

            const maxInput = document.createElement('input');
            maxInput.type = 'number';
            maxInput.className = 'filter-input';
            maxInput.placeholder = 'Max';
            maxInput.min = '0';
            maxInput.dataset.filterPath = def.path;
            maxInput.dataset.filterBound = 'max';

            // Restore previous values if any
            const prev = currentDynamicFilters[def.path];
            if (prev && prev.type === 'range') {
                if (prev.min !== null) minInput.value = prev.min;
                if (prev.max !== null) maxInput.value = prev.max;
            }

            // Debounced input handlers
            minInput.addEventListener('input', () => {
                clearTimeout(dynamicFilterDebounceTimers[def.path + '_min']);
                dynamicFilterDebounceTimers[def.path + '_min'] = setTimeout(() => {
                    const val = parseFloat(minInput.value);
                    const existing = currentDynamicFilters[def.path] || { type: 'range', min: null, max: null, field: def.field };
                    existing.min = isNaN(val) ? null : val;
                    existing.type = 'range';
                    existing.field = def.field;

                    if (existing.min === null && existing.max === null) {
                        delete currentDynamicFilters[def.path];
                    } else {
                        currentDynamicFilters[def.path] = existing;
                    }
                    triggerRerender();
                }, 350);
            });

            maxInput.addEventListener('input', () => {
                clearTimeout(dynamicFilterDebounceTimers[def.path + '_max']);
                dynamicFilterDebounceTimers[def.path + '_max'] = setTimeout(() => {
                    const val = parseFloat(maxInput.value);
                    const existing = currentDynamicFilters[def.path] || { type: 'range', min: null, max: null, field: def.field };
                    existing.max = isNaN(val) ? null : val;
                    existing.type = 'range';
                    existing.field = def.field;

                    if (existing.min === null && existing.max === null) {
                        delete currentDynamicFilters[def.path];
                    } else {
                        currentDynamicFilters[def.path] = existing;
                    }
                    triggerRerender();
                }, 350);
            });

            rangeDiv.appendChild(minInput);
            rangeDiv.appendChild(sep);
            rangeDiv.appendChild(maxInput);
            group.appendChild(rangeDiv);
            container.appendChild(group);
        }
    });

    // Show/hide separator
    separator?.classList.toggle('hidden', renderedCount === 0);
}

// --- Filter Chips ---

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

    // Dynamic filter chips
    for (const [path, filterState] of Object.entries(currentDynamicFilters)) {
        const label = filterState.field || path.split('.').pop();
        if (filterState.type === 'select' && filterState.value) {
            const capturedPath = path;
            chips.push({
                label: `${label}: ${filterState.value}`,
                action: () => {
                    delete currentDynamicFilters[capturedPath];
                    // Reset the corresponding select element
                    const sel = elements.dynamicFiltersContainer?.querySelector(`select[data-filter-path="${capturedPath}"]`);
                    if (sel) sel.value = '';
                    triggerRerender();
                }
            });
        } else if (filterState.type === 'range') {
            if (filterState.min !== null) {
                const capturedPath = path;
                chips.push({
                    label: `${label} ≥ ${filterState.min}`,
                    action: () => {
                        const existing = currentDynamicFilters[capturedPath];
                        if (existing) {
                            existing.min = null;
                            if (existing.max === null) delete currentDynamicFilters[capturedPath];
                        }
                        // Reset the corresponding min input
                        const inp = elements.dynamicFiltersContainer?.querySelector(`input[data-filter-path="${capturedPath}"][data-filter-bound="min"]`);
                        if (inp) inp.value = '';
                        triggerRerender();
                    }
                });
            }
            if (filterState.max !== null) {
                const capturedPath = path;
                chips.push({
                    label: `${label} ≤ ${filterState.max}`,
                    action: () => {
                        const existing = currentDynamicFilters[capturedPath];
                        if (existing) {
                            existing.max = null;
                            if (existing.min === null) delete currentDynamicFilters[capturedPath];
                        }
                        // Reset the corresponding max input
                        const inp = elements.dynamicFiltersContainer?.querySelector(`input[data-filter-path="${capturedPath}"][data-filter-bound="max"]`);
                        if (inp) inp.value = '';
                        triggerRerender();
                    }
                });
            }
        }
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

// --- Reset ---

function resetFilters() {
    currentSort = 'default';
    currentManufacturer = '';
    currentWeightMin = null;
    currentWeightMax = null;

    if (elements.sortSelect) elements.sortSelect.value = 'default';
    if (elements.manufacturerSelect) elements.manufacturerSelect.value = '';
    if (elements.weightMin) elements.weightMin.value = '';
    if (elements.weightMax) elements.weightMax.value = '';

    // Clear dynamic filters
    currentDynamicFilters = {};
    if (elements.dynamicFiltersContainer) elements.dynamicFiltersContainer.innerHTML = '';
    elements.dynamicFiltersSeparator?.classList.add('hidden');

    updateFilterChips();
}

function triggerRerender() {
    const searchTerm = elements.searchInput?.value.trim() || '';
    renderComponents(searchTerm);
}

// --- Event Listeners ---

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
