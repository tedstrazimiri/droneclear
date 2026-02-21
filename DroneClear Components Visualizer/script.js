// DOM Elements
const elements = {
    loader: document.getElementById('loader'),
    errorScreen: document.getElementById('error-screen'),
    errorMessage: document.getElementById('error-message'),
    componentsGrid: document.getElementById('components-grid'),
    categoryNav: document.getElementById('category-nav'),
    currentCategoryTitle: document.getElementById('current-category-title'),
    fileUpload: document.getElementById('file-upload'),
    searchInput: document.getElementById('search-input'),

    // Modal Elements
    modal: document.getElementById('detail-modal'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    modalTitle: document.getElementById('modal-title'),
    modalMfg: document.getElementById('modal-manufacturer'),
    modalPid: document.getElementById('modal-pid'),
    modalDesc: document.getElementById('modal-description'),
    modalTags: document.getElementById('modal-tags'),
    modalSpecs: document.getElementById('modal-specs'),
    modalCompatSection: document.getElementById('modal-compat-section'),
    modalCompat: document.getElementById('modal-compat'),
    modalNotesSection: document.getElementById('modal-notes-section'),
    modalNotes: document.getElementById('modal-notes'),
    modalSimilarSection: document.getElementById('modal-similar-section'),
    modalSimilarGrid: document.getElementById('modal-similar-grid'),
    modalLink: document.getElementById('modal-link'),
    modalEditBtn: document.getElementById('modal-edit-btn'),
    modalImageContainer: document.getElementById('modal-image-container'),
    modalAddBtn: document.getElementById('modal-add-btn'),

    // Build Drawer
    buildFab: document.getElementById('build-fab'),
    buildBadge: document.getElementById('build-badge'),
    buildOverlay: document.getElementById('build-overlay'),
    buildDrawer: document.getElementById('build-drawer'),
    drawerCloseBtn: document.getElementById('drawer-close-btn'),
    buildSlots: document.getElementById('build-slots'),
    buildWarnings: document.getElementById('build-warnings-container'),
    totalWeightEl: document.getElementById('build-total-weight'),
    totalCostEl: document.getElementById('build-total-cost'),
    clearBuildBtn: document.getElementById('clear-build-btn'),

    // Filter Toolbar
    filterToolbar: document.getElementById('filter-toolbar'),
    sortSelect: document.getElementById('sort-select'),
    manufacturerSelect: document.getElementById('manufacturer-select'),
    weightFilterGroup: document.getElementById('weight-filter-group'),
    weightMin: document.getElementById('weight-min'),
    weightMax: document.getElementById('weight-max'),
    filterClearBtn: document.getElementById('filter-clear-btn'),
    filterChips: document.getElementById('filter-chips'),

    // View Toggle
    btnViewGrid: document.getElementById('btn-view-grid'),
    btnViewList: document.getElementById('btn-view-list'),

    // Save / Load Build
    saveBuildBtn: document.getElementById('save-build-btn'),
    loadBuildBtn: document.getElementById('load-build-btn'),
    saveBuildModal: document.getElementById('save-build-modal'),
    saveBuildCloseBtn: document.getElementById('save-build-close-btn'),
    saveBuildCancelBtn: document.getElementById('save-build-cancel-btn'),
    saveBuildConfirmBtn: document.getElementById('save-build-confirm-btn'),
    buildNameInput: document.getElementById('build-name-input'),
    buildDescInput: document.getElementById('build-desc-input'),
    saveBuildSummary: document.getElementById('save-build-summary'),
    loadBuildModal: document.getElementById('load-build-modal'),
    loadBuildCloseBtn: document.getElementById('load-build-close-btn'),
    savedBuildsList: document.getElementById('saved-builds-list'),

    // Wizard
    btnStartWizard: document.getElementById('btn-start-wizard'),
    wizardHeader: document.getElementById('wizard-header'),
    wizardStepCounter: document.getElementById('wizard-step-counter'),
    wizardPrompt: document.getElementById('wizard-prompt'),
    wizardSkipBtn: document.getElementById('wizard-skip-btn'),
    wizardNextBtn: document.getElementById('wizard-next-btn'),
    wizardExitBtn: document.getElementById('wizard-exit-btn')
};

// State
let schemaData = {};
let currentCategory = null;

// Filter & Sort State
let currentSort = 'default';
let currentManufacturer = '';
let currentWeightMin = null;
let currentWeightMax = null;
let weightDebounceTimer = null;

// View State: 'grid' | 'list'
let currentView = 'grid';

// Localization System
const i18n = {
    'en': {
        'lblCompatible': 'Compatible',
        'lblIncompatible': 'Incompatible',
        'titleBuildTotal': 'Total Build Cost',
        'titleBuildWeight': 'Est. Total Weight',
        'emptyBuild': 'Your build is currently empty. Click "Add to Build" on a component to get started.',
        'btnCheckCompat': 'Check Compatibility'
    },
    'fr': {
        'lblCompatible': 'Compatible',
        'lblIncompatible': 'Incompatible',
        'titleBuildTotal': 'Coût Total',
        'titleBuildWeight': 'Poids Total Estimé',
        'emptyBuild': 'Votre montage est actuellement vide. Cliquez sur "Ajouter au Montage" sur un composant.',
        'btnCheckCompat': 'Vérifier la Compatibilité'
    }
};

let currentLang = 'en';

function updateLanguage(lang) {
    currentLang = lang;
    const els = document.querySelectorAll('[data-i18n]');
    els.forEach(el => {
        const key = el.getAttribute('data-i18n');
        // Simple mapping for index.html elements
        const map = {
            'appTitle': { en: 'Drone Models', fr: 'Modèles de Drones' },
            'appSubtitle': { en: 'Builder & Visualizer', fr: 'Constructeur et Visualiseur' },
            'navMasterAttr': { en: 'Master Attributes', fr: 'Attributs Principaux' },
            'navLibraryEditor': { en: 'Parts Library Editor', fr: 'Éditeur de Bibliothèque' },
            'navBuildWizard': { en: 'Build Wizard', fr: 'Assistant de Montage' },
            'btnUploadJson': { en: 'Upload Custom JSON', fr: 'Importer JSON' },
            'textLoading': { en: 'Loading Components...', fr: 'Chargement des composants...' },
            'errLoadTitle': { en: 'Failed to load', fr: 'Échec du chargement' },
            'errLoadDesc': { en: "Please make sure the file is in the same directory.", fr: "Assurez-vous que le fichier est dans le répertoire." },
            'btnAddBuild': { en: 'Add to Build', fr: 'Ajouter au Montage' },
            'btnEditPart': { en: 'Edit Component', fr: 'Modifier la Pièce' }
        };
        if (map[key] && map[key][lang]) {
            el.innerText = map[key][lang];
        }
    });

    // Toggle button styles
    const btnEn = document.getElementById('btn-lang-en');
    const btnFr = document.getElementById('btn-lang-fr');
    if (btnEn && btnFr) {
        if (lang === 'en') {
            btnEn.style.background = 'white';
            btnEn.style.color = 'var(--accent-red)';
            btnEn.style.boxShadow = 'var(--card-shadow)';
            btnFr.style.background = 'transparent';
            btnFr.style.color = 'var(--text-muted)';
            btnFr.style.boxShadow = 'none';
        } else {
            btnFr.style.background = 'white';
            btnFr.style.color = 'var(--accent-red)';
            btnFr.style.boxShadow = 'var(--card-shadow)';
            btnEn.style.background = 'transparent';
            btnEn.style.color = 'var(--text-muted)';
            btnEn.style.boxShadow = 'none';
        }
    }
    updateBuildTotals();
}

// Build State
let currentBuild = {
    frames: null,
    motors: null,
    flight_controllers: null,
    escs: null,
    video_transmitters: null,
    receivers: null,
    fpv_cameras: null,
    propellers: null,
    batteries: null,
    action_cameras: null,
    antennas: null
};

// Component currently viewed in modal
let activeModalComponent = null;

// Wizard State
let wizardActive = false;
let wizardCurrentStep = 0;
const wizardSequence = [
    { cat: 'frames', prompt: "Start with the foundation. Select a Frame.", name: "Frames" },
    { cat: 'flight_controllers', prompt: "Now, pick a Flight Controller that mounts to your frame.", name: "Flight Controllers" },
    { cat: 'escs', prompt: "Select an ESC (or skip if your FC is an AIO).", name: "ESCs" },
    { cat: 'motors', prompt: "Choose Motors that fit your frame and match your ESC rating.", name: "Motors" },
    { cat: 'propellers', prompt: "Pick Propellers that fit the frame.", name: "Propellers" },
    { cat: 'video_transmitters', prompt: "Select a VTX for your video feed.", name: "Video Transmitters" },
    { cat: 'fpv_cameras', prompt: "Pick a camera compatible with your VTX.", name: "FPV Cameras" },
    { cat: 'receivers', prompt: "Choose a Receiver for your radio link.", name: "Receivers" },
    { cat: 'batteries', prompt: "Finally, select a Battery.", name: "Batteries" }
];

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupEventListeners();
    initBuildDrawer();
    await fetchAllCategories();
}

