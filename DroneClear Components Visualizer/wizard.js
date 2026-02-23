// =============================================================
// wizard.js — Guided step-by-step Build Wizard engine
// =============================================================

// --- Drone Class Definitions ---
const DRONE_CLASSES = [
    { id: 'micro',  label: 'Tiny Whoop / Micro',    sub: '1-2" props',     icon: 'ph-bug',          propMax: 2.5,  wbMin: 0,   wbMax: 100  },
    { id: '3inch',  label: '3" Build',               sub: '2.5-3.5" props', icon: 'ph-drone',         propMax: 3.5,  wbMin: 100, wbMax: 150  },
    { id: '5inch',  label: '5" Freestyle / Racing',  sub: '4-5.5" props',   icon: 'ph-rocket-launch', propMax: 5.5,  wbMin: 150, wbMax: 250  },
    { id: '7inch',  label: '7" Long Range / Cine',   sub: '6-8" props',     icon: 'ph-airplane-tilt', propMax: 8,    wbMin: 250, wbMax: 400  },
    { id: 'heavy',  label: 'X-Class / Cinelifter',   sub: '10"+ props',     icon: 'ph-shield-star',   propMax: 99,   wbMin: 400, wbMax: 9999 },
    { id: 'all',    label: 'Show All Frames',         sub: 'No size filter', icon: 'ph-squares-four',  propMax: 99,   wbMin: 0,   wbMax: 9999 }
];

