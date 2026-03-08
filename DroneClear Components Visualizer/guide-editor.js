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
    document.getElementById('btn-add-media')?.addEventListener('click', addEditorMedia);
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

    // Checklist display fields picker
    renderChecklistFieldPicker(guide.settings?.checklist_fields);

    // Load drone models and set selected
    loadDroneModelsForEditor().then(() => {
        const dmPid = guide.drone_model?.pid || guide.drone_model || '';
        setVal('ge-drone-model', dmPid);
        // Load linked build parts for component picker
        loadLinkedBuildParts();
    });

    // Wire drone model change to reload linked parts
    const dmSelect = document.getElementById('ge-drone-model');
    if (dmSelect) {
        const newSelect = dmSelect.cloneNode(true);
        dmSelect.parentNode.replaceChild(newSelect, dmSelect);
        guideDOM['ge-drone-model'] = newSelect;
        newSelect.addEventListener('change', loadLinkedBuildParts);
    }

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
let _dragStepIndex = -1;

function renderEditorStepsList() {
    const list = guideDOM['editor-steps-list'];
    if (!list) return;

    if (!_editorSteps.length) {
        list.innerHTML = '<p style="font-size:13px; color:var(--text-muted);">No steps. Click "Add Step" to begin.</p>';
        return;
    }

    list.innerHTML = _editorSteps.map((s, i) => `
        <div class="guide-editor-step-item${guideState.editingStepIndex === i ? ' active' : ''}"
             draggable="true" data-step-index="${i}"
             onclick="selectEditorStep(${i})">
            <span class="guide-editor-step-drag-handle" title="Drag to reorder">
                <i class="ph ph-dots-six-vertical"></i>
            </span>
            <span class="guide-editor-step-item-order">${s.order}</span>
            <span class="guide-editor-step-item-title">${escHTML(s.title || 'Untitled')}</span>
            <span class="guide-editor-step-item-type">${s.step_type || 'assembly'}</span>
            <button class="guide-editor-step-item-remove" onclick="event.stopPropagation(); removeEditorStep(${i})">
                <i class="ph ph-x"></i>
            </button>
        </div>
    `).join('');

    // Wire drag-and-drop handlers
    list.querySelectorAll('.guide-editor-step-item').forEach(el => {
        el.addEventListener('dragstart', onStepDragStart);
        el.addEventListener('dragover', onStepDragOver);
        el.addEventListener('dragenter', onStepDragEnter);
        el.addEventListener('dragleave', onStepDragLeave);
        el.addEventListener('drop', onStepDrop);
        el.addEventListener('dragend', onStepDragEnd);
    });
}

// ── Drag-and-drop step reordering ────────────────────────

function onStepDragStart(e) {
    _dragStepIndex = parseInt(e.currentTarget.dataset.stepIndex);
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', _dragStepIndex);
}

function onStepDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function onStepDragEnter(e) {
    e.preventDefault();
    const target = e.currentTarget;
    const targetIndex = parseInt(target.dataset.stepIndex);
    if (targetIndex === _dragStepIndex) return;

    // Clear any existing indicators
    document.querySelectorAll('.guide-editor-step-item').forEach(el => {
        el.classList.remove('drag-over-above', 'drag-over-below');
    });

    // Show drop indicator above or below based on position
    if (targetIndex < _dragStepIndex) {
        target.classList.add('drag-over-above');
    } else {
        target.classList.add('drag-over-below');
    }
}

function onStepDragLeave(e) {
    // Only remove if leaving the element entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove('drag-over-above', 'drag-over-below');
    }
}