function setupEventListeners() {
    elements.fileUpload?.addEventListener('change', handleFileUpload);
    elements.searchInput.addEventListener('input', handleSearch);

    elements.modalCloseBtn.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });
    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !elements.modal.classList.contains('hidden')) {
            closeModal();
        }
    });

    // Build Action
    elements.modalAddBtn.addEventListener('click', () => {
        if (activeModalComponent) {
            addToBuild(activeModalComponent);
            closeModal();
            if (!wizardActive) {
                openBuildDrawer();
            } else {
                wizardNextStep();
            }
        }
    });

    // Wizard Controls
    if (elements.btnStartWizard) {
        elements.btnStartWizard.addEventListener('click', startWizard);
    }
    if (elements.wizardSkipBtn) {
        elements.wizardSkipBtn.addEventListener('click', wizardNextStep);
    }
    if (elements.wizardNextBtn) {
        elements.wizardNextBtn.addEventListener('click', wizardNextStep);
    }
    if (elements.wizardExitBtn) {
        elements.wizardExitBtn.addEventListener('click', exitWizard);
    }

    // Global Help Event Listeners
    if (elements.btnGlobalHelp) {
        elements.btnGlobalHelp.addEventListener('click', () => {
            elements.helpModal.classList.remove('hidden');
        });
    }
    if (elements.helpCloseBtn) {
        elements.helpCloseBtn.addEventListener('click', () => {
            elements.helpModal.classList.add('hidden');
        });
    }
    elements.helpModal?.addEventListener('click', (e) => {
        if (e.target === elements.helpModal) {
            elements.helpModal.classList.add('hidden');
        }
    });

    // Language Toggles
    const btnEn = document.getElementById('btn-lang-en');
    const btnFr = document.getElementById('btn-lang-fr');
    if (btnEn) btnEn.addEventListener('click', () => updateLanguage('en'));
    if (btnFr) btnFr.addEventListener('click', () => updateLanguage('fr'));

    // Filter & Sort Listeners
    setupFilterListeners();
}

// Data Loading
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
        selectCategory(categories[0].slug); // Load first category by default
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
            const data = JSON.parse(e.target.result);
            processData(data);
        } catch (error) {
            showError('Invalid JSON file format.');
        }
    };
    reader.readAsText(file);
}

