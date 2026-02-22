// =============================================================
// build.js — Build drawer, slots, totals, badge, validation
// =============================================================

function initBuildDrawer() {
    renderBuildSlots();
    updateBuildTotals();
    updateBuildBadge();

    elements.buildFab.addEventListener('click', openBuildDrawer);
    elements.drawerCloseBtn.addEventListener('click', closeBuildDrawer);
    elements.buildOverlay.addEventListener('click', closeBuildDrawer);

    const clearConfirmBar = document.getElementById('clear-confirm-bar');
    const clearConfirmYes = document.getElementById('clear-confirm-yes');
    const clearConfirmNo  = document.getElementById('clear-confirm-no');

    elements.clearBuildBtn?.addEventListener('click', () => {
        clearConfirmBar?.classList.remove('hidden');
        elements.clearBuildBtn.classList.add('hidden');
    });

    clearConfirmNo?.addEventListener('click', () => {
        clearConfirmBar?.classList.add('hidden');
        elements.clearBuildBtn.classList.remove('hidden');
    });

    clearConfirmYes?.addEventListener('click', () => {
        for (let key in currentBuild) currentBuild[key] = null;
        renderBuildSlots();
        updateBuildTotals();
        updateBuildBadge();
        validateBuild();
        clearConfirmBar?.classList.add('hidden');
        elements.clearBuildBtn.classList.remove('hidden');
        showToast('Build cleared.', 'info');
    });

    // Save / Load build buttons
    elements.saveBuildBtn?.addEventListener('click', openSaveBuildModal);
    elements.loadBuildBtn?.addEventListener('click', openLoadBuildModal);

    // Save modal controls
    elements.saveBuildCloseBtn?.addEventListener('click', closeSaveBuildModal);
    elements.saveBuildCancelBtn?.addEventListener('click', closeSaveBuildModal);
    elements.saveBuildModal?.addEventListener('click', (e) => { if (e.target === elements.saveBuildModal) closeSaveBuildModal(); });
    elements.saveBuildConfirmBtn?.addEventListener('click', confirmSaveBuild);
    elements.buildNameInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmSaveBuild(); });

    // Load modal controls
    elements.loadBuildCloseBtn?.addEventListener('click', closeLoadBuildModal);
    elements.loadBuildModal?.addEventListener('click', (e) => { if (e.target === elements.loadBuildModal) closeLoadBuildModal(); });
}

function openBuildDrawer() {
    if (wizardActive && elements.wizardHeader) {
        elements.wizardHeader.classList.remove('hidden');
    } else if (elements.wizardHeader) {
        elements.wizardHeader.classList.add('hidden');
    }
    elements.buildOverlay.classList.remove('hidden');
    elements.buildDrawer.classList.remove('closed');
}

function closeBuildDrawer() {
    elements.buildOverlay.classList.add('hidden');
    elements.buildDrawer.classList.add('closed');
    if (wizardActive) exitWizard(false);
}

function addToBuild(comp) {
    currentBuild[currentCategory] = comp;
    renderBuildSlots();
    updateBuildTotals();
    updateBuildBadge();
    validateBuild();
}

function removeFromBuild(category) {
    currentBuild[category] = null;
    renderBuildSlots();
    updateBuildTotals();
    updateBuildBadge();
    validateBuild();
}

function renderBuildSlots() {
    elements.buildSlots.innerHTML = '';
    const prioritySlots = ['frames', 'flight_controllers', 'escs', 'motors', 'propellers', 'video_transmitters', 'fpv_cameras', 'receivers', 'antennas', 'batteries', 'action_cameras'];
    const allSlots = new Set([...prioritySlots, ...Object.keys(currentBuild)]);

    // Show CTA hint when build is empty
    const isEmpty = Object.values(currentBuild).every(v => v === null);
    if (isEmpty) {
        const hint = document.createElement('div');
        hint.className = 'build-empty-hint';
        hint.innerHTML = `
            <i class="ph ph-wrench" style="font-size:32px; opacity:0.3; display:block; margin-bottom:10px;"></i>
            <strong>Your build is empty</strong>
            <p>Browse a category on the left, open a component and click <b>Add to Build</b> — or use the <b>Build Wizard</b> for a guided flow.</p>
        `;
        elements.buildSlots.appendChild(hint);
    }

    allSlots.forEach(cat => {
        if (!currentBuild.hasOwnProperty(cat)) return;
        const comp = currentBuild[cat];
        const slotEl = document.createElement('div');
        slotEl.className = 'build-slot ' + (comp ? 'filled' : '');
        const catName = formatTitle(cat);

        if (comp) {
            const price  = comp.approx_price || 'N/A';
            const weight = comp.schema_data?.weight_g ? `${comp.schema_data.weight_g}g` : 'Unknown Weight';
            slotEl.innerHTML = `
                <span class="slot-label">${catName}</span>
                <div class="slot-content">
                    <div class="slot-details">
                        <h4>${comp.name}</h4>
                        <div class="slot-metrics">
                            <span style="color:var(--accent-blue);">${price}</span>
                            <span>${weight}</span>
                        </div>
                    </div>
                    <button class="slot-remove" onclick="removeFromBuild('${cat}')" title="Remove part">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>`;
        } else {
            slotEl.innerHTML = `<span class="slot-label">${catName}</span><span class="slot-empty-text">Empty Slot</span>`;
        }

        elements.buildSlots.appendChild(slotEl);
    });
}