function onStepDrop(e) {
    e.preventDefault();
    const dropIndex = parseInt(e.currentTarget.dataset.stepIndex);
    if (_dragStepIndex < 0 || dropIndex === _dragStepIndex) return;

    // Save current step form before reordering
    if (guideState.editingStepIndex >= 0) readStepDetailForm();

    // Reorder the array
    const [moved] = _editorSteps.splice(_dragStepIndex, 1);
    _editorSteps.splice(dropIndex, 0, moved);

    // Renumber order fields
    _editorSteps.forEach((s, i) => { s.order = i + 1; });

    // Update editingStepIndex to follow the selected step
    if (guideState.editingStepIndex === _dragStepIndex) {
        guideState.editingStepIndex = dropIndex;
    } else if (guideState.editingStepIndex >= 0) {
        // Recalculate: find where the previously-selected step ended up
        const wasEditing = guideState.editingStepIndex;
        if (_dragStepIndex < wasEditing && dropIndex >= wasEditing) {
            guideState.editingStepIndex--;
        } else if (_dragStepIndex > wasEditing && dropIndex <= wasEditing) {
            guideState.editingStepIndex++;
        }
    }

    _dragStepIndex = -1;
    renderEditorStepsList();
}

function onStepDragEnd(e) {
    _dragStepIndex = -1;
    // Clean up all drag classes
    document.querySelectorAll('.guide-editor-step-item').forEach(el => {
        el.classList.remove('dragging', 'drag-over-above', 'drag-over-below');
    });
}