function processData(data) {
    schemaData = data;

    // Convert local schema keys into the object format expected by renderSidebar
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

// Formatting Helper
function formatTitle(text) {
    if (!text) return '';

    // Quick translations for top level categories
    if (currentLang === 'fr') {
        const frMap = {
            'frames': 'Châssis',
            'motors': 'Moteurs',
            'flight_controllers': 'Contrôleurs de Vol (FC)',
            'escs': 'Contrôleurs de Vitesse (ESC)',
            'video_transmitters': 'Émetteurs Vidéo (VTX)',
            'receivers': 'Récepteurs radio',
            'fpv_cameras': 'Caméras FPV',
            'propellers': 'Hélices',
            'batteries': 'Batteries LiPo',
            'action_cameras': 'Caméras HD',
            'antennas': 'Antennes'
        };
        if (frMap[text]) return frMap[text];
    }

    const acronyms = {
        'fpv': 'FPV', 'aio': 'AIO', 'fc': 'FC', 'esc': 'ESC',
        'pdb': 'PDB', 'vtx': 'VTX', 'dji': 'DJI', 'kv': 'KV',
        'rx': 'RX', 'tx': 'TX', 'hd': 'HD', 'pid': 'PID',
        'osd': 'OSD', 'led': 'LED', 'usb': 'USB', 'mcu': 'MCU',
        'imu': 'IMU', 'bec': 'BEC', 'gps': 'GPS', 'lipo': 'LiPo',
        'lihv': 'LiHV', 'mah': 'mAh', 'g': 'g', 'mm': 'mm',
        'pcb': 'PCB', 'cmos': 'CMOS', 'tvl': 'TVL', 'wdr': 'WDR',
        'cvbs': 'CVBS', 'mipi': 'MIPI', 'hdmi': 'HDMI', 'pc': 'PC',
        'tpu': 'TPU', 'rf': 'RF', 'pdb': 'PDB'
    };

    return text.toString().replace(/_/g, ' ').split(' ').map(word => {
        const lower = word.toLowerCase();

        // Exact match
        if (acronyms[lower]) return acronyms[lower];

        // Check for plural acronym (e.g. pdbs -> PDBs)
        if (lower.endsWith('s') && acronyms[lower.slice(0, -1)]) {
            return acronyms[lower.slice(0, -1)] + 's';
        }

        // Special case for hyphenated like "4-in-1"
        if (word.includes('-')) {
            return word.split('-').map(p => {
                const pLower = p.toLowerCase();
                if (acronyms[pLower]) return acronyms[pLower];
                return p.charAt(0).toUpperCase() + p.slice(1);
            }).join('-');
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

// UI Rendering
function renderSidebar(categories) {
    elements.categoryNav.innerHTML = '';
    let totalParts = 0;

    categories.forEach(categoryObj => {
        const category = categoryObj.slug || categoryObj;
        // Use the count provided by the backend, or fallback to schemaData array length
        const itemCount = categoryObj.count !== undefined ? categoryObj.count : (schemaData[category]?.length || 0);
        totalParts += itemCount;

        const navItem = document.createElement('a');
        navItem.className = 'nav-item';
        navItem.dataset.category = category;

        const formattedName = categoryObj.name || formatTitle(category);
        navItem.innerHTML = `
            <span>${formattedName}</span>
            <span class="nav-count">${itemCount}</span>
        `;

        navItem.addEventListener('click', (e) => {
            e.preventDefault();
            selectCategory(category);
        });

        elements.categoryNav.appendChild(navItem);
    });

    const partsCountEl = document.getElementById('total-parts-count');
    if (partsCountEl) {
        partsCountEl.textContent = `${totalParts} ${currentLang === 'fr' ? 'Pièces' : 'Parts'}`;
    }
}

async function selectCategory(category) {
    currentCategory = category;

    // Update Active Nav State
    const navItems = elements.categoryNav.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        if (item.dataset.category === category) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update Title
    elements.currentCategoryTitle.textContent = formatTitle(category);

    // Clear Search & reset filters
    elements.searchInput.value = '';
    resetFilters();

    await renderComponents();
}

async function renderComponents(searchTerm = '') {
    hideError();

    // Fetch components for this category if not cached
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

    const components = schemaData[currentCategory] || [];

    // Populate filter controls with raw category data
    populateFilterControls(components);

    // Apply search, filters, and sort
    const filteredComponents = applyFiltersAndSort(components, searchTerm);

    // Update active filter chips
    updateFilterChips();

    if (filteredComponents.length === 0) {
        const hasActiveFilters = currentSort !== 'default' || currentManufacturer || currentWeightMin !== null || currentWeightMax !== null || searchTerm;
        const msg = hasActiveFilters
            ? 'No components match your current filters. Try adjusting or clearing them.'
            : 'No components found in this category.';
        elements.componentsGrid.innerHTML = `<div class="empty-filter-state"><i class="ph ph-funnel-x"></i><p>${msg}</p></div>`;
        return;
    }

    // Wizard Highlighting Logic
    let highlightData = { active: false, matchPids: new Set(), warningPids: new Set() };
    if (wizardActive && currentBuild) {
        highlightData.active = true;
        filteredComponents.forEach(comp => {
            const simulatedBuild = { ...currentBuild, [currentCategory]: comp };
            const warnings = getBuildWarnings(simulatedBuild);
            if (warnings.length === 0) {
                highlightData.matchPids.add(comp.pid);
            } else if (warnings.some(w => w.type === 'error')) {
                // strict error, no highlight
            } else {
                highlightData.warningPids.add(comp.pid);
            }
        });
    }

    filteredComponents.forEach((comp, index) => {
        const card = createComponentCard(comp, highlightData);

        // Staggered entrance animation
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px)';
        card.style.transitionDelay = `${Math.min(index * 0.05, 0.5)}s`;

        elements.componentsGrid.appendChild(card);

        // Trigger reflow for animation
        requestAnimationFrame(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        });
    });
}

function createComponentCard(comp, highlightData = null) {
    const card = document.createElement('div');
    card.className = 'card';

    const tagsArray = comp.schema_data?.tags || [];
    const weightG = comp.schema_data?.weight_g;
    const tagsHtml = tagsArray.slice(0, 4).map(t => `<span class="tag">${t}</span>`).join('');

    // Translate compatible tooltip
    let tooltipCompat = i18n[currentLang].lblCompatible;
    let tooltipIncompat = i18n[currentLang].lblIncompatible;

    // Apply Wizard Highlight Styles
    if (highlightData && highlightData.active) {
        if (highlightData.matchPids.has(comp.pid)) {
            card.style.borderColor = 'var(--accent-green)';
            card.style.boxShadow = '0 0 15px rgba(34, 197, 94, 0.2)';
            card.title = tooltipCompat;
        } else if (highlightData.warningPids.has(comp.pid)) {
            card.style.borderColor = 'var(--accent-yellow)';
            card.title = tooltipCompat + ' (Warnings)';
        } else {
            card.style.opacity = '0.5';
            card.title = tooltipIncompat;
        }
    }

    // Generate Compatibility Badges for the Tile
    let compatHtml = '';
    const compatData = comp.schema_data?.compatibility || {};
    const compatKeys = Object.keys(compatData);

    if (compatKeys.length > 0) {
        // Grab up to 3 major compatibility rules to show
        const primaryRules = compatKeys.slice(0, 3);
        const badges = primaryRules.map(k => {
            let val = compatData[k];
            if (val === null || val === undefined || val === '') return '';

            if (Array.isArray(val)) {
                if (val.length === 0) return '';
                val = val[0] + (val.length > 1 ? '+' : '');
            } else if (typeof val === 'boolean') {
                val = val ? 'Yes' : 'No';
            }

            return `<span class="compat-badge" title="${formatTitle(k)}"><i class="ph ph-wrench"></i> ${val}</span>`;
        }).filter(b => b !== '').join('');
        compatHtml = `<div class="card-compat-badges">${badges}</div>`;
    }

    const priceHtml = comp.approx_price
        ? `<span class="card-price">${comp.approx_price}</span>`
        : '';

    card.innerHTML = `
        <div class="card-header">
            <span class="card-pid">${comp.pid || 'N/A'}</span>
            ${weightG ? `<span class="tag weight-tag">${weightG}g</span>` : ''}
            ${priceHtml}
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

    return card;
}

// Search
function handleSearch(e) {
    const term = e.target.value.trim();
    if (currentCategory) {
        renderComponents(term);
    }
}

// --- Filter & Sort ---

function parsePrice(str) {
    if (!str) return null;
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? null : num;
}

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
                case 'name-asc':
                    return (a.name || '').localeCompare(b.name || '');
                case 'name-desc':
                    return (b.name || '').localeCompare(a.name || '');
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
                default:
                    return 0;
            }
        });
    }

    return result;
}

function populateFilterControls(components) {
    // Manufacturers
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

    // Weight filter visibility
    const hasWeight = components.some(c => c.schema_data?.weight_g !== undefined && c.schema_data?.weight_g !== null);
    if (hasWeight) {
        elements.weightFilterGroup.classList.remove('hidden');
    } else {
        elements.weightFilterGroup.classList.add('hidden');
    }

    // Show toolbar
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

    // Wire up chip dismiss buttons
    elements.filterChips.querySelectorAll('.filter-chip').forEach((el, i) => {
        el.querySelector('.chip-remove').addEventListener('click', chips[i].action);
    });

    if (elements.filterClearBtn) {
        if (hasActiveFilters) {
            elements.filterClearBtn.classList.remove('hidden');
        } else {
            elements.filterClearBtn.classList.add('hidden');
        }
    }
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
    elements.sortSelect?.addEventListener('change', (e) => {
        currentSort = e.target.value;
        triggerRerender();
    });

    elements.manufacturerSelect?.addEventListener('change', (e) => {
        currentManufacturer = e.target.value;
        triggerRerender();
    });

    elements.weightMin?.addEventListener('input', () => {
        clearTimeout(weightDebounceTimer);
        weightDebounceTimer = setTimeout(() => {
            const val = parseFloat(elements.weightMin.value);
            currentWeightMin = isNaN(val) ? null : val;
            triggerRerender();
        }, 350);
    });

    elements.weightMax?.addEventListener('input', () => {
        clearTimeout(weightDebounceTimer);
        weightDebounceTimer = setTimeout(() => {
            const val = parseFloat(elements.weightMax.value);
            currentWeightMax = isNaN(val) ? null : val;
            triggerRerender();
        }, 350);
    });

    elements.filterClearBtn?.addEventListener('click', () => {
        resetFilters();
        triggerRerender();
    });

    // View toggle
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

// Modal Logic
function openModal(comp) {
    activeModalComponent = comp;

    // Populate Headers
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

    // Process Fields from schema_data
    const specsHtml = [];
    const notesHtml = [];

    const schemaData = comp.schema_data || {};
    const ignoredKeys = ['tags', 'compatibility', 'weight_g'];

    Object.keys(schemaData).forEach(key => {
        if (ignoredKeys.includes(key)) return;

        const val = schemaData[key];

        if (key.startsWith('_')) {
            // It's a note or option hint
            notesHtml.push(`
                <div class="note-item">
                    <strong>${key}</strong>
                    <span>${val}</span>
                </div>
            `);
        } else if (val !== null && typeof val !== 'object') {
            // Standard spec
            let displayVal = val;
            let valClass = '';

            if (typeof val === 'boolean') {
                displayVal = val ? 'Yes' : 'No';
                if (currentLang === 'fr') displayVal = val ? 'Oui' : 'Non';
                valClass = val ? 'bool-true' : 'bool-false';
            }

            const label = formatTitle(key);
            specsHtml.push(`
                <div class="spec-item">
                    <span class="spec-label">${label}</span>
                    <span class="spec-value ${valClass}">${displayVal}</span>
                </div>
            `);
        } else if (Array.isArray(val) && typeof val[0] !== 'object') {
            // Simple array (e.g. firmware_support)
            const label = formatTitle(key);
            specsHtml.push(`
                <div class="spec-item">
                    <span class="spec-label">${label}</span>
                    <span class="spec-value">${val.join(', ')}</span>
                </div>
            `);
        }
    });

    elements.modalSpecs.innerHTML = specsHtml.join('');

    // Notes section
    if (notesHtml.length > 0) {
        elements.modalNotes.innerHTML = notesHtml.join('');
        elements.modalNotesSection.classList.remove('hidden');
    } else {
        elements.modalNotesSection.classList.add('hidden');
    }

    // Compatibility section
    const compCompat = comp.schema_data?.compatibility || {};
    if (Object.keys(compCompat).length > 0) {
        const compatHtml = Object.entries(compCompat).map(([k, v]) => {
            const label = formatTitle(k);
            let displayVal = v;
            if (Array.isArray(v)) displayVal = v.join(', ');
            else if (typeof v === 'boolean') displayVal = v ? 'Yes' : 'No';

            return `
                <div class="spec-item" style="border-color: rgba(6, 182, 212, 0.3); background: rgba(6, 182, 212, 0.05);">
                    <span class="spec-label" style="color: var(--accent-cyan);">${label}</span>
                    <span class="spec-value">${displayVal}</span>
                </div>
            `;
        }).join('');

        elements.modalCompat.innerHTML = compatHtml;
        elements.modalCompatSection.classList.remove('hidden');
    } else {
        elements.modalCompatSection.classList.add('hidden');
    }

    // Similar Alternatives Engine
    const similarComps = findSimilarComponents(comp);
    if (similarComps.length > 0) {
        elements.modalSimilarGrid.innerHTML = similarComps.map(simItem => {
            const priceHtml = simItem.approx_price ? `<span style="color:var(--accent-green);font-size:12px;">${simItem.approx_price}</span>` : '';
            return `
                <div class="similar-card" title="Switch to ${simItem.name}" style="cursor: pointer; padding: 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; background: rgba(0,0,0,0.2);" onclick="switchModalItem('${simItem.pid}')">
                    <div style="font-size:11px; color:var(--text-muted);">${simItem.manufacturer || 'Unknown'}</div>
                    <div style="font-weight:600; font-size:13px; margin: 4px 0;">${simItem.name}</div>
                    ${priceHtml}
                </div>
            `;
        }).join('');
        elements.modalSimilarSection.classList.remove('hidden');
    } else {
        elements.modalSimilarSection.classList.add('hidden');
    }

    // Image handling
    if (comp.image_file) {
        elements.modalImageContainer.innerHTML = `<img src="${comp.image_file}" alt="Component Image" class="modal-image" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\\'ph ph-image-broken\\'></i>';">`;
    } else {
        elements.modalImageContainer.innerHTML = `<i class="ph ph-image"></i>`;
    }

    // Set up Edit link route
    elements.modalEditBtn.href = `/editor/?edit_pid=${comp.pid}`;

    elements.modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeModal() {
    elements.modal.classList.add('hidden');
    document.body.style.overflow = '';
}

// Global hook for similar card clicks
window.switchModalItem = function (pid) {
    if (!schemaData[currentCategory]) return;
    const item = schemaData[currentCategory].find(c => c.pid === pid);
    if (item) {
        elements.modal.classList.add('hidden'); // flash out
        setTimeout(() => openModal(item), 50); // open new
    }
}

// Similar Engine Logic
function findSimilarComponents(targetComp) {
    if (!currentCategory || !schemaData[currentCategory]) return [];
    const allComps = schemaData[currentCategory];

    // Evaluate scores
    const scoredComps = [];
    allComps.forEach(comp => {
        if (comp.pid === targetComp.pid) return; // Skip self
        let score = 0;

        // 1. Same Manufacturer Bonus = +3
        if (comp.manufacturer && targetComp.manufacturer && comp.manufacturer.toLowerCase() === targetComp.manufacturer.toLowerCase()) score += 3;

        // 2. Similarity of Tags = +2 per tag
        const tTags = targetComp.schema_data?.tags || [];
        const cTags = comp.schema_data?.tags || [];
        const sharedTags = tTags.filter(t => cTags.includes(t));
        score += (sharedTags.length * 2);

        // 3. Similar Weight (+/- 10%) = +4
        const tWeight = parseFloat(targetComp.schema_data?.weight_g);
        const cWeight = parseFloat(comp.schema_data?.weight_g);
        if (tWeight && cWeight) {
            const diff = Math.abs(tWeight - cWeight);
            if (diff <= (tWeight * 0.10)) score += 4;
            else if (diff <= (tWeight * 0.25)) score += 2;
        }

        // 4. Same Exact Compatibility Rules = +5 per rule
        const tCompat = targetComp.schema_data?.compatibility || {};
        const cCompat = comp.schema_data?.compatibility || {};
        Object.keys(tCompat).forEach(k => {
            if (cCompat[k] !== undefined) {
                if (JSON.stringify(tCompat[k]) === JSON.stringify(cCompat[k])) score += 5;
            }
        });

        if (score > 0) {
            scoredComps.push({ comp, score });
        }
    });

    // Sort by descending score
    scoredComps.sort((a, b) => b.score - a.score);

    // Return Top 3
    return scoredComps.slice(0, 3).map(obj => obj.comp);
}

// Utilities
function showLoader() {
    elements.loader.classList.remove('hidden');
    elements.errorScreen.classList.add('hidden');
    elements.componentsGrid.classList.add('hidden');
}

function hideLoader() {
    elements.loader.classList.add('hidden');
}

function hideError() {
    elements.errorScreen.classList.add('hidden');
}

function showError(message) {
    hideLoader();
    elements.componentsGrid.classList.add('hidden');
    elements.errorMessage.textContent = message;
    elements.errorScreen.classList.remove('hidden');
}

// --- Build Configurator Logic ---

function initBuildDrawer() {
    renderBuildSlots();
    updateBuildTotals();
    updateBuildBadge();

    // Event listeners
    elements.buildFab.addEventListener('click', openBuildDrawer);
    elements.drawerCloseBtn.addEventListener('click', closeBuildDrawer);
    elements.buildOverlay.addEventListener('click', closeBuildDrawer);

    if (elements.clearBuildBtn) {
        elements.clearBuildBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to clear your entire build?")) {
                for (let key in currentBuild) {
                    currentBuild[key] = null;
                }
                renderBuildSlots();
                updateBuildTotals();
                updateBuildBadge();
                validateBuild();
            }
        });
    }

    // Save / Load build buttons
    elements.saveBuildBtn?.addEventListener('click', openSaveBuildModal);
    elements.loadBuildBtn?.addEventListener('click', openLoadBuildModal);

    // Save modal controls
    elements.saveBuildCloseBtn?.addEventListener('click', closeSaveBuildModal);
    elements.saveBuildCancelBtn?.addEventListener('click', closeSaveBuildModal);
    elements.saveBuildModal?.addEventListener('click', (e) => { if (e.target === elements.saveBuildModal) closeSaveBuildModal(); });
    elements.saveBuildConfirmBtn?.addEventListener('click', confirmSaveBuild);
    elements.buildNameInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmSaveBuild(); });

    // Load modal controls
    elements.loadBuildCloseBtn?.addEventListener('click', closeLoadBuildModal);
    elements.loadBuildModal?.addEventListener('click', (e) => { if (e.target === elements.loadBuildModal) closeLoadBuildModal(); });
}

