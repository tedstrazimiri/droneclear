/* ═══════════════════════════════════════════════════════════
   guide-state.js — Global state, DOM refs, settings
   ═══════════════════════════════════════════════════════════ */

const guideState = {
    phase: 'selection',       // 'selection' | 'overview' | 'running' | 'completed' | 'editing'
    guides: [],               // Cached guide list from API
    selectedGuide: null,      // Full guide detail (with steps)
    session: null,            // Active BuildSession
    currentStepIndex: 0,
    checklist: {},            // { componentPID: boolean }
    photos: {},               // { stepOrder: [photoUrl, ...] }
    cameraStream: null,
    editingGuide: null,       // Guide being edited
    editingStepIndex: -1,     // Which step in editor is selected (-1 = none)
    // Timer state
    buildStartTime: null,     // Date.now() when build starts
    stepStartTime: null,      // Date.now() when current step starts
    stepElapsed: {},          // { stepOrder: elapsedMs }
    timerInterval: null,      // setInterval ID
    // Checklists (in-memory per session)
    stepChecklists: {},       // { stepOrder: { checkIndex: boolean } }
    // Resolved component cache { PID: fullComponentObject | null }
    resolvedComponents: {},
};

// Settings persisted in localStorage
const GUIDE_SETTINGS_KEY = 'dc-guide-settings';
let guideSettings = {
    photoQuality: 'medium',
    autoAdvance: false,
    showSafetyWarnings: true,
};

function loadGuideSettings() {
    try {
        const saved = localStorage.getItem(GUIDE_SETTINGS_KEY);
        if (saved) Object.assign(guideSettings, JSON.parse(saved));
    } catch (e) { /* ignore */ }
}

function saveGuideSettings() {
    localStorage.setItem(GUIDE_SETTINGS_KEY, JSON.stringify(guideSettings));
}

// Photo quality → max width mapping
const PHOTO_QUALITY_MAP = { low: 640, medium: 1280, high: 1920 };

// DOM element cache (populated on DOMContentLoaded)
const guideDOM = {};

function cacheGuideDOMRefs() {
    const ids = [
        'guide-loader', 'guide-page-title',
        // Selection
        'guide-selection', 'guide-grid', 'guide-empty-state',
        // Overview
        'guide-overview', 'overview-title', 'overview-description',
        'overview-difficulty', 'overview-time', 'overview-steps-count',
        'overview-tools-list', 'overview-checklist', 'overview-builder-name',
        'btn-back-to-selection', 'btn-start-build',
        // Runner
        'guide-running', 'runner-progress-bar', 'runner-step-number',
        'runner-step-type', 'runner-step-time', 'runner-step-title',
        'runner-safety-warning', 'runner-safety-text', 'runner-step-description',
        'runner-media-carousel', 'media-track', 'media-prev', 'media-next',
        'media-dots', 'media-expand', 'media-caption',
        'media-lightbox', 'lightbox-close', 'lightbox-prev', 'lightbox-next',
        'lightbox-viewport', 'lightbox-caption', 'lightbox-dots',
        'runner-step-components',
        'runner-stl-viewer', 'stl-viewer-container',
        'runner-cli-section', 'runner-cli-content', 'btn-copy-cli',
        'runner-photo-gallery', 'btn-take-photo',
        'btn-step-prev', 'btn-step-next', 'runner-nav-label',
        // Completed
        'guide-completed', 'completed-sn', 'completed-guide-name',
        'completed-builder', 'completed-photo-count', 'completed-duration',
        'btn-back-to-guides',
        // Editing
        'guide-editing', 'editor-guide-list', 'editor-placeholder',
        'editor-form-area', 'editor-steps-list', 'editor-step-detail',
        'btn-new-guide', 'btn-add-step', 'btn-save-guide', 'btn-delete-guide',
        'btn-preview-guide',
        // Guide meta fields
        'ge-pid', 'ge-name', 'ge-difficulty', 'ge-drone-class', 'ge-time',
        'ge-thumbnail', 'ge-description', 'ge-tools', 'ge-drone-model',
        'ge-checklist-fields',
        // Step detail fields
        'se-order', 'se-title', 'se-type', 'se-time', 'se-description',
        'se-safety', 'se-stl', 'se-cli', 'se-components',
        // Sidebar session + guide list
        'guide-sidebar-info', 'sidebar-sn', 'sidebar-guide-name',
        'sidebar-step-progress', 'sidebar-progress-bar',
        'sidebar-guide-list-panel',
        // Mode toggle
        'btn-mode-browse', 'btn-mode-edit', 'guide-mode-toggle',
        // Settings
        'btn-guide-settings', 'guide-settings-panel', 'btn-close-settings',
        'setting-photo-quality', 'setting-auto-advance', 'setting-safety-warnings',
        // Timer
        'runner-step-timer', 'timer-build-elapsed', 'timer-step-elapsed',
        'timer-build-value', 'timer-step-value', 'timer-estimate-value',
        'runner-time-estimate',
        // Step notes
        'runner-step-notes', 'notes-save-status',
        // Camera
        'camera-modal', 'camera-video', 'camera-canvas', 'camera-preview',
        'btn-close-camera', 'btn-camera-file', 'camera-file-input',
        'btn-camera-capture', 'btn-camera-accept', 'btn-camera-retake',
    ];
    ids.forEach(id => {
        guideDOM[id] = document.getElementById(id);
    });
}