function addEditorStep() {
    const nextOrder = _editorSteps.length ? Math.max(..._editorSteps.map(s => s.order)) + 1 : 1;
    _editorSteps.push({
        order: nextOrder,
        title: '',
        description: '',
        safety_warning: '',
        media: [],
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
    renderEditorMediaList(step.media || []);
    setVal('se-stl', step.stl_file || '');
    setVal('se-cli', step.betaflight_cli || '');
    setVal('se-components', (step.required_components || []).join(', '));

    // Initialize component picker with rich UI
    initComponentPicker(step);

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
    readEditorMedia();
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
        drone_model_pid: getVal('ge-drone-model') || null,
        settings: {
            ...(guide.settings || {}),
            checklist_fields: getSelectedChecklistFields(),
        },
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
        await fetch(GUIDE_API.guideDetail(guide.pid), { method: 'DELETE', headers: { 'X-CSRFToken': getCookie('csrftoken') } });
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

// ── Media list editor ────────────────────────────────────

function renderEditorMediaList(media) {
    const list = document.getElementById('se-media-list');
    if (!list) return;

    if (!media || !media.length) {
        list.innerHTML = '<p style="font-size:12px; color:var(--text-muted);">No media added yet.</p>';
        return;
    }

    list.innerHTML = media.map((item, i) => {
        const hasUrl = Boolean(item.url);
        const isImage = item.type === 'image';
        const thumbHtml = (hasUrl && isImage)
            ? `<img class="guide-editor-media-thumb" src="${escHTML(item.url)}"
                   alt="" onerror="this.style.display='none'">`
            : '';
        return `<div class="guide-editor-media-item" data-index="${i}">
            ${thumbHtml}
            <select class="form-input" data-field="type" style="width:80px; font-size:12px; padding:4px;">
                <option value="image"${item.type === 'image' ? ' selected' : ''}>Image</option>
                <option value="video"${item.type === 'video' ? ' selected' : ''}>Video</option>
            </select>
            <input class="form-input" type="text" data-field="url" value="${escHTML(item.url || '')}"
                   placeholder="URL or upload..." style="flex:1; font-size:12px; padding:4px 8px;">
            <label class="btn btn-outline guide-editor-upload-btn" title="Upload file">
                <i class="ph ph-upload-simple"></i>
                <input type="file" class="guide-editor-upload-input" data-media-index="${i}"
                       accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
                       style="display:none;">
            </label>
            <input class="form-input" type="text" data-field="caption" value="${escHTML(item.caption || '')}"
                   placeholder="Caption (optional)" style="width:140px; font-size:12px; padding:4px 8px;">
            <button class="guide-editor-step-item-remove" onclick="removeEditorMedia(${i})" type="button">
                <i class="ph ph-x"></i>
            </button>
        </div>`;
    }).join('');

    // Bind upload file inputs
    list.querySelectorAll('.guide-editor-upload-input').forEach(input => {
        input.addEventListener('change', function () {
            const mediaIndex = parseInt(this.dataset.mediaIndex, 10);
            onGuideMediaFileSelected(this, mediaIndex);
        });
    });
}

function addEditorMedia() {
    const idx = guideState.editingStepIndex;
    if (idx < 0 || !_editorSteps[idx]) return;
    if (!_editorSteps[idx].media) _editorSteps[idx].media = [];
    // Read current values first before adding
    readEditorMedia();
    _editorSteps[idx].media.push({ type: 'image', url: '', caption: '' });
    renderEditorMediaList(_editorSteps[idx].media);
}

function removeEditorMedia(mediaIndex) {
    const idx = guideState.editingStepIndex;
    if (idx < 0 || !_editorSteps[idx]?.media) return;
    readEditorMedia();
    _editorSteps[idx].media.splice(mediaIndex, 1);
    renderEditorMediaList(_editorSteps[idx].media);
}

function readEditorMedia() {
    const idx = guideState.editingStepIndex;
    if (idx < 0 || !_editorSteps[idx]) return;

    const list = document.getElementById('se-media-list');
    if (!list) return;

    const items = list.querySelectorAll('.guide-editor-media-item');
    const media = [];
    items.forEach(item => {
        const type = item.querySelector('[data-field="type"]')?.value || 'image';
        const url = item.querySelector('[data-field="url"]')?.value?.trim() || '';
        const caption = item.querySelector('[data-field="caption"]')?.value?.trim() || '';
        if (url) media.push({ type, url, caption });
    });
    _editorSteps[idx].media = media;
}

// ── Guide media file upload ──────────────────────────

async function onGuideMediaFileSelected(inputEl, mediaIndex) {
    const file = inputEl.files?.[0];
    if (!file) return;

    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB (match server limit)
    if (file.size > MAX_SIZE) {
        showToast('File too large — maximum size is 10 MB.', 'error');
        inputEl.value = '';
        return;
    }

    const idx = guideState.editingStepIndex;
    if (idx < 0 || !_editorSteps[idx]) return;

    // Need guide PID for compartmentalized storage
    const guidePid = guideState.editingGuide?.pid || guideState.selectedGuide?.pid;
    if (!guidePid) {
        showToast('Save the guide first before uploading media.', 'error');
        inputEl.value = '';
        return;
    }

    // Show uploading state
    const mediaItem = inputEl.closest('.guide-editor-media-item');
    const urlInput = mediaItem?.querySelector('[data-field="url"]');
    const uploadBtn = mediaItem?.querySelector('.guide-editor-upload-btn');
    if (urlInput) { urlInput.value = 'Uploading...'; urlInput.disabled = true; }
    if (uploadBtn) uploadBtn.classList.add('uploading');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('guide_pid', guidePid);

    try {
        const result = await apiFetch(GUIDE_API.mediaUpload, {
            method: 'POST',
            body: formData,
        });

        // Update the step media entry
        readEditorMedia();
        if (!_editorSteps[idx].media) _editorSteps[idx].media = [];
        if (_editorSteps[idx].media[mediaIndex]) {
            _editorSteps[idx].media[mediaIndex].url = result.url;
            _editorSteps[idx].media[mediaIndex].type = result.type;
        }
        renderEditorMediaList(_editorSteps[idx].media);
        showToast('Media uploaded successfully.', 'success');
    } catch (err) {
        console.error('Media upload failed:', err);
        showToast('Upload failed: ' + (err.message || 'Unknown error'), 'error');
        if (urlInput) { urlInput.value = ''; urlInput.disabled = false; }
        if (uploadBtn) uploadBtn.classList.remove('uploading');
    }

    inputEl.value = '';
}

// ── Component Picker ──────────────────────────────────

let _compSearchTimer = null;
let _linkedBuildParts = null;  // Cache of linked build's component objects

/**
 * Initialize the component picker for a step.
 */
function initComponentPicker(step) {
    const searchInput = document.getElementById('se-components-search');
    const resultsEl = document.getElementById('se-components-results');
    if (!searchInput || !resultsEl) return;

    // Render existing components as chips
    renderComponentChips(step.required_components || []);

    // Render build parts quick-select panel
    renderBuildPartsPanel(step.required_components || []);

    // Wire search (remove old listener by cloning)
    const newSearch = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearch, searchInput);
    newSearch.addEventListener('input', onComponentSearch);
    newSearch.addEventListener('focus', () => {
        // Show linked build parts on focus if search is empty
        if (!newSearch.value.trim() && _linkedBuildParts?.length) {
            showComponentResults(_linkedBuildParts, 'Build Parts');
        }
    });

    // Wire "Add All" button
    const addAllBtn = document.getElementById('se-build-parts-add-all');
    if (addAllBtn) {
        const newBtn = addAllBtn.cloneNode(true);
        addAllBtn.parentNode.replaceChild(newBtn, addAllBtn);
        newBtn.addEventListener('click', addAllBuildParts);
    }

    // Close results on outside click
    document.addEventListener('click', _closePickerOnOutsideClick);
}

function _closePickerOnOutsideClick(e) {
    if (!e.target.closest('.guide-comp-picker')) {
        document.getElementById('se-components-results')?.classList.add('hidden');
    }
}

/**
 * Render the Build Components quick-select panel.
 * Shows linked drone model parts as clickable buttons.
 */
function renderBuildPartsPanel(currentPids) {
    const panel = document.getElementById('se-build-parts');
    const listEl = document.getElementById('se-build-parts-list');
    if (!panel || !listEl) return;

    if (!_linkedBuildParts?.length) {
        panel.classList.add('hidden');
        return;
    }

    panel.classList.remove('hidden');
    listEl.innerHTML = _linkedBuildParts.map(comp => {
        const isAdded = currentPids.includes(comp.pid);
        const imgSrc = compImageUrl(comp);
        const cat = (comp.category_name || comp.category || '').replace(/_/g, ' ');
        return `<button type="button" class="guide-build-part-btn${isAdded ? ' added' : ''}"
                    data-pid="${escHTML(comp.pid)}"
                    onclick="toggleBuildPart('${escHTML(comp.pid)}')"
                    title="${escHTML(comp.name)} (${escHTML(comp.pid)})">
            ${imgSrc ? `<img src="${escHTML(imgSrc)}" alt="" onerror="this.style.display='none'">` : ''}
            <span>${escHTML(comp.name)}</span>
            ${cat ? `<span class="guide-build-part-cat">${escHTML(cat)}</span>` : ''}
            <i class="ph ${isAdded ? 'ph-check-circle' : 'ph-plus-circle'}"></i>
        </button>`;
    }).join('');
}

window.toggleBuildPart = function(pid) {
    const idx = guideState.editingStepIndex;
    if (idx < 0 || !_editorSteps[idx]) return;

    if (!_editorSteps[idx].required_components) _editorSteps[idx].required_components = [];
    const list = _editorSteps[idx].required_components;

    if (list.includes(pid)) {
        _editorSteps[idx].required_components = list.filter(p => p !== pid);
    } else {
        list.push(pid);
    }

    renderComponentChips(_editorSteps[idx].required_components);
    renderBuildPartsPanel(_editorSteps[idx].required_components);
};

function addAllBuildParts() {
    const idx = guideState.editingStepIndex;
    if (idx < 0 || !_editorSteps[idx] || !_linkedBuildParts?.length) return;

    if (!_editorSteps[idx].required_components) _editorSteps[idx].required_components = [];
    const list = _editorSteps[idx].required_components;

    _linkedBuildParts.forEach(comp => {
        if (!list.includes(comp.pid)) list.push(comp.pid);
    });

    renderComponentChips(list);
    renderBuildPartsPanel(list);
}

/**
 * Load drone models list into the editor dropdown.
 */
async function loadDroneModelsForEditor() {
    try {
        const models = await apiFetch(GUIDE_API.droneModels);
        const select = document.getElementById('ge-drone-model');
        if (!select) return;
        select.innerHTML = '<option value="">(none)</option>';
        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.pid;
            opt.textContent = `${m.name} (${m.pid})`;
            select.appendChild(opt);
        });
    } catch (err) {
        console.warn('Failed to load drone models for editor:', err);
    }
}