function openBuildDrawer() {
    if (wizardActive && elements.wizardHeader) {
        elements.wizardHeader.classList.remove('hidden');
    } else if (elements.wizardHeader) {
        elements.wizardHeader.classList.add('hidden');
    }

    elements.buildOverlay.classList.remove('hidden');
    elements.buildDrawer.classList.remove('closed');
}

function closeBuildDrawer() {
    elements.buildOverlay.classList.add('hidden');
    elements.buildDrawer.classList.add('closed');
}

// --- Wizard Engine ---
async function startWizard() {
    wizardActive = true;
    wizardCurrentStep = 0;

    // Clear build to start fresh
    for (let key in currentBuild) {
        currentBuild[key] = null;
    }
    renderBuildSlots();
    updateBuildTotals();
    updateBuildBadge();
    validateBuild();

    await loadWizardStep();
}

async function loadWizardStep() {
    if (wizardCurrentStep >= wizardSequence.length) {
        exitWizard(true);
        return;
    }

    const step = wizardSequence[wizardCurrentStep];

    // Update Header
    elements.wizardStepCounter.textContent = `Step ${wizardCurrentStep + 1} of ${wizardSequence.length}`;
    elements.wizardPrompt.textContent = step.prompt;

    if (wizardCurrentStep < wizardSequence.length - 1) {
        elements.wizardNextBtn.textContent = `Next: ${wizardSequence[wizardCurrentStep + 1].name}`;
    } else {
        elements.wizardNextBtn.textContent = `Finish Build`;
    }

    // Switch Category in Visualizer
    await selectCategory(step.cat);

    // Open Drawer briefly to show instructions, then hide so they can pick
    openBuildDrawer();
    setTimeout(() => {
        if (wizardActive && elements.buildDrawer.classList.contains('closed') === false) {
            closeBuildDrawer();
        }
    }, 2500);
}

