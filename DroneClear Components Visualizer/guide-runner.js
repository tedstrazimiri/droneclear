/* ═══════════════════════════════════════════════════════════
   guide-runner.js — Step-by-step engine, session management
   ═══════════════════════════════════════════════════════════ */

// ── Render a step ────────────────────────────────────────
function renderStep(index) {
    const g = guideState.selectedGuide;
    if (!g || !g.steps?.length) return;

    const steps = g.steps;
    const step = steps[index];
    if (!step) return;

    guideState.currentStepIndex = index;
    const total = steps.length;

    // Progress
    const pct = ((index + 1) / total) * 100;
    if (guideDOM['runner-progress-bar']) guideDOM['runner-progress-bar'].style.width = `${pct}%`;

    // Header
    setText('runner-step-number', `Step ${index + 1}`);
    setText('runner-step-type', step.step_type || 'assembly');
    setText('runner-step-time', `${step.estimated_time_minutes || 5} min`);
    setText('runner-step-title', step.title || '');

    // Type badge styling
    const badgeEl = guideDOM['runner-step-type'];
    if (badgeEl) {
        badgeEl.className = 'guide-step-type-badge';
        const typeIcons = {
            assembly: 'ph-wrench',
            soldering: 'ph-lightning',
            firmware: 'ph-cpu',
            '3d_print': 'ph-cube',
            inspection: 'ph-magnifying-glass',
        };
        badgeEl.innerHTML = `<i class="ph ${typeIcons[step.step_type] || 'ph-wrench'}"></i> ${step.step_type || 'assembly'}`;
    }

    // Safety warning
    const hasSafety = step.safety_warning && guideSettings.showSafetyWarnings;
    guideDOM['runner-safety-warning']?.classList.toggle('hidden', !hasSafety);
    if (hasSafety) setText('runner-safety-text', step.safety_warning);

    // Description
    setText('runner-step-description', step.description || '');

    // Reference image
    const hasImage = !!step.reference_image;
    guideDOM['runner-reference-image-wrap']?.classList.toggle('hidden', !hasImage);
    if (hasImage && guideDOM['runner-reference-image']) {
        guideDOM['runner-reference-image'].src = step.reference_image;
    }

    // STL viewer
    const hasSTL = !!step.stl_file;
    guideDOM['runner-stl-viewer']?.classList.toggle('hidden', !hasSTL);
    if (hasSTL && typeof initSTLViewer === 'function') {
        initSTLViewer('stl-viewer-container', step.stl_file);
    } else if (typeof destroySTLViewer === 'function') {
        destroySTLViewer('stl-viewer-container');
    }

    // Betaflight CLI
    const hasCLI = !!step.betaflight_cli;
    guideDOM['runner-cli-section']?.classList.toggle('hidden', !hasCLI);
    if (hasCLI) setText('runner-cli-content', step.betaflight_cli);

    // Photo gallery for this step
    renderStepPhotos(step);

    // Navigation
    setText('runner-nav-label', `Step ${index + 1} of ${total}`);
    if (guideDOM['btn-step-prev']) guideDOM['btn-step-prev'].disabled = index === 0;

    const nextBtn = guideDOM['btn-step-next'];
    if (nextBtn) {
        const isLast = index === total - 1;
        nextBtn.innerHTML = isLast
            ? '<i class="ph ph-check-circle"></i> Complete Build'
            : 'Next <i class="ph ph-arrow-right"></i>';
        nextBtn.classList.toggle('btn-primary', true);
    }

    // Update sidebar
    updateSidebarSession();

    // Update session on server
    if (guideState.session) {
        apiFetch(GUIDE_API.sessionDetail(guideState.session.serial_number), {
            method: 'PATCH',
            body: JSON.stringify({ current_step: index }),
        }).catch(err => console.warn('Failed to update session step:', err));
    }
}

// ── Photo gallery ────────────────────────────────────────
function renderStepPhotos(step) {
    const gallery = guideDOM['runner-photo-gallery'];
    if (!gallery) return;

    const stepPhotos = guideState.photos[step.order] || [];
    if (!stepPhotos.length) {
        gallery.innerHTML = '<p style="font-size:12px; color:var(--text-muted);">No photos yet</p>';
        return;
    }
    gallery.innerHTML = stepPhotos.map(url =>
        `<img class="guide-photo-thumb" src="${url}" alt="Step photo" onclick="window.open('${url}', '_blank')">`
    ).join('');
}

// ── Navigation ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // These use event delegation since buttons exist in HTML
    document.getElementById('btn-step-prev')?.addEventListener('click', () => {
        if (guideState.currentStepIndex > 0) {
            renderStep(guideState.currentStepIndex - 1);
        }
    });

    document.getElementById('btn-step-next')?.addEventListener('click', () => {
        const steps = guideState.selectedGuide?.steps || [];
        if (guideState.currentStepIndex < steps.length - 1) {
            renderStep(guideState.currentStepIndex + 1);
        } else {
            completeSession();
        }
    });

    // CLI copy button
    document.getElementById('btn-copy-cli')?.addEventListener('click', () => {
        const text = guideDOM['runner-cli-content']?.textContent || '';
        navigator.clipboard.writeText(text).then(() => {
            const btn = guideDOM['btn-copy-cli'];
            if (btn) {
                btn.innerHTML = '<i class="ph ph-check"></i> Copied';
                setTimeout(() => { btn.innerHTML = '<i class="ph ph-copy"></i> Copy'; }, 1500);
            }
        });
    });

    // Take photo button
    document.getElementById('btn-take-photo')?.addEventListener('click', () => {
        if (typeof openCamera === 'function') openCamera();
    });

    // Back to guides from completed
    document.getElementById('btn-back-to-guides')?.addEventListener('click', () => {
        loadGuideList().then(() => setGuidePhase('selection'));
    });
});

// ── Session completion ───────────────────────────────────
async function completeSession() {
    if (!guideState.session) return;

    try {
        const now = new Date().toISOString();
        await apiFetch(GUIDE_API.sessionDetail(guideState.session.serial_number), {
            method: 'PATCH',
            body: JSON.stringify({
                status: 'completed',
                completed_at: now,
            }),
        });

        // Show completion screen
        setText('completed-sn', guideState.session.serial_number);
        setText('completed-guide-name', guideState.selectedGuide?.name || '—');
        setText('completed-builder', guideState.session.builder_name || 'Unknown');

        // Count photos
        let photoCount = 0;
        Object.values(guideState.photos).forEach(arr => { photoCount += arr.length; });
        setText('completed-photo-count', photoCount);

        // Duration
        const started = new Date(guideState.session.started_at);
        const ended = new Date(now);
        const diffMin = Math.round((ended - started) / 60000);
        setText('completed-duration', diffMin < 60 ? `${diffMin} min` : `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`);

        setGuidePhase('completed');
    } catch (err) {
        console.error('Failed to complete session:', err);
        alert('Failed to mark session as complete.');
    }
}

// ── Sidebar session info ─────────────────────────────────
function updateSidebarSession() {
    if (!guideState.session || !guideState.selectedGuide) return;

    setText('sidebar-sn', guideState.session.serial_number);
    setText('sidebar-guide-name', guideState.selectedGuide.name);

    const total = guideState.selectedGuide.steps?.length || 0;
    setText('sidebar-step-progress', `Step ${guideState.currentStepIndex + 1}/${total}`);

    const pct = total > 0 ? ((guideState.currentStepIndex + 1) / total) * 100 : 0;
    if (guideDOM['sidebar-progress-bar']) guideDOM['sidebar-progress-bar'].style.width = `${pct}%`;
}
