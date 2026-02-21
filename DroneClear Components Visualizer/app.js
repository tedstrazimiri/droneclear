// =============================================================
// app.js — Entry point: init and event wiring
// =============================================================

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

    // Component modal
    elements.modalCloseBtn.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => { if (e.target === elements.modal) closeModal(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !elements.modal.classList.contains('hidden')) closeModal();
    });

    // Add to build from modal
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

    // Wizard controls
    elements.btnStartWizard?.addEventListener('click', startWizard);
    elements.wizardSkipBtn?.addEventListener('click', wizardNextStep);
    elements.wizardNextBtn?.addEventListener('click', wizardNextStep);
    elements.wizardExitBtn?.addEventListener('click', exitWizard);

    // Global Help modal
    const btnGlobalHelp = document.getElementById('btn-global-help');
    const helpModal     = document.getElementById('help-modal');
    const helpCloseBtn  = document.getElementById('help-close-btn');
    btnGlobalHelp?.addEventListener('click', () => helpModal?.classList.remove('hidden'));
    helpCloseBtn?.addEventListener('click',  () => helpModal?.classList.add('hidden'));
    helpModal?.addEventListener('click', (e) => { if (e.target === helpModal) helpModal.classList.add('hidden'); });

    // Language toggles
    document.getElementById('btn-lang-en')?.addEventListener('click', () => updateLanguage('en'));
    document.getElementById('btn-lang-fr')?.addEventListener('click', () => updateLanguage('fr'));

    // Filter, sort & view toggle
    setupFilterListeners();
}