async function wizardNextStep() {
    wizardCurrentStep++;
    await loadWizardStep();
}

function exitWizard(completed = false) {
    wizardActive = false;
    if (elements.wizardHeader) elements.wizardHeader.classList.add('hidden');
    if (completed) {
        openBuildDrawer(); // Open drawer to see final build
    }
}

function addToBuild(comp) {
    let targetCat = currentCategory;
    if (currentBuild.hasOwnProperty(targetCat)) {
        currentBuild[targetCat] = comp;
    } else {
        currentBuild[targetCat] = comp;
    }

    renderBuildSlots();
    updateBuildTotals();
    updateBuildBadge();
    validateBuild();
}

function removeFromBuild(category) {
    currentBuild[category] = null;
    renderBuildSlots();
    updateBuildTotals();
    updateBuildBadge();
    validateBuild();
}

function renderBuildSlots() {
    elements.buildSlots.innerHTML = '';

    const prioritySlots = ['frames', 'flight_controllers', 'escs', 'motors', 'propellers', 'video_transmitters', 'fpv_cameras', 'receivers', 'antennas', 'batteries'];
    const allSlots = new Set([...prioritySlots, ...Object.keys(currentBuild)]);

    allSlots.forEach(cat => {
        if (!currentBuild.hasOwnProperty(cat)) return;

        const comp = currentBuild[cat];
        const slotEl = document.createElement('div');
        slotEl.className = 'build-slot ' + (comp ? 'filled' : '');

        const catName = formatTitle(cat);

        if (comp) {
            const price = comp.approx_price ? comp.approx_price : 'N/A';
            const weight = comp.schema_data?.weight_g ? `${comp.schema_data.weight_g}g` : 'Unknown Weight';

            slotEl.innerHTML = `
                <span class="slot-label">${catName}</span>
                <div class="slot-content">
                    <div class="slot-details">
                        <h4>${comp.name}</h4>
                        <div class="slot-metrics">
                            <span style="color: var(--accent-cyan);">${price}</span>
                            <span>${weight}</span>
                        </div>
                    </div>
                    <button class="slot-remove" onclick="removeFromBuild('${cat}')" title="Remove part">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            `;
        } else {
            slotEl.innerHTML = `
                <span class="slot-label">${catName}</span>
                <span class="slot-empty-text">Empty Slot</span>
            `;
        }

        elements.buildSlots.appendChild(slotEl);
    });
}