/**
 * Load linked build parts for the component picker suggestions.
 */
async function loadLinkedBuildParts() {
    _linkedBuildParts = null;

    const dmPid = document.getElementById('ge-drone-model')?.value;
    if (!dmPid) return;

    try {
        const dm = await apiFetch(GUIDE_API.droneModelDetail(dmPid));
        // Flatten relations: values may be strings or arrays of strings
        const pids = Object.values(dm.relations || {})
            .flat()
            .filter(v => typeof v === 'string' && v);
        if (pids.length > 0) {
            await resolveComponents(pids);
            _linkedBuildParts = pids.map(pid => guideState.resolvedComponents[pid]).filter(Boolean);
        }
    } catch (err) {
        console.warn('Failed to load linked build parts:', err);
    }

    // Refresh the build parts panel for the current step
    const idx = guideState.editingStepIndex;
    if (idx >= 0 && _editorSteps[idx]) {
        renderBuildPartsPanel(_editorSteps[idx].required_components || []);
    }
}

function renderComponentChips(pidList) {
    const chipsEl = document.getElementById('se-components-chips');
    if (!chipsEl) return;

    if (!pidList.length) {
        chipsEl.innerHTML = '<span class="guide-comp-picker-hint">No components selected</span>';
        syncHiddenComponentsField();
        return;
    }

    // Resolve any un-resolved PIDs that might be in the list
    const unresolvedPids = pidList.filter(pid => !(pid in guideState.resolvedComponents));
    if (unresolvedPids.length > 0) {
        resolveComponents(unresolvedPids).then(() => renderComponentChips(pidList));
        return;
    }

    chipsEl.innerHTML = pidList.map(pid => {
        const comp = guideState.resolvedComponents[pid];
        const label = comp ? comp.name : pid;
        return `<span class="guide-comp-chip" data-pid="${escHTML(pid)}">
            ${escHTML(label)}
            <button type="button" onclick="removeComponentChip('${escHTML(pid)}')" class="guide-comp-chip-remove">
                <i class="ph ph-x"></i>
            </button>
        </span>`;
    }).join('');

    syncHiddenComponentsField();
}

