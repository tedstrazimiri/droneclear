/* ═══════════════════════════════════════════════════════════
   guide-editor.js — Guide authoring / editing UI
   ═══════════════════════════════════════════════════════════ */

let _editorSteps = [];  // Local step array while editing

// ── Init editor (called when switching to edit mode) ─────
function initGuideEditor() {
    loadEditorGuideList();
    wireEditorButtons();
}

function wireEditorButtons() {
    // Only wire once
    if (wireEditorButtons._done) return;
    wireEditorButtons._done = true;

    guideDOM['btn-new-guide']?.addEventListener('click', createNewGuide);
    guideDOM['btn-add-step']?.addEventListener('click', addEditorStep);
    guideDOM['btn-save-guide']?.addEventListener('click', saveGuide);
    guideDOM['btn-delete-guide']?.addEventListener('click', deleteGuide);
    guideDOM['btn-preview-guide']?.addEventListener('click', previewGuide);
}

// ── Load guide list for editor sidebar ───────────────────
async function loadEditorGuideList() {
    try {
        guideState.guides = await apiFetch(GUIDE_API.guides);
    } catch (err) {
        console.error('Failed to load guides for editor:', err);
    }
    renderEditorGuideList();
}

function renderEditorGuideList() {
    const list = guideDOM['editor-guide-list'];
    if (!list) return;

    if (!guideState.guides.length) {
        list.innerHTML = '<p style="padding:16px; font-size:13px; color:var(--text-muted);">No guides yet.</p>';
        return;
    }

    list.innerHTML = guideState.guides.map(g => `
        <div class="guide-editor-guide-item${guideState.editingGuide?.pid === g.pid ? ' active' : ''}"
             onclick="selectEditorGuide('${g.pid}')">
            <div class="guide-editor-guide-item-title">${escHTML(g.name)}</div>
            <div class="guide-editor-guide-item-meta">${g.pid} &middot; ${g.step_count ?? 0} steps</div>
        </div>
    `).join('');
}

// ── Select guide for editing ─────────────────────────────
async function selectEditorGuide(pid) {
    try {
        const guide = await apiFetch(GUIDE_API.guideDetail(pid));
        guideState.editingGuide = guide;
        guideState.editingStepIndex = -1;
        _editorSteps = JSON.parse(JSON.stringify(guide.steps || []));
        populateEditorForm(guide);
        renderEditorGuideList();
    } catch (err) {
        console.error('Failed to load guide for editing:', err);
    }
}

// ── Populate form fields ─────────────────────────────────
function populateEditorForm(guide) {
    guideDOM['editor-placeholder']?.classList.add('hidden');
    guideDOM['editor-form-area']?.classList.remove('hidden');

    setVal('ge-pid', guide.pid || '');
    setVal('ge-name', guide.name || '');
    setVal('ge-difficulty', guide.difficulty || 'beginner');
    setVal('ge-drone-class', guide.drone_class || '');
    setVal('ge-time', guide.estimated_time_minutes || 60);
    setVal('ge-thumbnail', guide.thumbnail || '');
    setVal('ge-description', guide.description || '');
    setVal('ge-tools', (guide.required_tools || []).join(', '));

    renderEditorStepsList();
    // Hide step detail until a step is selected
    guideDOM['editor-step-detail']?.classList.add('hidden');
}

// ── Create new guide ─────────────────────────────────────
async function createNewGuide() {
    const pid = `BG-${String(Date.now()).slice(-6)}`;
    try {
        const newGuide = await apiFetch(GUIDE_API.guides, {
            method: 'POST',
            body: JSON.stringify({
                pid,
                name: 'New Guide',
                description: '',
                difficulty: 'beginner',
                estimated_time_minutes: 60,
                steps: [],
            }),
        });
        await loadEditorGuideList();
        selectEditorGuide(newGuide.pid);
    } catch (err) {
        console.error('Failed to create guide:', err);
        alert('Failed to create guide.');
    }
}

// ── Steps list ───────────────────────────────────────────
function renderEditorStepsList() {
    const list = guideDOM['editor-steps-list'];
    if (!list) return;

    if (!_editorSteps.length) {
        list.innerHTML = '<p style="font-size:13px; color:var(--text-muted);">No steps. Click "Add Step" to begin.</p>';
        return;
    }

    list.innerHTML = _editorSteps.map((s, i) => `
        <div class="guide-editor-step-item${guideState.editingStepIndex === i ? ' active' : ''}"
             onclick="selectEditorStep(${i})">
            <span class="guide-editor-step-item-order">${s.order}</span>
            <span class="guide-editor-step-item-title">${escHTML(s.title || 'Untitled')}</span>
            <span class="guide-editor-step-item-type">${s.step_type || 'assembly'}</span>
            <button class="guide-editor-step-item-remove" onclick="event.stopPropagation(); removeEditorStep(${i})">
                <i class="ph ph-x"></i>
            </button>
        </div>
    `).join('');
}