function updateBuildTotals() {
    let totalWeight = 0;
    let totalCost = 0;

    Object.values(currentBuild).forEach(comp => {
        if (!comp) return;

        if (comp.schema_data && comp.schema_data.weight_g) {
            const w = parseFloat(comp.schema_data.weight_g);
            if (!isNaN(w)) totalWeight += w;
        }

        if (comp.approx_price) {
            const match = comp.approx_price.match(/[\d\.]+/);
            if (match) {
                const c = parseFloat(match[0]);
                if (!isNaN(c)) totalCost += c;
            }
        }
    });

    if (elements.totalWeightEl) elements.totalWeightEl.textContent = `${totalWeight.toFixed(1)}g`;
    if (elements.totalCostEl) elements.totalCostEl.textContent = `$${totalCost.toFixed(2)}`;
}

function updateBuildBadge() {
    const count = Object.values(currentBuild).filter(c => c !== null).length;
    if (elements.buildBadge) elements.buildBadge.textContent = count;

    if (count > 0 && elements.buildFab) {
        elements.buildFab.style.transform = 'scale(1.1)';
        setTimeout(() => elements.buildFab.style.transform = '', 200);
    }
}

// --- Constraint Validation ---
function getBuildWarnings(buildState) {
    const warnings = [];

    const frame = buildState.frames;
    const props = buildState.propellers;
    const fc = buildState.flight_controllers;
    const motors = buildState.motors;
    const esc = buildState.escs;
    const bat = buildState.batteries;

    // 1. Frame vs Propellers
    if (frame && props) {
        const frameMax = parseFloat(frame.schema_data?.max_prop_size_in);
        const propSize = parseFloat(props.schema_data?.prop_size_in);
        if (frameMax && propSize && propSize > frameMax) {
            warnings.push({
                type: 'error',
                title: 'Propeller Size Exceeds Frame Limits',
                message: `The frame supports up to ${frameMax}" props, but you selected ${propSize}" propellers.`
            });
        }
    }

    // 2. Frame vs FC Mounting
    if (frame && fc) {
        const frameMounts = frame.schema_data?.fc_mounting_patterns_mm || [];
        const fcMount = fc.schema_data?.bolt_pattern_mm;
        if (fcMount && frameMounts.length > 0 && !frameMounts.includes(fcMount)) {
            warnings.push({
                type: 'error',
                title: 'Flight Controller Mount Mismatch',
                message: `The ${fcMount} FC will not bolt onto this frame, which only supports: ${frameMounts.join(', ')}.`
            });
        }
    }

    // 3. Frame vs Motor Mounting
    if (frame && motors) {
        const frameMounts = frame.schema_data?.motor_mounting_patterns_mm || [];
        const motorMount = motors.schema_data?.compatibility?.motor_mount_hole_spacing_mm;
        if (motorMount && frameMounts.length > 0 && !frameMounts.includes(motorMount)) {
            warnings.push({
                type: 'error',
                title: 'Motor Mount Mismatch',
                message: `These motors use a ${motorMount} pattern. The frame supports: ${frameMounts.join(', ')}.`
            });
        }
    }

    // 4. Battery Cell Count
    if (bat) {
        const batCells = parseInt(bat.schema_data?.cell_count_s);

        // vs Motor
        if (batCells && motors) {
            const motorMax = parseInt(motors.schema_data?.compatibility?.cell_count_max);
            if (motorMax && batCells > motorMax) {
                warnings.push({
                    type: 'warning',
                    title: 'Battery Voltage High for Motors',
                    message: `These motors are rated for up to ${motorMax}S, but you chose a ${batCells}S battery.`
                });
            }
        }

        // vs ESC
        if (batCells && esc) {
            const escMax = parseInt(esc.schema_data?.compatibility?.cell_count_max);
            const escMin = parseInt(esc.schema_data?.compatibility?.cell_count_min);
            if (escMax && batCells > escMax) {
                warnings.push({
                    type: 'error',
                    title: 'ESC Overvoltage Risk',
                    message: `The ESC max rating is ${escMax}S. A ${batCells}S battery will likely fry it.`
                });
            } else if (escMin && batCells < escMin) {
                warnings.push({
                    type: 'warning',
                    title: 'Low Battery Voltage',
                    message: `The ESC expects at least ${escMin}S. A ${batCells}S battery may not power it properly.`
                });
            }
        }
    }

    return warnings;
}

