// =============================================================
// wizard.js — Guided step-by-step Build Wizard engine
// =============================================================

async function startWizard() {
    if (wizardActive) return;
    wizardActive = true;
    wizardCurrentStep = 0;

    for (let key in currentBuild) currentBuild[key] = null;
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
    elements.wizardStepCounter.textContent = `Step ${wizardCurrentStep + 1} of ${wizardSequence.length}`;
    elements.wizardPrompt.textContent = step.prompt;

    if (wizardCurrentStep < wizardSequence.length - 1) {
        elements.wizardNextBtn.textContent = `Next: ${wizardSequence[wizardCurrentStep + 1].name}`;
    } else {
        elements.wizardNextBtn.textContent = 'Finish Build';
    }

    await selectCategory(step.cat);

    openBuildDrawer();
}

async function wizardNextStep() {
    wizardCurrentStep++;
    await loadWizardStep();
}

function exitWizard(completed = false) {
    wizardActive = false;
    elements.wizardHeader?.classList.add('hidden');
    if (completed) {
        openBuildDrawer();
        showWizardCompleteBanner();
    }
}

function showWizardCompleteBanner() {
    const banner = document.getElementById('wizard-complete-banner');
    const summary = document.getElementById('wizard-complete-summary');
    if (!banner) return;

    const count = Object.values(currentBuild).filter(c => c !== null).length;
    const totalCostEl = elements.totalCostEl?.textContent || '$0.00';
    const totalWeightEl = elements.totalWeightEl?.textContent || '0g';
    if (summary) {
        summary.textContent = `${count} component${count !== 1 ? 's' : ''} selected · ${totalWeightEl} · ${totalCostEl}`;
    }

    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 5000);
}
