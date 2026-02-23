// =============================================================
// state.js — All shared global state and DOM element refs
// =============================================================

// DOM Elements (populated once DOM is ready)
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
    dynamicFiltersContainer: document.getElementById('dynamic-filters-container'),
    dynamicFiltersSeparator: document.getElementById('dynamic-filters-separator'),

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
    wizardExitBtn: document.getElementById('wizard-exit-btn'),

    // Wizard Banner (persistent guide bar)
    wizardBanner: document.getElementById('wizard-banner'),
    wizardBannerStep: document.getElementById('wizard-banner-step'),
    wizardBannerPrompt: document.getElementById('wizard-banner-prompt'),
    wizardBannerSelection: document.getElementById('wizard-banner-selection'),
    wizardBannerProgress: document.getElementById('wizard-banner-progress'),
    wizardBannerSkip: document.getElementById('wizard-banner-skip'),
    wizardBannerExit: document.getElementById('wizard-banner-exit'),

    // Dark Mode
    darkModeToggle: document.getElementById('dark-mode-toggle'),
    darkModeIcon: document.getElementById('dark-mode-icon')
};

// --- Component Cache & Navigation State ---
let schemaTemplate = {};
let schemaData = {};
let currentCategory = null;
let activeModalComponent = null;

// --- Filter & Sort State ---
let currentSort = 'default';
let currentManufacturer = '';
let currentWeightMin = null;
let currentWeightMax = null;
let weightDebounceTimer = null;
let searchDebounceTimer = null;

// --- Dynamic Attribute Filters ---
let currentDynamicFilters = {};       // { 'schema_data.kv_rating': { type: 'range', min: 1800, max: null }, ... }
let dynamicFilterDebounceTimers = {};

// --- View State: 'grid' | 'list' ---
let currentView = 'grid';

// --- Localization ---
const i18n = {
    en: {
        lblCompatible: 'Compatible',
        lblIncompatible: 'Incompatible',
        titleBuildTotal: 'Total Build Cost',
        titleBuildWeight: 'Est. Total Weight',
        emptyBuild: 'Your build is currently empty. Click "Add to Build" on a component to get started.',
        btnCheckCompat: 'Check Compatibility'
    },
    fr: {
        lblCompatible: 'Compatible',
        lblIncompatible: 'Incompatible',
        titleBuildTotal: 'Coût Total',
        titleBuildWeight: 'Poids Total Estimé',
        emptyBuild: 'Votre montage est actuellement vide. Cliquez sur "Ajouter au Montage" sur un composant.',
        btnCheckCompat: 'Vérifier la Compatibilité'
    }
};

let currentLang = 'en';

// --- Build State ---
let currentBuild = {
    frames: null,
    stacks: null,
    motors: null,
    flight_controllers: null,
    escs: null,
    video_transmitters: null,
    receivers: null,
    fpv_cameras: null,
    propellers: null,
    batteries: null,
    antennas: null,
    action_cameras: null
};

// --- Wizard State ---
let wizardActive = false;
let wizardCurrentStep = 0;
let wizardDroneClass = null; // 'micro', '3inch', '5inch', '7inch', 'heavy', 'all', or null
const wizardSequence = [
    { cat: 'frames',              prompt: 'Start with the foundation. Select a Frame.',                                       name: 'Frames' },
    { cat: 'stacks',              prompt: 'If using an FC+ESC stack, select it here — or skip for separate components.',       name: 'Stacks (Optional)' },
    { cat: 'flight_controllers',  prompt: 'Pick a Flight Controller that mounts to your frame.',                              name: 'Flight Controllers' },
    { cat: 'escs',                prompt: 'Select an ESC (or skip if your FC is an AIO).',                                    name: 'ESCs' },
    { cat: 'motors',              prompt: 'Choose Motors that fit your frame and match your ESC rating.',                     name: 'Motors' },
    { cat: 'propellers',          prompt: 'Pick Propellers that fit the frame.',                                              name: 'Propellers' },
    { cat: 'video_transmitters',  prompt: 'Select a VTX for your video feed.',                                                name: 'Video Transmitters' },
    { cat: 'fpv_cameras',         prompt: 'Pick a camera compatible with your VTX.',                                          name: 'FPV Cameras' },
    { cat: 'receivers',           prompt: 'Choose a Receiver for your radio link.',                                           name: 'Receivers' },
    { cat: 'batteries',           prompt: 'Select a Battery for your build.',                                                 name: 'Batteries' },
    { cat: 'antennas',            prompt: 'Optionally, add Antennas for your VTX or receiver.',                               name: 'Antennas (Optional)' },
    { cat: 'action_cameras',      prompt: 'Optionally, add an Action Camera for HD recording.',                               name: 'Action Cameras (Optional)' }
];