function validateBuild() {
    if (!elements.buildWarnings) return;
    elements.buildWarnings.innerHTML = '';
    const warnings = getBuildWarnings(currentBuild);

    // Render Warnings
    warnings.forEach(w => {
        const el = document.createElement('div');
        el.className = `build-warning ${w.type === 'error' ? 'error' : ''}`;
        el.innerHTML = `
            <i class="${w.type === 'error' ? 'ph-fill ph-warning-octagon' : 'ph-fill ph-warning'}"></i>
            <div class="build-warning-content">
                <strong>${w.title}</strong>
                <span>${w.message}</span>
            </div>
        `;
        elements.buildWarnings.appendChild(el);
    });
}

// --- Save / Load Build ---

function getBuildComponentCount() {
    return Object.values(currentBuild).filter(c => c !== null).length;
}

function buildSummaryHtml() {
    const filled = Object.entries(currentBuild).filter(([, v]) => v !== null);
    if (filled.length === 0) return '<p style="color:var(--text-faint);font-size:13px;">No components selected yet.</p>';
    return filled.map(([cat, comp]) =>
        `<div class="save-summary-row"><span class="save-summary-cat">${formatTitle(cat)}</span><span class="save-summary-name">${comp.name}</span></div>`
    ).join('');
}

function generateBuildPid() {
    return 'BUILD-' + Date.now().toString(36).toUpperCase();
}

function openSaveBuildModal() {
    const count = getBuildComponentCount();
    if (count === 0) {
        showToast('Add at least one component before saving.', 'warning');
        return;
    }
    if (elements.buildNameInput) elements.buildNameInput.value = '';
    if (elements.buildDescInput) elements.buildDescInput.value = '';
    if (elements.saveBuildSummary) elements.saveBuildSummary.innerHTML = buildSummaryHtml();
    elements.saveBuildModal?.classList.remove('hidden');
    setTimeout(() => elements.buildNameInput?.focus(), 50);
}