function addEditorStep() {
    const nextOrder = _editorSteps.length ? Math.max(..._editorSteps.map(s => s.order)) + 1 : 1;
    _editorSteps.push({
        order: nextOrder,
        title: '',
        description: '',
        safety_warning: '',
        reference_image: '',
        stl_file: '',
        betaflight_cli: '',
        step_type: 'assembly',
        estimated_time_minutes: 5,
        required_components: [],
    });
    renderEditorStepsList();
    selectEditorStep(_editorSteps.length - 1);
}

function removeEditorStep(index) {
    _editorSteps.splice(index, 1);
    // Reorder
    _editorSteps.forEach((s, i) => { s.order = i + 1; });
    if (guideState.editingStepIndex === index) {
        guideState.editingStepIndex = -1;
        guideDOM['editor-step-detail']?.classList.add('hidden');
    } else if (guideState.editingStepIndex > index) {
        guideState.editingStepIndex--;
    }
    renderEditorStepsList();
}

// ── Step detail form ─────────────────────────────────────
function selectEditorStep(index) {
    // Save current step first if one is open
    if (guideState.editingStepIndex >= 0) readStepDetailForm();

    guideState.editingStepIndex = index;
    const step = _editorSteps[index];
    if (!step) return;

    guideDOM['editor-step-detail']?.classList.remove('hidden');

    setVal('se-order', step.order);
    setVal('se-title', step.title || '');
    setVal('se-type', step.step_type || 'assembly');
    setVal('se-time', step.estimated_time_minutes || 5);
    setVal('se-description', step.description || '');
    setVal('se-safety', step.safety_warning || '');
    setVal('se-image', step.reference_image || '');
    setVal('se-stl', step.stl_file || '');
    setVal('se-cli', step.betaflight_cli || '');
    setVal('se-components', (step.required_components || []).join(', '));

    renderEditorStepsList();
}

function readStepDetailForm() {
    const idx = guideState.editingStepIndex;
    if (idx < 0 || !_editorSteps[idx]) return;

    const s = _editorSteps[idx];
    s.order = parseInt(getVal('se-order')) || idx + 1;
    s.title = getVal('se-title');
    s.step_type = getVal('se-type');
    s.estimated_time_minutes = parseInt(getVal('se-time')) || 5;
    s.description = getVal('se-description');
    s.safety_warning = getVal('se-safety');
    s.reference_image = getVal('se-image');
    s.stl_file = getVal('se-stl');
    s.betaflight_cli = getVal('se-cli');
    s.required_components = getVal('se-components').split(',').map(s => s.trim()).filter(Boolean);
}

// ── Save guide ───────────────────────────────────────────
async function saveGuide() {
    // Read current step form if open
    if (guideState.editingStepIndex >= 0) readStepDetailForm();

    const guide = guideState.editingGuide;
    if (!guide) return;

    const payload = {
        pid: getVal('ge-pid'),
        name: getVal('ge-name'),
        description: getVal('ge-description'),
        difficulty: getVal('ge-difficulty'),
        drone_class: getVal('ge-drone-class'),
        estimated_time_minutes: parseInt(getVal('ge-time')) || 60,
        thumbnail: getVal('ge-thumbnail'),
        required_tools: getVal('ge-tools').split(',').map(s => s.trim()).filter(Boolean),
        steps: _editorSteps,
    };

    const btn = guideDOM['btn-save-guide'];
    const originalHTML = btn?.innerHTML;
    if (btn) btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...';

    try {
        await apiFetch(GUIDE_API.guideDetail(guide.pid), {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
        // Reload to get server-side IDs
        await selectEditorGuide(payload.pid);
        await loadEditorGuideList();
        if (btn) {
            btn.innerHTML = '<i class="ph ph-check"></i> Saved!';
            setTimeout(() => { btn.innerHTML = originalHTML; }, 1500);
        }
    } catch (err) {
        console.error('Save failed:', err);
        alert('Failed to save guide.');
        if (btn) btn.innerHTML = originalHTML;
    }
}

// ── Delete guide ─────────────────────────────────────────
async function deleteGuide() {
    const guide = guideState.editingGuide;
    if (!guide) return;
    if (!confirm(`Delete guide "${guide.name}"? This cannot be undone.`)) return;

    try {
        await fetch(GUIDE_API.guideDetail(guide.pid), { method: 'DELETE' });
        guideState.editingGuide = null;
        guideState.editingStepIndex = -1;
        _editorSteps = [];
        guideDOM['editor-form-area']?.classList.add('hidden');
        guideDOM['editor-placeholder']?.classList.remove('hidden');
        await loadEditorGuideList();
    } catch (err) {
        console.error('Delete failed:', err);
        alert('Failed to delete guide.');
    }
}

// ── Preview → switches to browse mode and opens overview ─
async function previewGuide() {
    const guide = guideState.editingGuide;
    if (!guide) return;

    // Save first
    await saveGuide();

    // Switch to browse mode
    guideDOM['btn-mode-browse']?.classList.add('active');
    guideDOM['btn-mode-edit']?.classList.remove('active');

    // Load and show overview
    await selectGuide(guide.pid);
}

// ── Helpers ──────────────────────────────────────────────
function setVal(id, val) {
    const el = guideDOM[id];
    if (el) el.value = val;
}

function getVal(id) {
    return guideDOM[id]?.value?.trim() || '';
}
