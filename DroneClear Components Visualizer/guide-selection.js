/* ═══════════════════════════════════════════════════════════
   guide-selection.js — Landing page grid + guide loading
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    cacheGuideDOMRefs();
    loadGuideSettings();
    applySettingsToUI();
    initGuidePage();
});

async function initGuidePage() {
    // Wire up mode toggle
    guideDOM['btn-mode-browse']?.addEventListener('click', () => switchMode('browse'));
    guideDOM['btn-mode-edit']?.addEventListener('click', () => switchMode('edit'));

    // Wire up settings
    guideDOM['btn-guide-settings']?.addEventListener('click', toggleSettingsPanel);
    guideDOM['btn-close-settings']?.addEventListener('click', toggleSettingsPanel);
    guideDOM['setting-photo-quality']?.addEventListener('change', onSettingChange);
    guideDOM['setting-auto-advance']?.addEventListener('change', onSettingChange);
    guideDOM['setting-safety-warnings']?.addEventListener('change', onSettingChange);

    // Load guides and show selection
    await loadGuideList();
    setGuidePhase('selection');
}

function switchMode(mode) {
    guideDOM['btn-mode-browse']?.classList.toggle('active', mode === 'browse');
    guideDOM['btn-mode-edit']?.classList.toggle('active', mode === 'edit');

    if (mode === 'edit') {
        setGuidePhase('editing');
        if (typeof initGuideEditor === 'function') initGuideEditor();
    } else {
        setGuidePhase('selection');
        renderGuideSelection();
    }
}

// ── Load guide list from API ─────────────────────────────
async function loadGuideList() {
    try {
        guideState.guides = await apiFetch(GUIDE_API.guides);
        renderGuideSelection();
    } catch (err) {
        console.error('Failed to load guides:', err);
        guideState.guides = [];
        renderGuideSelection();
    }
}

// ── Render guide card grid ───────────────────────────────
function renderGuideSelection() {
    const grid = guideDOM['guide-grid'];
    const empty = guideDOM['guide-empty-state'];
    if (!grid) return;

    if (!guideState.guides.length) {
        grid.innerHTML = '';
        empty?.classList.remove('hidden');
        return;
    }
    empty?.classList.add('hidden');

    grid.innerHTML = guideState.guides.map(g => `
        <div class="guide-card" data-pid="${g.pid}" onclick="selectGuide('${g.pid}')">
            <div class="guide-card-thumb">
                ${g.thumbnail
                    ? `<img src="${g.thumbnail}" alt="${g.name}" onerror="this.parentElement.innerHTML='<i class=\\'ph ph-clipboard-text\\'></i>'">`
                    : '<i class="ph ph-clipboard-text"></i>'}
            </div>
            <div class="guide-card-body">
                <div class="guide-card-title">${escHTML(g.name)}</div>
                <div class="guide-card-desc">${escHTML(g.description || '')}</div>
                <div class="guide-card-meta">
                    <span class="difficulty-${g.difficulty}">
                        <i class="ph ph-gauge"></i> ${capitalise(g.difficulty)}
                    </span>
                    <span><i class="ph ph-clock"></i> ${g.estimated_time_minutes} min</span>
                    <span><i class="ph ph-stack"></i> ${g.step_count ?? '?'} steps</span>
                    ${g.drone_class ? `<span><i class="ph ph-drone"></i> ${escHTML(g.drone_class)}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// ── Select a guide → fetch detail → show overview ────────
async function selectGuide(pid) {
    try {
        guideState.selectedGuide = await apiFetch(GUIDE_API.guideDetail(pid));
        renderBuildOverview();
        setGuidePhase('overview');
    } catch (err) {
        console.error('Failed to load guide:', err);
        alert('Failed to load guide details.');
    }
}

// ── Render build overview ────────────────────────────────
function renderBuildOverview() {
    const g = guideState.selectedGuide;
    if (!g) return;

    setText('overview-title', g.name);
    setText('overview-description', g.description || '');
    setHTML('overview-difficulty', `<i class="ph ph-gauge"></i> ${capitalise(g.difficulty)}`);
    if (guideDOM['overview-difficulty']) guideDOM['overview-difficulty'].className = `guide-meta-badge difficulty-${g.difficulty}`;
    setText('overview-time', `${g.estimated_time_minutes} min`);
    setText('overview-steps-count', g.steps?.length ?? 0);

    // Required tools
    const toolsList = guideDOM['overview-tools-list'];
    if (toolsList) {
        toolsList.innerHTML = (g.required_tools || []).map(t => `<li>${escHTML(t)}</li>`).join('');
        if (!g.required_tools?.length) toolsList.innerHTML = '<li style="color:var(--text-muted);">None specified</li>';
    }

    // Component checklist — gather from all steps
    const allComponents = [];
    (g.steps || []).forEach(step => {
        (step.required_components || []).forEach(pid => {
            if (!allComponents.includes(pid)) allComponents.push(pid);
        });
    });
    guideState.checklist = {};
    const checklistEl = guideDOM['overview-checklist'];
    if (checklistEl) {
        if (!allComponents.length) {
            checklistEl.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No components listed.</p>';
        } else {
            checklistEl.innerHTML = allComponents.map(pid => {
                guideState.checklist[pid] = false;
                return `<label class="guide-checklist-item">
                    <input type="checkbox" data-pid="${pid}" onchange="toggleChecklistItem('${pid}', this.checked)">
                    <span>${escHTML(pid)}</span>
                </label>`;
            }).join('');
        }
    }

    // Wire overview buttons
    guideDOM['btn-back-to-selection']?.addEventListener('click', () => {
        setGuidePhase('selection');
    }, { once: true });

    guideDOM['btn-start-build']?.addEventListener('click', startBuild, { once: true });
}

function toggleChecklistItem(pid, checked) {
    guideState.checklist[pid] = checked;
}

// ── Start build → create session ─────────────────────────
async function startBuild() {
    const g = guideState.selectedGuide;
    if (!g) return;

    const builderName = guideDOM['overview-builder-name']?.value?.trim() || '';

    try {
        guideState.session = await apiFetch(GUIDE_API.sessions, {
            method: 'POST',
            body: JSON.stringify({
                guide: g.pid,
                builder_name: builderName,
                component_checklist: guideState.checklist,
            }),
        });

        guideState.currentStepIndex = 0;
        guideState.photos = {};
        setGuidePhase('running');
        renderStep(0);
        updateSidebarSession();
    } catch (err) {
        console.error('Failed to start build:', err);
        alert('Failed to start build session.');
        // Re-enable button
        guideDOM['btn-start-build']?.addEventListener('click', startBuild, { once: true });
    }
}

// ── Settings ─────────────────────────────────────────────
function toggleSettingsPanel() {
    const panel = guideDOM['guide-settings-panel'];
    if (panel) panel.classList.toggle('hidden');
}

function applySettingsToUI() {
    if (guideDOM['setting-photo-quality']) guideDOM['setting-photo-quality'].value = guideSettings.photoQuality;
    if (guideDOM['setting-auto-advance']) guideDOM['setting-auto-advance'].checked = guideSettings.autoAdvance;
    if (guideDOM['setting-safety-warnings']) guideDOM['setting-safety-warnings'].checked = guideSettings.showSafetyWarnings;
}

function onSettingChange() {
    guideSettings.photoQuality = guideDOM['setting-photo-quality']?.value || 'medium';
    guideSettings.autoAdvance = guideDOM['setting-auto-advance']?.checked ?? false;
    guideSettings.showSafetyWarnings = guideDOM['setting-safety-warnings']?.checked ?? true;
    saveGuideSettings();
}

// ── Util ─────────────────────────────────────────────────
function escHTML(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function capitalise(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function setText(id, text) {
    const el = guideDOM[id];
    if (el) el.textContent = text;
}
function setHTML(id, html) {
    const el = guideDOM[id];
    if (el) el.innerHTML = html;
}
