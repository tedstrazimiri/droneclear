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
    const prioritySlots = ['frames', 'stacks', 'flight_controllers', 'escs', 'motors', 'propellers', 'video_transmitters', 'fpv_cameras', 'receivers', 'batteries', 'antennas', 'action_cameras'];
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
    const { frames: frame, propellers: props, flight_controllers: fc, motors, escs: esc, batteries: bat, video_transmitters: vtx, fpv_cameras: cam, stacks: stack } = buildState;

    // Helper: get effective FC and ESC (either standalone or from stack)
    const effectiveFc = fc || (stack ? { schema_data: { ...(stack.schema_data?.fc || {}), compatibility: stack.schema_data?.compatibility }, pid: stack.pid } : null);
    const effectiveEsc = esc || (stack ? { schema_data: { ...(stack.schema_data?.esc || {}), compatibility: stack.schema_data?.compatibility }, pid: stack.pid } : null);

    // 1. Propeller size vs frame max
    if (frame && props) {
        const frameMax = parseFloat(frame.schema_data?.compatibility?.prop_size_max_in);
        const propSize = parseFloat(props.schema_data?.diameter_in);
        if (frameMax && propSize && propSize > frameMax) {
            warnings.push({ type: getConstraintSeverity(frame, 'prop_size_max_in'), title: 'Propeller Size Exceeds Frame Limits', message: `The frame supports up to ${frameMax}" props, but you selected ${propSize}" propellers.` });
        }
    }

    // 2. FC mounting pattern vs frame
    if (frame && effectiveFc) {
        const frameMounts = frame.schema_data?.compatibility?.fc_mounting_patterns_mm || [];
        const fcMount = parseFloat(effectiveFc.schema_data?.mounting_pattern_mm || effectiveFc.schema_data?.compatibility?.mounting_pattern_mm);
        if (fcMount && frameMounts.length > 0 && !frameMounts.includes(fcMount)) {
            warnings.push({ type: getConstraintSeverity(frame, 'fc_mounting_patterns_mm'), title: 'Flight Controller Mount Mismatch', message: `The ${fcMount}mm FC will not bolt onto this frame, which only supports: ${frameMounts.join(', ')}mm.` });
        }
    }

    // 3. Motor mount spacing vs frame
    if (frame && motors) {
        const frameMotorSpacing = parseFloat(frame.schema_data?.compatibility?.motor_mount_hole_spacing_mm);
        const motorMount = parseFloat(motors.schema_data?.compatibility?.motor_mount_hole_spacing_mm);
        if (frameMotorSpacing && motorMount && frameMotorSpacing !== motorMount) {
            warnings.push({ type: getConstraintSeverity(frame, 'motor_mount_hole_spacing_mm'), title: 'Motor Mount Mismatch', message: `These motors use ${motorMount}mm spacing. The frame uses ${frameMotorSpacing}mm.` });
        }
    }

    // 4-5. Battery cell count vs motors and ESC
    if (bat) {
        const batCells = parseInt(bat.schema_data?.cell_count || bat.schema_data?.compatibility?.cell_count);
        if (batCells && motors) {
            const motorMax = parseInt(motors.schema_data?.compatibility?.cell_count_max);
            if (motorMax && batCells > motorMax) {
                warnings.push({ type: getConstraintSeverity(motors, 'cell_count_max'), title: 'Battery Voltage High for Motors', message: `These motors are rated for up to ${motorMax}S, but you chose a ${batCells}S battery.` });
            }
        }
        if (batCells && effectiveEsc) {
            const escMax = parseInt(effectiveEsc.schema_data?.compatibility?.cell_count_max);
            const escMin = parseInt(effectiveEsc.schema_data?.compatibility?.cell_count_min);
            if (escMax && batCells > escMax) {
                warnings.push({ type: getConstraintSeverity(effectiveEsc, 'cell_count_max'), title: 'ESC Overvoltage Risk', message: `The ESC max rating is ${escMax}S. A ${batCells}S battery will likely fry it.` });
            } else if (escMin && batCells < escMin) {
                warnings.push({ type: getConstraintSeverity(effectiveEsc, 'cell_count_min'), title: 'Low Battery Voltage', message: `The ESC expects at least ${escMin}S. A ${batCells}S battery may not power it properly.` });
            }
        }
    }

    // --- NEW CHECKS (B1-B7) ---

    // B1. FC mounting hole size vs frame (HARD)
    if (frame && effectiveFc) {
        const frameHoleSize = frame.schema_data?.fc_mounting_hole_size;
        const fcHoleSize = effectiveFc.schema_data?.compatibility?.mounting_hole_size || effectiveFc.schema_data?.mounting_hole_size;
        if (frameHoleSize && fcHoleSize && frameHoleSize !== fcHoleSize) {
            warnings.push({ type: getConstraintSeverity(frame, 'fc_mounting_hole_size'), title: 'FC Mounting Hole Size Mismatch', message: `The frame uses ${frameHoleSize} mounting holes, but the FC requires ${fcHoleSize}.` });
        }
    }

    // B2. Motor mount bolt size vs frame (HARD)
    if (frame && motors) {
        const frameBolt = frame.schema_data?.compatibility?.motor_mount_bolt_size;
        const motorBolt = motors.schema_data?.compatibility?.motor_mount_bolt_size;
        if (frameBolt && motorBolt && frameBolt !== motorBolt) {
            warnings.push({ type: getConstraintSeverity(frame, 'motor_mount_bolt_size'), title: 'Motor Bolt Size Mismatch', message: `The frame motor mounts use ${frameBolt} bolts, but these motors require ${motorBolt}.` });
        }
    }

    // B3. ESC mounting pattern vs frame (HARD — for standalone 4-in-1 ESCs)
    if (frame && effectiveEsc && !stack) {
        const frameMounts = frame.schema_data?.compatibility?.fc_mounting_patterns_mm || [];
        const escMount = parseFloat(effectiveEsc.schema_data?.compatibility?.mounting_pattern_mm || effectiveEsc.schema_data?.mounting_pattern_mm);
        if (escMount && frameMounts.length > 0 && !frameMounts.includes(escMount)) {
            warnings.push({ type: getConstraintSeverity(effectiveEsc, 'mounting_pattern_mm'), title: 'ESC Mounting Pattern Mismatch', message: `The ${escMount}mm ESC won't mount to this frame (supports: ${frameMounts.join(', ')}mm).` });
        }
    }

    // B4. Battery connector vs ESC connector (HARD)
    if (bat && effectiveEsc) {
        const batConnector = (bat.schema_data?.compatibility?.connector_type || bat.schema_data?.battery_connector || '').toString().toUpperCase();
        const escConnector = (effectiveEsc.schema_data?.compatibility?.battery_connector || effectiveEsc.schema_data?.input_connector || '').toString().toUpperCase();
        if (batConnector && escConnector && batConnector !== escConnector) {
            warnings.push({ type: 'error', title: 'Battery Connector Mismatch', message: `The battery uses a ${batConnector} connector, but the ESC expects ${escConnector}. You'll need an adapter.` });
        }
    }

    // B5. Battery voltage vs ESC voltage range (SOFT)
    if (bat && effectiveEsc) {
        const escVMin = parseFloat(effectiveEsc.schema_data?.compatibility?.voltage_min_v);
        const escVMax = parseFloat(effectiveEsc.schema_data?.compatibility?.voltage_max_v);
        const batVoltage = parseFloat(bat.schema_data?.compatibility?.voltage_max_v || bat.schema_data?.full_charge_voltage_v);
        if (escVMax && batVoltage && batVoltage > escVMax) {
            warnings.push({ type: 'warning', title: 'Battery Voltage Exceeds ESC Rating', message: `The battery peaks at ${batVoltage}V, but the ESC is rated for max ${escVMax}V.` });
        } else if (escVMin && batVoltage && batVoltage < escVMin) {
            warnings.push({ type: 'warning', title: 'Battery Voltage Below ESC Minimum', message: `The battery is ${batVoltage}V, but the ESC requires at least ${escVMin}V.` });
        }
    }

    // B6. Camera-VTX video system match (SOFT)
    if (vtx && cam) {
        const vtxSystem = vtx.schema_data?.compatibility?.video_standard || vtx.schema_data?.video_standard;
        const camSystem = cam.schema_data?.compatibility?.output_signal || cam.schema_data?.video_system;
        // Analog VTX expects CVBS camera; Digital VTX expects matching digital_system
        if (vtxSystem === 'analog' && camSystem && camSystem !== 'CVBS' && camSystem !== 'analog') {
            warnings.push({ type: 'warning', title: 'Camera/VTX System Mismatch', message: `The VTX is analog but the camera outputs ${camSystem}. You need an analog (CVBS) camera.` });
        } else if (vtxSystem === 'digital') {
            const vtxDigital = vtx.schema_data?.digital_system || vtx.schema_data?.compatibility?.digital_system;
            const camDigital = cam.schema_data?.digital_system || cam.schema_data?.compatibility?.digital_system;
            if (vtxDigital && camDigital && vtxDigital !== camDigital) {
                warnings.push({ type: 'warning', title: 'Digital System Mismatch', message: `The VTX uses ${vtxDigital} but the camera is ${camDigital}. These systems are not compatible.` });
            }
        }
    }

    // B7. Motor current draw vs ESC continuous current (SOFT)
    if (motors && effectiveEsc) {
        const motorMinCurrent = parseFloat(motors.schema_data?.compatibility?.min_esc_current_per_motor_a);
        const escCurrentPerMotor = parseFloat(effectiveEsc.schema_data?.continuous_current_per_motor_a || effectiveEsc.schema_data?.compatibility?.continuous_current_per_motor_a);
        if (motorMinCurrent && escCurrentPerMotor && escCurrentPerMotor < motorMinCurrent) {
            warnings.push({ type: 'warning', title: 'ESC Current Rating Low for Motors', message: `These motors need at least ${motorMinCurrent}A per motor, but the ESC is rated for ${escCurrentPerMotor}A. Risk of ESC overheating.` });
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