// Phase management — show only the active phase div
function setGuidePhase(phase) {
    guideState.phase = phase;
    ['guide-selection', 'guide-overview', 'guide-running', 'guide-completed', 'guide-editing'].forEach(id => {
        const el = guideDOM[id];
        if (el) el.classList.toggle('hidden', id !== `guide-${phase}`);
    });
    // Hide loader
    if (guideDOM['guide-loader']) guideDOM['guide-loader'].classList.add('hidden');

    // Update page title
    const titles = {
        selection: 'Build Guides',
        overview: 'Build Overview',
        running: 'Build in Progress',
        completed: 'Build Complete',
        editing: 'Guide Editor',
    };
    if (guideDOM['guide-page-title']) guideDOM['guide-page-title'].textContent = titles[phase] || 'Build Guides';

    // Show/hide sidebar session panel
    const showSession = phase === 'running';
    if (guideDOM['guide-sidebar-info']) guideDOM['guide-sidebar-info'].style.display = showSession ? '' : 'none';
}

// API helpers
const GUIDE_API = {
    guides: '/api/build-guides/',
    guideDetail: (pid) => `/api/build-guides/${pid}/`,
    sessions: '/api/build-sessions/',
    sessionDetail: (sn) => `/api/build-sessions/${sn}/`,
    sessionPhotos: (sn) => `/api/build-sessions/${sn}/photos/`,
    sessionEvents: (sn) => `/api/build-sessions/${sn}/events/`,
    componentsByPids: (pids) => `/api/components/?pids=${pids.join(',')}`,
    droneModels: '/api/drone-models/',
    droneModelDetail: (pid) => `/api/drone-models/${pid}/`,
};