function updateBuildTotals() {
    let totalWeight = 0;
    let totalCost   = 0;

    Object.values(currentBuild).forEach(comp => {
        if (!comp) return;
        const w = parseFloat(comp.schema_data?.weight_g);
        if (!isNaN(w)) totalWeight += w;

        if (comp.approx_price) {
            const match = comp.approx_price.match(/[\d.]+/);
            if (match) {
                const c = parseFloat(match[0]);
                if (!isNaN(c)) totalCost += c;
            }
        }
    });

    if (elements.totalWeightEl) elements.totalWeightEl.textContent = `${totalWeight.toFixed(1)}g`;
    if (elements.totalCostEl)   elements.totalCostEl.textContent   = `$${totalCost.toFixed(2)}`;
}

function updateBuildBadge() {
    const count = Object.values(currentBuild).filter(c => c !== null).length;
    if (elements.buildBadge) elements.buildBadge.textContent = count;
    if (count > 0 && elements.buildFab) {
        elements.buildFab.style.transform = 'scale(1.1)';
        setTimeout(() => elements.buildFab.style.transform = '', 200);
    }
}

// --- Constraint Validation ---
// Reads _compat_hard/_compat_soft from compatibility blocks to determine severity.
// Hard constraint violation = 'error', soft = 'warning'.
function getConstraintSeverity(comp, fieldName) {
    const compat = comp?.schema_data?.compatibility;
    if (!compat) return 'warning';
    if (compat._compat_hard?.includes(fieldName)) return 'error';
    if (compat._compat_soft?.includes(fieldName)) return 'warning';
    return 'warning';
}

function getBuildWarnings(buildState) {
    const warnings = [];
    const { frames: frame, propellers: props, flight_controllers: fc, motors, escs: esc, batteries: bat } = buildState;

    // 1. Propeller size vs frame max
    if (frame && props) {
        const frameMax = parseFloat(frame.schema_data?.compatibility?.prop_size_max_in);
        const propSize = parseFloat(props.schema_data?.diameter_in);
        if (frameMax && propSize && propSize > frameMax) {
            warnings.push({ type: getConstraintSeverity(frame, 'prop_size_max_in'), title: 'Propeller Size Exceeds Frame Limits', message: `The frame supports up to ${frameMax}" props, but you selected ${propSize}" propellers.` });
        }
    }

    // 2. FC mounting pattern vs frame
    if (frame && fc) {
        const frameMounts = frame.schema_data?.compatibility?.fc_mounting_patterns_mm || [];
        const fcMount = parseFloat(fc.schema_data?.mounting_pattern_mm);
        if (fcMount && frameMounts.length > 0 && !frameMounts.includes(fcMount)) {
            warnings.push({ type: getConstraintSeverity(frame, 'fc_mounting_patterns_mm'), title: 'Flight Controller Mount Mismatch', message: `The ${fcMount}mm FC will not bolt onto this frame, which only supports: ${frameMounts.join(', ')}mm.` });
        }
    }

    // 3. Motor mount pattern vs frame
    if (frame && motors) {
        const frameMotorSpacing = parseFloat(frame.schema_data?.compatibility?.motor_mount_hole_spacing_mm);
        const motorMount = parseFloat(motors.schema_data?.compatibility?.motor_mount_hole_spacing_mm);
        if (frameMotorSpacing && motorMount && frameMotorSpacing !== motorMount) {
            warnings.push({ type: getConstraintSeverity(frame, 'motor_mount_hole_spacing_mm'), title: 'Motor Mount Mismatch', message: `These motors use ${motorMount}mm spacing. The frame uses ${frameMotorSpacing}mm.` });
        }
    }

    // 4-5. Battery cell count vs motors and ESC
    if (bat) {
        const batCells = parseInt(bat.schema_data?.cell_count);
        if (batCells && motors) {
            const motorMax = parseInt(motors.schema_data?.compatibility?.cell_count_max);
            if (motorMax && batCells > motorMax) {
                warnings.push({ type: getConstraintSeverity(motors, 'cell_count_max'), title: 'Battery Voltage High for Motors', message: `These motors are rated for up to ${motorMax}S, but you chose a ${batCells}S battery.` });
            }
        }
        if (batCells && esc) {
            const escMax = parseInt(esc.schema_data?.compatibility?.cell_count_max);
            const escMin = parseInt(esc.schema_data?.compatibility?.cell_count_min);
            if (escMax && batCells > escMax) {
                warnings.push({ type: getConstraintSeverity(esc, 'cell_count_max'), title: 'ESC Overvoltage Risk', message: `The ESC max rating is ${escMax}S. A ${batCells}S battery will likely fry it.` });
            } else if (escMin && batCells < escMin) {
                warnings.push({ type: getConstraintSeverity(esc, 'cell_count_min'), title: 'Low Battery Voltage', message: `The ESC expects at least ${escMin}S. A ${batCells}S battery may not power it properly.` });
            }
        }
    }

    return warnings;
}

function validateBuild() {
    if (!elements.buildWarnings) return;
    elements.buildWarnings.innerHTML = '';
    getBuildWarnings(currentBuild).forEach(w => {
        const el = document.createElement('div');
        el.className = `build-warning ${w.type === 'error' ? 'error' : ''}`;
        el.innerHTML = `
            <i class="${w.type === 'error' ? 'ph-fill ph-warning-octagon' : 'ph-fill ph-warning'}"></i>
            <div class="build-warning-content">
                <strong>${w.title}</strong>
                <span>${w.message}</span>
            </div>`;
        elements.buildWarnings.appendChild(el);
    });
}