window.removeComponentChip = function(pid) {
    const idx = guideState.editingStepIndex;
    if (idx < 0 || !_editorSteps[idx]) return;

    _editorSteps[idx].required_components =
        (_editorSteps[idx].required_components || []).filter(p => p !== pid);
    renderComponentChips(_editorSteps[idx].required_components);
    renderBuildPartsPanel(_editorSteps[idx].required_components);
};

window.addComponentChip = function(pid) {
    const idx = guideState.editingStepIndex;
    if (idx < 0 || !_editorSteps[idx]) return;

    if (!_editorSteps[idx].required_components) _editorSteps[idx].required_components = [];
    if (!_editorSteps[idx].required_components.includes(pid)) {
        _editorSteps[idx].required_components.push(pid);
    }
    renderComponentChips(_editorSteps[idx].required_components);
    renderBuildPartsPanel(_editorSteps[idx].required_components);

    // Clear search
    const searchInput = document.getElementById('se-components-search');
    if (searchInput) searchInput.value = '';
    document.getElementById('se-components-results')?.classList.add('hidden');
};

function syncHiddenComponentsField() {
    const idx = guideState.editingStepIndex;
    if (idx < 0 || !_editorSteps[idx]) return;
    setVal('se-components', (_editorSteps[idx].required_components || []).join(', '));
}