async function apiFetch(url, options = {}) {
    const defaults = { headers: { 'Content-Type': 'application/json' } };
    if (options.body instanceof FormData) {
        // Don't set Content-Type for FormData — browser sets boundary
        delete defaults.headers['Content-Type'];
    }
    const res = await fetch(url, { ...defaults, ...options });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${res.status}: ${text}`);
    }
    return res.json();
}

// ── Component Resolution ──────────────────────────────────

/**
 * Batch-resolve component PIDs to full component objects.
 * Results cached in guideState.resolvedComponents.
 * Missing/deleted PIDs are set to null to prevent re-fetching.
 */
async function resolveComponents(pidList) {
    if (!pidList || !pidList.length) return guideState.resolvedComponents;

    // Deduplicate and filter already-cached
    const uncached = [...new Set(pidList)].filter(
        pid => !(pid in guideState.resolvedComponents)
    );

    if (uncached.length === 0) return guideState.resolvedComponents;

    try {
        const components = await apiFetch(GUIDE_API.componentsByPids(uncached));
        components.forEach(comp => {
            guideState.resolvedComponents[comp.pid] = comp;
        });
        // Mark PIDs not found as null (deleted/invalid)
        uncached.forEach(pid => {
            if (!guideState.resolvedComponents[pid]) {
                guideState.resolvedComponents[pid] = null;
            }
        });
    } catch (err) {
        console.warn('Component resolution failed:', err);
        uncached.forEach(pid => {
            guideState.resolvedComponents[pid] = null;
        });
    }

    return guideState.resolvedComponents;
}

/**
 * Collect all unique component PIDs from a guide's steps and linked drone model.
 */
function collectGuidePids(guide) {
    const pids = new Set();

    // From step required_components
    (guide.steps || []).forEach(step => {
        (step.required_components || []).forEach(pid => pids.add(pid));
    });

    // From linked drone_model relations
    if (guide.drone_model?.relations) {
        Object.values(guide.drone_model.relations).forEach(pid => {
            if (pid) pids.add(pid);
        });
    }

    return [...pids];
}

/**
 * Extract contextual assembly tips from a component's schema_data.
 * Returns [{ label, value, icon }] — up to ~10 possible tips.
 */
function extractComponentTips(component) {
    if (!component?.schema_data) return [];
    const sd = component.schema_data;
    const compat = sd.compatibility || {};
    const tips = [];

    // Weight
    const weight = sd.weight_g || sd.weight;
    if (weight) tips.push({ label: 'Weight', value: `${weight}g`, icon: 'ph-scales' });

    // Mounting pattern
    const mount = sd.mounting_pattern_mm || compat.mounting_pattern_mm;
    if (mount) tips.push({ label: 'Mount', value: `${mount}mm`, icon: 'ph-dots-nine' });

    // Bolt size
    const bolt = sd.motor_mount_bolt_size || sd.mounting_hole_size || compat.mounting_hole_size || compat.motor_mount_bolt_size;
    if (bolt) tips.push({ label: 'Bolt', value: bolt, icon: 'ph-nut' });

    // Voltage range
    const vMin = sd.voltage_min_v || compat.voltage_min_v;
    const vMax = sd.voltage_max_v || compat.voltage_max_v;
    if (vMin && vMax) tips.push({ label: 'Voltage', value: `${vMin}–${vMax}V`, icon: 'ph-lightning' });

    // Cell count
    const cMin = sd.cell_count_min || compat.cell_count_min;
    const cMax = sd.cell_count_max || compat.cell_count_max;
    if (cMin && cMax) tips.push({ label: 'Cells', value: `${cMin}–${cMax}S`, icon: 'ph-battery-full' });

    // KV rating (motors)
    if (sd.kv_rating) tips.push({ label: 'KV', value: `${sd.kv_rating}`, icon: 'ph-gauge' });

    // Connector type
    const connector = sd.motor_connector || sd.connector || compat.battery_connector || compat.connector_type;
    if (connector) tips.push({ label: 'Connector', value: String(connector).replace(/_/g, ' '), icon: 'ph-plug' });

    // Motor mount spacing
    const spacing = sd.motor_mount_hole_spacing_mm || compat.motor_mount_hole_spacing_mm;
    if (spacing) tips.push({ label: 'Motor Mount', value: `${spacing}mm`, icon: 'ph-arrows-out-cardinal' });

    // MCU (for FCs/stacks)
    const mcu = sd.mcu || (sd.fc && sd.fc.mcu);
    if (mcu) tips.push({ label: 'MCU', value: mcu, icon: 'ph-cpu' });

    // Prop size
    const propSize = sd.diameter_in || sd.prop_size_in;
    if (propSize) tips.push({ label: 'Size', value: `${propSize}"`, icon: 'ph-fan' });

    // Continuous current (ESCs)
    if (sd.continuous_current_per_motor_a) tips.push({ label: 'Current', value: `${sd.continuous_current_per_motor_a}A`, icon: 'ph-lightning' });

    return tips;
}

/**
 * Parse price string to numeric value. Returns NaN if unparseable.
 */
function guideParsePriceNum(priceStr) {
    if (!priceStr) return NaN;
    const match = String(priceStr).match(/[\d.]+/);
    return match ? parseFloat(match[0]) : NaN;
}

/**
 * Format category slug to human-readable display name.
 */
