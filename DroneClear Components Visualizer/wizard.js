// =============================================================
// wizard.js — Guided step-by-step Build Wizard engine
// =============================================================

async function startWizard() {
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
    setTimeout(() => {
        if (wizardActive && !elements.buildDrawer.classList.contains('closed')) {
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
    elements.wizardHeader?.classList.add('hidden');
    if (completed) openBuildDrawer();
}