// --- Frame Class Inference ---
function inferFrameClass(comp) {
    // 1. Check prop_size_max_in from compatibility data
    const propMax = parseFloat(comp.schema_data?.compatibility?.prop_size_max_in);
    if (propMax) {
        if (propMax <= 2.5) return 'micro';
        if (propMax <= 3.5) return '3inch';
        if (propMax <= 5.5) return '5inch';
        if (propMax <= 8)   return '7inch';
        return 'heavy';
    }

    // 2. Check wheelbase_mm
    const wb = parseFloat(comp.schema_data?.wheelbase_mm || comp.schema_data?.compatibility?.wheelbase_mm);
    if (wb) {
        if (wb <= 100)  return 'micro';
        if (wb <= 150)  return '3inch';
        if (wb <= 250)  return '5inch';
        if (wb <= 400)  return '7inch';
        return 'heavy';
    }

    // 3. Parse name for size patterns
    const name = (comp.name || '').toLowerCase();

    // Match patterns like: 5", 5-inch, 5 inch, 5in
    const inchMatch = name.match(/\b(\d+(?:\.\d+)?)\s*(?:"|''|inch|in)\b/);
    if (inchMatch) {
        const size = parseFloat(inchMatch[1]);
        if (size <= 2.5) return 'micro';
        if (size <= 3.5) return '3inch';
        if (size <= 5.5) return '5inch';
        if (size <= 8)   return '7inch';
        return 'heavy';
    }

    // Match mm-based micro names: 65mm, 75mm, 85mm
    const mmMatch = name.match(/\b(\d{2,3})mm\b/);
    if (mmMatch) {
        const mm = parseInt(mmMatch[1]);
        if (mm <= 100)  return 'micro';
        if (mm <= 150)  return '3inch';
        if (mm <= 250)  return '5inch';
        if (mm <= 400)  return '7inch';
        return 'heavy';
    }

    // Common keywords
    if (/whoop|tiny|micro|1s|65mm|75mm/.test(name)) return 'micro';
    if (/toothpick|3\s*inch|cinewhoop/.test(name)) return '3inch';
    if (/freestyle|racing|5\s*inch|nazgul/.test(name)) return '5inch';
    if (/long\s*range|lr|7\s*inch|cine/.test(name)) return '7inch';
    if (/x-class|cinelifter|10\s*inch|heavy/.test(name)) return 'heavy';

    return 'unknown'; // Show in all classes
}

function frameMatchesClass(comp, droneClass) {
    if (droneClass === 'all') return true;
    const inferred = inferFrameClass(comp);
    return inferred === droneClass || inferred === 'unknown';
}

// --- Wizard Entry ---
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
    wizardDroneClass = null;

    for (let key in currentBuild) currentBuild[key] = null;
    renderBuildSlots();
    updateBuildTotals();
    updateBuildBadge();
    validateBuild();

    // Close the drawer if open — wizard works in the main grid now
    if (!elements.buildDrawer.classList.contains('closed')) {
        elements.buildOverlay.classList.add('hidden');
        elements.buildDrawer.classList.add('closed');
    }

    // Lock sidebar navigation
    elements.categoryNav.classList.add('wizard-locked');

    // Show class selector as Step 0 instead of jumping to frames
    showClassSelector();
}

// --- Drone Class Selection (Step 0) ---
function showClassSelector() {
    // Show a minimal banner indicating Step 0
    if (elements.wizardBanner) {
        elements.wizardBannerStep.textContent = 'GETTING STARTED';
        elements.wizardBannerPrompt.textContent = 'What size drone are you building?';
        elements.wizardBannerProgress.innerHTML = '';
        elements.wizardBannerSelection.innerHTML = '';
        elements.wizardBanner.classList.remove('hidden');
    }

    // Hide filter toolbar during class selection
    elements.filterToolbar?.classList.add('hidden');

    // Render class cards into the grid area
    elements.componentsGrid.classList.remove('hidden');
    elements.componentsGrid.innerHTML = '';

    const selectorContainer = document.createElement('div');
    selectorContainer.className = 'wizard-class-selector';

    const heading = document.createElement('div');
    heading.className = 'wizard-class-heading';
    heading.innerHTML = `
        <i class="ph ph-rocket-launch"></i>
        <div>
            <h2>Choose Your Drone Class</h2>
            <p>This narrows frames to the right size and guides compatible part selection throughout the build.</p>
        </div>
    `;
    selectorContainer.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'wizard-class-grid';

    DRONE_CLASSES.forEach(cls => {
        const card = document.createElement('button');
        card.className = 'wizard-class-option';
        if (cls.id === 'all') card.classList.add('wizard-class-option--muted');

        card.innerHTML = `
            <i class="ph ${cls.icon}"></i>
            <span class="wizard-class-label">${cls.label}</span>
            <span class="wizard-class-sub">${cls.sub}</span>
        `;

        card.addEventListener('click', () => {
            wizardDroneClass = cls.id;
            // Restore filter toolbar
            elements.filterToolbar?.classList.remove('hidden');
            // Proceed to step 1 (frames)
            loadWizardStep();
        });

        grid.appendChild(card);
    });

    selectorContainer.appendChild(grid);
    elements.componentsGrid.appendChild(selectorContainer);

    // Update the category title
    elements.currentCategoryTitle.textContent = 'Build Wizard';
}

// --- Step Loading ---
async function loadWizardStep() {
    // Skip steps intelligently based on stack selection
    while (wizardCurrentStep < wizardSequence.length) {
        const step = wizardSequence[wizardCurrentStep];

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

    // Render the persistent banner
    renderWizardBanner();

    // Navigate to the correct category (bypass the wizard guard)
    const step = wizardSequence[wizardCurrentStep];
    await selectCategory(step.cat, true);
}

function renderWizardBanner() {
    if (!elements.wizardBanner) return;

    const step = wizardSequence[wizardCurrentStep];
    const totalSteps = wizardSequence.length;

    // Update step counter and prompt
    elements.wizardBannerStep.textContent = `Step ${wizardCurrentStep + 1} of ${totalSteps}`;
    elements.wizardBannerPrompt.textContent = step.prompt;

    // Render labeled step chips
    const progressContainer = elements.wizardBannerProgress;
    progressContainer.innerHTML = '';

    wizardSequence.forEach((s, i) => {
        const chip = document.createElement('div');
        chip.className = 'wizard-step-chip';

        // Short label for the chip
        const shortName = s.name.replace(' (Optional)', '');
        const isOptional = s.name.includes('Optional');
        const stepNum = i + 1;

        if (i < wizardCurrentStep) {
            if (currentBuild[s.cat] === null) {
                chip.classList.add('skipped');
                chip.innerHTML = `<span class="wsc-num">${stepNum}</span><span class="wsc-label">${shortName}</span>`;
            } else {
                chip.classList.add('completed');
                chip.innerHTML = `<i class="ph-fill ph-check-circle wsc-icon"></i><span class="wsc-label">${shortName}</span>`;
            }
        } else if (i === wizardCurrentStep) {
            chip.classList.add('current');
            chip.innerHTML = `<span class="wsc-num">${stepNum}</span><span class="wsc-label">${shortName}</span>`;
        } else {
            chip.innerHTML = `<span class="wsc-num">${stepNum}</span><span class="wsc-label">${shortName}</span>`;
            if (isOptional) chip.classList.add('optional');
        }

        progressContainer.appendChild(chip);
    });

    // Show selected component for current step (if any)
    const currentComp = currentBuild[step.cat];
    if (currentComp) {
        elements.wizardBannerSelection.innerHTML =
            `<i class="ph-fill ph-check-circle"></i> ${currentComp.name}`;
    } else {
        elements.wizardBannerSelection.innerHTML = '';
    }

    // Show the banner
    elements.wizardBanner.classList.remove('hidden');
}

async function wizardNextStep() {
    wizardCurrentStep++;
    await loadWizardStep();
}

function exitWizard(completed = false) {
    wizardActive = false;
    wizardDroneClass = null;

    // Hide the wizard banner
    elements.wizardBanner?.classList.add('hidden');

    // Also hide the old header in case it's visible
    elements.wizardHeader?.classList.add('hidden');

    // Restore filter toolbar visibility
    elements.filterToolbar?.classList.remove('hidden');

    // Unlock sidebar navigation
    elements.categoryNav.classList.remove('wizard-locked');

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