function formatCategoryName(slug) {
    if (!slug || slug === 'unknown') return 'Other Components';
    return slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Get image URL for a component, handling relative/absolute paths.
 */
function compImageUrl(comp) {
    if (!comp?.image_file) return '';
    return comp.image_file.startsWith('http') ? comp.image_file : `/static/${comp.image_file}`;
}

// ── Checklist Display Fields ─────────────────────────────

const CHECKLIST_FIELD_OPTIONS = [
    { key: 'manufacturer', label: 'Manufacturer', icon: 'ph-factory' },
    { key: 'price',        label: 'Price',        icon: 'ph-currency-dollar' },
    { key: 'weight',       label: 'Weight',       icon: 'ph-scales' },
    { key: 'mounting',     label: 'Mount Pattern', icon: 'ph-dots-nine' },
    { key: 'bolt_size',    label: 'Bolt Size',    icon: 'ph-nut' },
    { key: 'voltage',      label: 'Voltage',      icon: 'ph-lightning' },
    { key: 'cells',        label: 'Cell Count',   icon: 'ph-battery-full' },
    { key: 'kv',           label: 'KV Rating',    icon: 'ph-gauge' },
    { key: 'connector',    label: 'Connector',    icon: 'ph-plug' },
    { key: 'mcu',          label: 'MCU',          icon: 'ph-cpu' },
    { key: 'prop_size',    label: 'Prop Size',    icon: 'ph-fan' },
    { key: 'current',      label: 'Current',      icon: 'ph-lightning' },
    { key: 'step_reference', label: 'Step Usage', icon: 'ph-list-numbers' },
];

const DEFAULT_CHECKLIST_FIELDS = ['manufacturer', 'weight', 'step_reference'];

/**
 * Resolve a single checklist field value for a component.
 * Returns { label, value, icon } or null if no data.
 * @param {string} fieldKey - one of CHECKLIST_FIELD_OPTIONS keys
 * @param {object} comp - resolved component object
 * @param {object} extras - { stepMapping: { pid: [stepOrders] } }
 */
function resolveChecklistFieldValue(fieldKey, comp, extras) {
    if (!comp && fieldKey !== 'step_reference') return null;
    const sd = comp?.schema_data || {};
    const compat = sd.compatibility || {};
    const opt = CHECKLIST_FIELD_OPTIONS.find(o => o.key === fieldKey);
    if (!opt) return null;

    let value = null;

    switch (fieldKey) {
        case 'manufacturer':
            value = comp.manufacturer;
            break;
        case 'price':
            value = comp.approx_price;
            break;
        case 'weight': {
            const w = sd.weight_g || sd.weight;
            if (w) value = `${w}g`;
            break;
        }
        case 'mounting': {
            const m = sd.mounting_pattern_mm || compat.mounting_pattern_mm;
            if (m) value = `${m}mm`;
            break;
        }
        case 'bolt_size': {
            const b = sd.motor_mount_bolt_size || sd.mounting_hole_size || compat.mounting_hole_size || compat.motor_mount_bolt_size;
            if (b) value = b;
            break;
        }
        case 'voltage': {
            const vMin = sd.voltage_min_v || compat.voltage_min_v;
            const vMax = sd.voltage_max_v || compat.voltage_max_v;
            if (vMin && vMax) value = `${vMin}–${vMax}V`;
            break;
        }
        case 'cells': {
            const cMin = sd.cell_count_min || compat.cell_count_min;
            const cMax = sd.cell_count_max || compat.cell_count_max;
            if (cMin && cMax) value = `${cMin}–${cMax}S`;
            break;
        }
        case 'kv':
            if (sd.kv_rating) value = `${sd.kv_rating} KV`;
            break;
        case 'connector': {
            const c = sd.motor_connector || sd.connector || compat.battery_connector || compat.connector_type;
            if (c) value = String(c).replace(/_/g, ' ');
            break;
        }
        case 'mcu': {
            const m = sd.mcu || (sd.fc && sd.fc.mcu);
            if (m) value = m;
            break;
        }
        case 'prop_size': {
            const p = sd.diameter_in || sd.prop_size_in;
            if (p) value = `${p}"`;
            break;
        }
        case 'current':
            if (sd.continuous_current_per_motor_a) value = `${sd.continuous_current_per_motor_a}A`;
            break;
        case 'step_reference': {
            const steps = extras?.stepMapping?.[comp?.pid];
            if (steps?.length) value = `Step${steps.length > 1 ? 's' : ''} ${steps.join(', ')}`;
            break;
        }
    }

    if (!value) return null;
    return { label: opt.label, value: String(value), icon: opt.icon };
}

// ── Audit Event Queue ────────────────────────────────────
// Fire-and-forget event logging for immutable build audit trail.

const _auditEventQueue = [];
let _auditFlushTimer = null;

/**
 * Queue an audit event. Events are batched (500ms debounce) and sent
 * to the server without blocking the UI.
 */
function emitBuildEvent(eventType, stepOrder, data = {}) {
    if (!guideState.session) return;
    _auditEventQueue.push({ event_type: eventType, step_order: stepOrder, data });
    clearTimeout(_auditFlushTimer);
    _auditFlushTimer = setTimeout(flushEventQueue, 500);
}

/**
 * Flush all queued events to the server. Call directly on session completion
 * or page unload to ensure nothing is lost.
 */
async function flushEventQueue() {
    if (!guideState.session || _auditEventQueue.length === 0) return;
    const sn = guideState.session.serial_number;
    const batch = _auditEventQueue.splice(0, _auditEventQueue.length);

    for (const evt of batch) {
        apiFetch(GUIDE_API.sessionEvents(sn), {
            method: 'POST',
            body: JSON.stringify(evt),
        }).catch(err => console.warn('Audit event log failed:', err));
    }
}

// Flush events on page close via sendBeacon (fire-and-forget)
window.addEventListener('beforeunload', () => {
    if (!guideState.session || _auditEventQueue.length === 0) return;
    const sn = guideState.session.serial_number;
    const batch = _auditEventQueue.splice(0, _auditEventQueue.length);
    for (const evt of batch) {
        const blob = new Blob([JSON.stringify(evt)], { type: 'application/json' });
        navigator.sendBeacon(GUIDE_API.sessionEvents(sn), blob);
    }
});
