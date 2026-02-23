// =============================================================
// wizard.js — Guided step-by-step Build Wizard engine
// =============================================================

async function startWizard() {
    if (wizardActive) return;

    // Confirm before clearing if build has components
    const hasComponents = Object.values(currentBuild).some(v => v !== null);
    if (hasComponents) {
        const confirmed = confirm('Starting the wizard will clear your current build. Continue?');
        if (!confirmed) return;
    }

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
    // Skip steps intelligently based on stack selection
    while (wizardCurrentStep < wizardSequence.length) {
        const step = wizardSequence[wizardCurrentStep];

        // If a stack is selected, skip the standalone FC and ESC steps
        if (currentBuild.stacks) {
            if (step.cat === 'flight_controllers') {
                showToast('Skipping FC — included in stack', 'info');
                wizardCurrentStep++;
                continue;
            }
            if (step.cat === 'escs') {
                showToast('Skipping ESC — included in stack', 'info');
                wizardCurrentStep++;
                continue;
            }
        }

        break;
    }

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
