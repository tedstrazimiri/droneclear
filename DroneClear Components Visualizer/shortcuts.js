// =============================================================
// shortcuts.js — Global keyboard shortcut handling
// =============================================================

// Shortcut map: shown in the help overlay
const SHORTCUTS = [
    { keys: ['/', 'Ctrl+K'],   description: 'Focus search bar' },
    { keys: ['B'],             description: 'Open / close build drawer' },
    { keys: ['D'],             description: 'Toggle dark / light mode' },
    { keys: ['Esc'],           description: 'Close any open panel or modal' },
    { keys: ['?'],             description: 'Show / hide this keyboard shortcut help' },
];

function initShortcuts() {
    document.addEventListener('keydown', handleGlobalKeydown);
}

function handleGlobalKeydown(e) {
    // Never fire when the user is typing in an input/textarea/select
    const tag = document.activeElement?.tagName;
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
        || document.activeElement?.isContentEditable;

    // --- Shortcuts that work even while typing ---
    if (e.key === 'Escape') {
        handleEscape();
        return;
    }

    // --- Ctrl+K → focus search (works even while typing) ---
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        focusSearch();
        return;
    }

    // Everything below is blocked while the user is typing
    if (isTyping) return;

    switch (e.key) {
        case '/':
            e.preventDefault();
            focusSearch();
            break;

        case 'b':
        case 'B':
            toggleBuildDrawer();
            break;

        case 'd':
        case 'D':
            toggleDarkMode();
            break;

        case '?':
            toggleShortcutsOverlay();
            break;
    }
}

function handleEscape() {
    // Close in priority order: save modal → load modal → component modal → build drawer → shortcuts overlay
    const saveBuildModal = elements.saveBuildModal;
    const loadBuildModal = elements.loadBuildModal;
    const compModal      = elements.modal;
    const buildDrawer    = elements.buildDrawer;
    const shortcutsOverlay = document.getElementById('shortcuts-overlay');

    if (shortcutsOverlay && !shortcutsOverlay.classList.contains('hidden')) {
        shortcutsOverlay.classList.add('hidden');
    } else if (saveBuildModal && !saveBuildModal.classList.contains('hidden')) {
        closeSaveBuildModal();
    } else if (loadBuildModal && !loadBuildModal.classList.contains('hidden')) {
        closeLoadBuildModal();
    } else if (compModal && !compModal.classList.contains('hidden')) {
        closeModal();
    } else if (buildDrawer && buildDrawer.classList.contains('open')) {
        closeBuildDrawer();
    }
}

function focusSearch() {
    if (elements.searchInput) {
        elements.searchInput.focus();
        elements.searchInput.select();
    }
}

function toggleBuildDrawer() {
    if (elements.buildDrawer?.classList.contains('open')) {
        closeBuildDrawer();
    } else {
        openBuildDrawer();
    }
}

function toggleShortcutsOverlay() {
    const overlay = document.getElementById('shortcuts-overlay');
    if (!overlay) return;
    overlay.classList.toggle('hidden');
}

function buildShortcutsOverlayHTML() {
    const rows = SHORTCUTS.map(s => {
        const badges = s.keys.map(k =>
            `<kbd class="kbd-key">${k}</kbd>`
        ).join('<span class="kbd-or">or</span>');
        return `
            <div class="shortcut-row">
                <div class="shortcut-keys">${badges}</div>
                <div class="shortcut-desc">${s.description}</div>
            </div>`;
    }).join('');

    return `
    <div id="shortcuts-overlay" class="shortcuts-overlay hidden" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div class="shortcuts-panel">
            <div class="shortcuts-header">
                <span class="shortcuts-title"><i class="ph ph-keyboard"></i> Keyboard Shortcuts</span>
                <button class="shortcuts-close-btn" id="shortcuts-close-btn" aria-label="Close shortcuts">
                    <i class="ph ph-x"></i>
                </button>
            </div>
            <div class="shortcuts-body">
                ${rows}
            </div>
            <div class="shortcuts-footer">
                Press <kbd class="kbd-key">?</kbd> to toggle this panel
            </div>
        </div>
    </div>`;
}

function injectShortcutsOverlay() {
    if (document.getElementById('shortcuts-overlay')) return;
    document.body.insertAdjacentHTML('beforeend', buildShortcutsOverlayHTML());
    document.getElementById('shortcuts-close-btn')?.addEventListener('click', toggleShortcutsOverlay);
    document.getElementById('shortcuts-overlay')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('shortcuts-overlay')) toggleShortcutsOverlay();
    });
}