function closeSaveBuildModal() {
    elements.saveBuildModal?.classList.add('hidden');
}

async function confirmSaveBuild() {
    const name = elements.buildNameInput?.value.trim();
    if (!name) {
        elements.buildNameInput?.focus();
        elements.buildNameInput?.classList.add('input-error');
        setTimeout(() => elements.buildNameInput?.classList.remove('input-error'), 1200);
        return;
    }

    const desc = elements.buildDescInput?.value.trim() || '';

    // Build the relations map: category -> component PID
    const relations = {};
    Object.entries(currentBuild).forEach(([cat, comp]) => {
        if (comp) relations[cat] = comp.pid;
    });

    const payload = {
        pid: generateBuildPid(),
        name: name,
        description: desc,
        relations: relations
    };

    try {
        elements.saveBuildConfirmBtn.disabled = true;
        elements.saveBuildConfirmBtn.innerHTML = '<i class="ph ph-spinner"></i> Saving…';

        const response = await fetch('/api/drone-models/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(JSON.stringify(err));
        }

        closeSaveBuildModal();
        showToast(`Build "${name}" saved successfully!`, 'success');
    } catch (err) {
        console.error('Save build failed:', err);
        showToast('Failed to save build. Please try again.', 'error');
    } finally {
        elements.saveBuildConfirmBtn.disabled = false;
        elements.saveBuildConfirmBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Save';
    }
}

async function openLoadBuildModal() {
    elements.loadBuildModal?.classList.remove('hidden');
    elements.savedBuildsList.innerHTML = '<div class="saved-builds-loading"><i class="ph ph-spinner"></i> Loading saved builds…</div>';

    try {
        const response = await fetch('/api/drone-models/');
        if (!response.ok) throw new Error('Failed to fetch builds');
        const builds = await response.json();

        if (builds.length === 0) {
            elements.savedBuildsList.innerHTML = '<div class="saved-builds-empty"><i class="ph ph-archive"></i><p>No saved builds yet.</p></div>';
            return;
        }

        elements.savedBuildsList.innerHTML = builds.map(b => {
            const slotCount = Object.keys(b.relations || {}).length;
            const slotNames = Object.keys(b.relations || {}).map(k => formatTitle(k)).join(', ') || 'Empty';
            return `
                <div class="saved-build-item">
                    <div class="saved-build-info">
                        <div class="saved-build-name">${b.name}</div>
                        <div class="saved-build-meta">${slotCount} component${slotCount !== 1 ? 's' : ''} · <span style="color:var(--text-faint);font-size:11px;">${b.pid}</span></div>
                        ${b.description ? `<div class="saved-build-desc">${b.description}</div>` : ''}
                        <div class="saved-build-slots">${slotNames}</div>
                    </div>
                    <div class="saved-build-actions">
                        <button class="btn btn-primary btn-sm" onclick="loadBuild('${b.pid}')">
                            <i class="ph ph-download-simple"></i> Load
                        </button>
                        <button class="btn btn-outline btn-sm" style="border-color:rgba(239,68,68,0.3);color:#ef4444;" onclick="deleteBuild('${b.pid}', '${b.name.replace(/'/g, "\\'")}')">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
        elements.savedBuildsList.innerHTML = '<div class="saved-builds-empty"><i class="ph ph-warning-circle"></i><p>Could not load builds.</p></div>';
    }
}

function closeLoadBuildModal() {
    elements.loadBuildModal?.classList.add('hidden');
}

window.loadBuild = async function(pid) {
    try {
        const response = await fetch(`/api/drone-models/${pid}/`);
        if (!response.ok) throw new Error('Build not found');
        const build = await response.json();
        const relations = build.relations || {};

        // Clear current build
        for (let key in currentBuild) currentBuild[key] = null;

        // Resolve each PID back to a component object
        const loadPromises = Object.entries(relations).map(async ([cat, compPid]) => {
            try {
                // Check cache first
                if (schemaData[cat]) {
                    const found = schemaData[cat].find(c => c.pid === compPid);
                    if (found) { currentBuild[cat] = found; return; }
                }
                // Fetch from API
                const r = await fetch(`/api/components/?category=${cat}`);
                if (!r.ok) return;
                const comps = await r.json();
                schemaData[cat] = comps; // Cache
                const found = comps.find(c => c.pid === compPid);
                if (found) currentBuild[cat] = found;
            } catch (e) { console.warn(`Could not resolve ${cat}:${compPid}`, e); }
        });

        await Promise.all(loadPromises);

        renderBuildSlots();
        updateBuildTotals();
        updateBuildBadge();
        validateBuild();

        closeLoadBuildModal();
        openBuildDrawer();
        showToast(`Build "${build.name}" loaded!`, 'success');
    } catch (err) {
        console.error(err);
        showToast('Failed to load build.', 'error');
    }
};

window.deleteBuild = async function(pid, name) {
    if (!confirm(`Delete build "${name}"? This cannot be undone.`)) return;
    try {
        const response = await fetch(`/api/drone-models/${pid}/`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': getCookie('csrftoken') }
        });
        if (!response.ok && response.status !== 204) throw new Error('Delete failed');
        showToast(`Build "${name}" deleted.`, 'info');
        openLoadBuildModal(); // Refresh list
    } catch (err) {
        console.error(err);
        showToast('Failed to delete build.', 'error');
    }
};

// --- Toast Notification System ---
let toastTimer = null;

function showToast(message, type = 'info') {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        document.body.appendChild(toast);
    }
    const icons = { success: 'ph-check-circle', error: 'ph-warning-circle', warning: 'ph-warning', info: 'ph-info' };
    toast.className = `app-toast app-toast--${type} show`;
    toast.innerHTML = `<i class="ph-fill ${icons[type] || 'ph-info'}"></i><span>${message}</span>`;

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// --- CSRF helper ---
function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)'));
    return match ? match[2] : '';
}
