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
        'runner-reference-image-wrap', 'runner-reference-image',
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
        'ge-thumbnail', 'ge-description', 'ge-tools',
        // Step detail fields
        'se-order', 'se-title', 'se-type', 'se-time', 'se-description',
        'se-safety', 'se-image', 'se-stl', 'se-cli', 'se-components',
        // Sidebar session
        'guide-sidebar-info', 'sidebar-sn', 'sidebar-guide-name',
        'sidebar-step-progress', 'sidebar-progress-bar',
        // Mode toggle
        'btn-mode-browse', 'btn-mode-edit', 'guide-mode-toggle',
        // Settings
        'btn-guide-settings', 'guide-settings-panel', 'btn-close-settings',
        'setting-photo-quality', 'setting-auto-advance', 'setting-safety-warnings',
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
