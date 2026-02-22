// =============================================================
// app.js — Entry point: init and event wiring
// =============================================================

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    initDarkMode();
    setupEventListeners();
    initBuildDrawer();
    injectShortcutsOverlay();
    initShortcuts();
    await fetchMasterSchema();
    await fetchAllCategories();
}

async function fetchMasterSchema() {
    try {
        const res = await fetch('/api/schema/');
        if (!res.ok) throw new Error("Could not load schema from API.");
        const data = await res.json();
        schemaTemplate = data.components;
    } catch (e) {
        console.error("Failed to fetch master schema.", e);
    }
}

function setupEventListeners() {
    elements.fileUpload?.addEventListener('change', handleFileUpload);
    elements.searchInput.addEventListener('input', handleSearch);

    // Global Escape key — close topmost open modal / drawer
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const helpModal = document.getElementById('help-modal');
        if (!elements.saveBuildModal?.classList.contains('hidden')) { closeSaveBuildModal(); return; }
        if (!elements.loadBuildModal?.classList.contains('hidden')) { closeLoadBuildModal(); return; }
        if (!helpModal?.classList.contains('hidden')) { helpModal.classList.add('hidden'); return; }
        if (!elements.modal?.classList.contains('hidden')) { closeModal(); return; }
        if (!elements.buildDrawer?.classList.contains('closed')) { closeBuildDrawer(); return; }
    });

    // Component modal
    elements.modalCloseBtn.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => { if (e.target === elements.modal) closeModal(); });

    // Add to build from modal
    elements.modalAddBtn.addEventListener('click', () => {
        if (!activeModalComponent) return;

        const existingComp = currentBuild[currentCategory];
        if (existingComp && existingComp.pid !== activeModalComponent.pid) {
            // Tier 3: Inline Replacement Confirmation
            const footer = document.getElementById('modal-footer-actions');
            let confirmBar = document.getElementById('modal-replace-confirm');

            // Generate short readable name
            let shortName = existingComp.name || 'Component';
            if (shortName.length > 25) shortName = shortName.substring(0, 25) + '...';

            if (!confirmBar) {
                confirmBar = document.createElement('div');
                confirmBar.id = 'modal-replace-confirm';
                confirmBar.style.cssText = "display:flex; align-items:center; gap:8px; margin-right:auto; background:rgba(218, 41, 28, 0.1); padding:6px 12px; border-radius:var(--radius-sm); border:1px solid rgba(218, 41, 28, 0.2);";
                confirmBar.innerHTML = `
                    <span style="font-size:12px; color:var(--accent-red); font-weight:600;"><i class="ph ph-warning"></i> Replace ${shortName}?</span>
                    <button type="button" class="btn btn-primary" id="modal-replace-yes" style="padding:4px 10px; font-size:12px;">Yes</button>
                    <button type="button" class="btn btn-outline" id="modal-replace-no" style="padding:4px 10px; font-size:12px;">No</button>
                `;
                footer.insertBefore(confirmBar, elements.modalAddBtn);

                document.getElementById('modal-replace-no').onclick = () => {
                    confirmBar.style.display = 'none';
                    elements.modalAddBtn.style.display = 'inline-flex';
                };

                document.getElementById('modal-replace-yes').onclick = () => {
                    confirmBar.style.display = 'none';
                    elements.modalAddBtn.style.display = 'inline-flex';
                    processAdd(activeModalComponent);
                };
            } else {
                confirmBar.querySelector('span').innerHTML = `<i class="ph ph-warning"></i> Replace ${shortName}?`;
                confirmBar.style.display = 'flex';
            }

            elements.modalAddBtn.style.display = 'none';
        } else {
            processAdd(activeModalComponent);
        }

        function processAdd(comp) {
            addToBuild(comp);
            closeModal();
            triggerRerender();
            if (!wizardActive) {
                openBuildDrawer();
            } else {
                wizardNextStep();
            }
        }
    });

    // Wizard controls
    elements.btnStartWizard?.addEventListener('click', startWizard);
    elements.wizardSkipBtn?.addEventListener('click', wizardNextStep);
    elements.wizardNextBtn?.addEventListener('click', wizardNextStep);
    elements.wizardExitBtn?.addEventListener('click', exitWizard);

    // Global Help modal
    const btnGlobalHelp = document.getElementById('btn-global-help');
    const helpModal = document.getElementById('help-modal');
    const helpCloseBtn = document.getElementById('help-close-btn');
    btnGlobalHelp?.addEventListener('click', () => helpModal?.classList.remove('hidden'));
    helpCloseBtn?.addEventListener('click', () => helpModal?.classList.add('hidden'));
    helpModal?.addEventListener('click', (e) => { if (e.target === helpModal) helpModal.classList.add('hidden'); });

    // Language toggles
    document.getElementById('btn-lang-en')?.addEventListener('click', () => updateLanguage('en'));
    document.getElementById('btn-lang-fr')?.addEventListener('click', () => updateLanguage('fr'));

    // Filter, sort & view toggle
    setupFilterListeners();

    // Dark mode toggle
    elements.darkModeToggle?.addEventListener('click', toggleDarkMode);

    // Keyboard shortcuts help button
    document.getElementById('shortcuts-help-btn')?.addEventListener('click', toggleShortcutsOverlay);
}

// =============================================================
// Dark Mode
// =============================================================

function initDarkMode() {
    // Respect saved preference, then OS preference
    const saved = localStorage.getItem('dc-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    applyTheme(isDark);
}

function toggleDarkMode() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyTheme(!isDark);
    localStorage.setItem('dc-theme', !isDark ? 'dark' : 'light');
}

function applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (elements.darkModeIcon) {
        elements.darkModeIcon.className = dark ? 'ph ph-sun' : 'ph ph-moon';
    }
    if (elements.darkModeToggle) {
        elements.darkModeToggle.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
        elements.darkModeToggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }
}