function onComponentSearch() {
    clearTimeout(_compSearchTimer);
    const query = document.getElementById('se-components-search')?.value?.trim().toLowerCase();
    const resultsEl = document.getElementById('se-components-results');
    if (!resultsEl) return;

    if (!query || query.length < 2) {
        if (_linkedBuildParts?.length) {
            showComponentResults(_linkedBuildParts, 'Build Parts');
        } else {
            resultsEl.classList.add('hidden');
        }
        return;
    }

    _compSearchTimer = setTimeout(async () => {
        let results = [];

        // Search linked build parts first
        if (_linkedBuildParts) {
            results = _linkedBuildParts.filter(c =>
                c.name.toLowerCase().includes(query) ||
                c.pid.toLowerCase().includes(query) ||
                (c.manufacturer || '').toLowerCase().includes(query)
            );
        }

        showComponentResults(results, 'Search Results');
    }, 200);
}

function showComponentResults(components, label) {
    const resultsEl = document.getElementById('se-components-results');
    if (!resultsEl) return;

    const currentPids = _editorSteps[guideState.editingStepIndex]?.required_components || [];
    const available = components.filter(c => !currentPids.includes(c.pid));

    if (!available.length) {
        resultsEl.innerHTML = '<div class="guide-comp-picker-empty">No matching components</div>';
    } else {
        resultsEl.innerHTML = available.slice(0, 10).map(c => {
            const imgSrc = compImageUrl(c);
            return `<div class="guide-comp-picker-result" onclick="addComponentChip('${escHTML(c.pid)}')">
                ${imgSrc
                    ? `<img class="guide-comp-picker-result-img" src="${escHTML(imgSrc)}" alt=""
                           onerror="this.style.display='none'">`
                    : ''}
                <div class="guide-comp-picker-result-info">
                    <span class="guide-comp-picker-result-name">${escHTML(c.name)}</span>
                    <span class="guide-comp-picker-result-meta">${escHTML(c.manufacturer || '')} &middot; ${escHTML(c.pid)}</span>
                </div>
            </div>`;
        }).join('');
    }

    resultsEl.classList.remove('hidden');
}

// ── Checklist Display Fields Picker ──────────────────────

function renderChecklistFieldPicker(selectedFields) {
    const container = guideDOM['ge-checklist-fields'];
    if (!container) return;

    const selected = Array.isArray(selectedFields) && selectedFields.length
        ? selectedFields
        : DEFAULT_CHECKLIST_FIELDS;

    container.innerHTML = CHECKLIST_FIELD_OPTIONS.map(opt => {
        const checked = selected.includes(opt.key);
        return `<label class="guide-checklist-field-option" data-key="${opt.key}">
            <input type="checkbox" value="${opt.key}" ${checked ? 'checked' : ''}>
            <i class="ph ${opt.icon}"></i>
            <span>${opt.label}</span>
        </label>`;
    }).join('');

    // Enforce max 5
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => enforceChecklistFieldMax(container));
    });
    enforceChecklistFieldMax(container);
}

function enforceChecklistFieldMax(container) {
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const checkedCount = container.querySelectorAll('input[type="checkbox"]:checked').length;
    checkboxes.forEach(cb => {
        const label = cb.closest('.guide-checklist-field-option');
        if (!cb.checked && checkedCount >= 5) {
            label.classList.add('disabled');
            cb.disabled = true;
        } else {
            label.classList.remove('disabled');
            cb.disabled = false;
        }
    });
}

function getSelectedChecklistFields() {
    const container = guideDOM['ge-checklist-fields'];
    if (!container) return DEFAULT_CHECKLIST_FIELDS;
    return [...container.querySelectorAll('input[type="checkbox"]:checked')].map(cb => cb.value);
}

// ── Collapsible step detail ──────────────────────────────
function toggleStepDetailCollapse(header) {
    header.classList.toggle('collapsed');
    const body = header.nextElementSibling;
    if (body) body.classList.toggle('collapsed');
}

// ── Helpers ──────────────────────────────────────────────
function setVal(id, val) {
    const el = guideDOM[id];
    if (el) el.value = val;
}

function getVal(id) {
    return guideDOM[id]?.value?.trim() || '';
}
