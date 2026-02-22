// =============================================================
// editor.js — Parts Library Editor logic
// v6 — UX improvements:
//   - ph-drone invalid icon → ph-cube in drone models empty state
//   - Schema Attributes & Compat Rules sections now collapsible (<details>)
//   - compSection show/hide now uses .hidden class (not style.display)
//   - Removed scrollIntoView (form always visible in right split column)
//   - Scroll right panel to top on form open for consistent UX
// =============================================================

let schemaTemplate = {};
let currentCategory = null;
let editingComponent = null;
let editorToastTimer = null;

// --- Self-contained toast (editor.js has no access to utils.js globals) ---
function showToast(message, type = 'info') {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        document.body.appendChild(toast);
    }
    const icons = {
        success: 'ph-check-circle',
        error: 'ph-warning-circle',
        warning: 'ph-warning',
        info: 'ph-info'
    };
    toast.className = `app-toast app-toast--${type} show`;
    toast.innerHTML = `<i class="ph-fill ${icons[type] || 'ph-info'}"></i><span>${message}</span>`;
    clearTimeout(editorToastTimer);
    editorToastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

const elements = {
    nav: document.getElementById('editor-nav'),
    title: document.getElementById('editor-title'),
    loader: document.getElementById('editor-loader'),
    workspace: document.getElementById('editor-workspace'),
    itemsList: document.getElementById('editor-items-list'),
    searchInput: document.getElementById('search-input'),
    formContainer: document.getElementById('item-form-container'),
    form: document.getElementById('component-form'),
    formTitle: document.getElementById('form-title'),
    btnCreate: document.getElementById('btn-create-new'),
    btnCreateTopbar: document.getElementById('btn-create-topbar'),
    btnCancel: document.getElementById('btn-cancel'),
    dynamicFieldsGrid: document.getElementById('dynamic-fields-grid'),
    compSection: document.getElementById('compatibility-section'),
    compGrid: document.getElementById('compatibility-fields-grid'),

    // Core fields
    pid: document.getElementById('field-pid'),
    name: document.getElementById('field-name'),
    mfg: document.getElementById('field-mfg'),
    price: document.getElementById('field-price'),
    desc: document.getElementById('field-desc'),
    img: document.getElementById('field-image'),
    manual: document.getElementById('field-manual'),
    btnDelete: document.getElementById('btn-delete'),
    deleteConfirmBar: document.getElementById('delete-confirm-bar'),
    btnDeleteConfirm: document.getElementById('btn-delete-confirm'),
    btnDeleteAbort: document.getElementById('btn-delete-abort'),

    // Drone Fields
    droneFormContainer: document.getElementById('drone-form-container'),
    droneForm: document.getElementById('drone-form'),
    droneFormTitle: document.getElementById('drone-form-title'),
    btnDroneCancel: document.getElementById('btn-drone-cancel'),
    btnDroneDelete: document.getElementById('btn-drone-delete'),
    droneDeleteConfirmBar: document.getElementById('drone-delete-confirm-bar'),
    btnDroneDeleteConfirm: document.getElementById('btn-drone-delete-confirm'),
    btnDroneDeleteAbort: document.getElementById('btn-drone-delete-abort'),
    dfPid: document.getElementById('df-pid'),
    dfName: document.getElementById('df-name'),
    dfType: document.getElementById('df-type'),
    dfClass: document.getElementById('df-class'),
    dfDesc: document.getElementById('df-desc'),
    dfImg: document.getElementById('df-image'),
    dfManual: document.getElementById('df-manual'),
    dfRelations: document.getElementById('df-relations'),
};

document.addEventListener('DOMContentLoaded', () => {
    initEditor();
});

async function initEditor() {
    elements.loader.style.display = 'flex';

    try {
        // Load schema from live API (not static file — keeps in sync with Master Attributes)
        const schemaRes = await fetch('/api/schema/');
        if (!schemaRes.ok) throw new Error("Could not load schema from API.");
        const schemaData = await schemaRes.json();
        schemaTemplate = schemaData.components;

        await fetchCategories();

        // Handle deep-link edit (e.g. /library/?edit_pid=FC-0001)
        const urlParams = new URLSearchParams(window.location.search);
        const editPid = urlParams.get('edit_pid');
        if (editPid) {
            await handleDeepEditLink(editPid);
        }

        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                elements.itemsList.querySelectorAll('.item-row').forEach(row => {
                    row.style.display = row.textContent.toLowerCase().includes(term) ? 'flex' : 'none';
                });
            });
        }

    } catch (e) {
        console.error("Failed to init editor", e);
        showToast("Failed to load editor data. Is the Django server running?", 'error');
    } finally {
        elements.loader.style.display = 'none';
    }
}

async function handleDeepEditLink(pid) {
    try {
        const isDrone = pid.startsWith('DRN-');
        const url = isDrone ? `/api/drone-models/${pid}/` : `/api/components/${pid}/`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Component not found");
        const item = await res.json();

        if (isDrone) {
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            document.getElementById('nav-drone-models')?.classList.add('active');
            await loadDroneModels();
            openDroneForm(item);
        } else {
            const categoryObj = document.querySelector(`.nav-item[data-slug="${item.category}"]`);
            if (categoryObj) {
                document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
                categoryObj.classList.add('active');
                const catName = categoryObj.querySelector('span')?.textContent || item.category;
                await loadCategory(item.category, catName);
            }
            openForm(item);
        }
    } catch (e) {
        console.error("Deep link failed:", e);
        showToast("Could not load the requested component for editing.", 'error');
    }
}

async function fetchCategories() {
    const res = await fetch('/api/categories/');
    const categories = await res.json();

    elements.nav.innerHTML = '';

    // Drone Models special nav item
    const dmNav = document.createElement('a');
    dmNav.className = 'nav-item';
    dmNav.id = 'nav-drone-models';
    dmNav.innerHTML = `<span>Drone Models</span><i class="ph ph-cube"></i>`;
    dmNav.href = '#';
    dmNav.onclick = (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        dmNav.classList.add('active');
        updateCreateBtn(true);
        loadDroneModels();
    };
    elements.nav.appendChild(dmNav);

    const sep = document.createElement('div');
    sep.style.cssText = "margin:10px 0; border-bottom:1px solid rgba(255,255,255,0.1);";
    elements.nav.appendChild(sep);

    let totalParts = 0;
    categories.forEach(cat => {
        totalParts += (cat.count || 0);
        const a = document.createElement('a');
        a.className = 'nav-item';
        a.dataset.slug = cat.slug;
        a.innerHTML = `<span>${cat.name}</span><span class="nav-count">${cat.count}</span>`;
        a.href = '#';
        a.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            a.classList.add('active');
            if (elements.searchInput) elements.searchInput.value = '';
            updateCreateBtn(false);
            loadCategory(cat.slug, cat.name);
        };
        elements.nav.appendChild(a);
    });

    const partsCountEl = document.getElementById('total-parts-count');
    if (partsCountEl) partsCountEl.textContent = `${totalParts} Parts`;
}

// Keep FAB and topbar button in sync
function updateCreateBtn(isDroneMode) {
    const label = isDroneMode ? 'New Drone Model' : 'New Part';
    if (elements.btnCreate) {
        elements.btnCreate.innerHTML = `<i class="ph ph-plus"></i> ${label}`;
        elements.btnCreate.classList.remove('hidden');
    }
    if (elements.btnCreateTopbar) {
        elements.btnCreateTopbar.innerHTML = `<i class="ph ph-plus"></i> ${label}`;
        elements.btnCreateTopbar.classList.remove('hidden');
    }
}

async function loadCategory(slug, name) {
    currentCategory = slug;
    elements.title.textContent = `Editing: ${name}`;
    elements.workspace.classList.remove('hidden');
    elements.formContainer.classList.add('hidden');
    elements.droneFormContainer.classList.add('hidden');

    elements.itemsList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">Loading items...</div>';

    try {
        const res = await fetch(`/api/components/?category=${slug}`);
        const items = await res.json();

        elements.itemsList.innerHTML = '';
        if (items.length === 0) {
            elements.itemsList.innerHTML = `
                <div style="padding:40px;text-align:center;color:var(--text-muted);">
                    <i class="ph ph-package" style="font-size:32px;display:block;margin-bottom:12px;opacity:0.4;"></i>
                    No parts in this category yet. Click <strong>New Part</strong> to add one.
                </div>`;
        } else {
            items.forEach(item => renderItemRow(item, false));
        }
    } catch (e) {
        elements.itemsList.innerHTML = '<p style="color:var(--negative-red);padding:20px;">Failed to load items.</p>';
    }
}

async function loadDroneModels() {
    currentCategory = '__DRONE_MODELS__';
    elements.title.textContent = `Editing: Drone Models`;
    elements.workspace.classList.remove('hidden');
    elements.formContainer.classList.add('hidden');
    elements.droneFormContainer.classList.add('hidden');

    elements.itemsList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">Loading items...</div>';

    try {
        const res = await fetch(`/api/drone-models/`);
        const items = await res.json();

        elements.itemsList.innerHTML = '';
        if (items.length === 0) {
            elements.itemsList.innerHTML = `
                <div style="padding:40px;text-align:center;color:var(--text-muted);">
                    <i class="ph ph-cube" style="font-size:32px;display:block;margin-bottom:12px;opacity:0.4;"></i>
                    No drone models yet. Click <strong>New Drone Model</strong> to add one.
                </div>`;
        } else {
            items.forEach(item => renderItemRow(item, true));
        }
    } catch (e) {
        elements.itemsList.innerHTML = '<p style="color:var(--negative-red);padding:20px;">Failed to load items.</p>';
    }
}

function renderItemRow(item, isDrone) {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
        <div>
            <strong style="color:var(--text-main)">${item.pid}</strong>
            <span style="color:var(--text-muted);margin-left:12px;">${item.name}</span>
        </div>
        <i class="ph ph-pencil-simple" style="color:var(--accent-blue);"></i>
    `;
    row.onclick = () => isDrone ? openDroneForm(item) : openForm(item);
    elements.itemsList.appendChild(row);
}

// --- Create New wiring (both FAB and topbar button) ---
function handleCreateNew() {
    if (currentCategory === '__DRONE_MODELS__') {
        openDroneForm();
    } else if (currentCategory) {
        openForm();
    } else {
        showToast('Select a category first.', 'warning');
    }
}

if (elements.btnCreate) elements.btnCreate.onclick = handleCreateNew;
if (elements.btnCreateTopbar) elements.btnCreateTopbar.onclick = handleCreateNew;
elements.btnCancel.onclick = () => elements.formContainer.classList.add('hidden');
elements.btnDroneCancel.onclick = () => elements.droneFormContainer.classList.add('hidden');

function openForm(item = null) {
    editingComponent = item;
    elements.droneFormContainer.classList.add('hidden');
    elements.formContainer.classList.remove('hidden');
    // Hide delete confirm bar whenever form opens
    elements.deleteConfirmBar?.classList.add('hidden');
    document.querySelector('.editor-split-form')?.scrollTo({ top: 0, behavior: 'smooth' });

    if (item) {
        elements.formTitle.textContent = `Edit Component: ${item.pid}`;
        elements.pid.value = item.pid;
        elements.pid.readOnly = true;
        elements.name.value = item.name || '';
        elements.mfg.value = item.manufacturer || '';
        elements.price.value = item.approx_price || '';
        elements.desc.value = item.description || '';
        elements.img.value = item.image_file || '';
        elements.manual.value = item.manual_link || '';
        elements.btnDelete.classList.remove('hidden');
    } else {
        elements.formTitle.textContent = `Create New Part`;
        elements.pid.value = '';
        elements.pid.readOnly = false;
        elements.name.value = '';
        elements.mfg.value = '';
        elements.price.value = '';
        elements.desc.value = '';
        elements.img.value = '';
        elements.manual.value = '';
        elements.btnDelete.classList.add('hidden');
    }

    generateDynamicFields(item ? (item.schema_data || {}) : {});
}

function generateDynamicFields(existingData) {
    elements.dynamicFieldsGrid.innerHTML = '';
    elements.compGrid.innerHTML = '';
    elements.compSection.classList.add('hidden');

    const blueprint = schemaTemplate[currentCategory]?.[0] || null;
    if (!blueprint) {
        elements.dynamicFieldsGrid.innerHTML = '<p style="color:var(--text-muted)">No schema definition found for this category.</p>';
        return;
    }

    const ignoredKeys = ['pid', 'name', 'manufacturer', 'description', 'link', 'image_file', 'manual_link', 'compatibility', 'tags'];

    Object.keys(blueprint).forEach(key => {
        if (ignoredKeys.includes(key) || key.startsWith('_')) return;

        const optionsStr = blueprint[`_${key}_options`] || null;
        let valType = typeof blueprint[key];
        if (blueprint[key] === null) valType = 'string';

        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';
        const label = document.createElement('label');
        label.textContent = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        wrapper.appendChild(label);

        const input = createInputForField(key, valType, optionsStr, existingData[key], blueprint[key]);
        input.classList.add('dynamic-input');
        wrapper.appendChild(input);
        elements.dynamicFieldsGrid.appendChild(wrapper);
    });

    if (blueprint.compatibility) {
        elements.compSection.classList.remove('hidden');
        const existingComp = existingData.compatibility || {};
        Object.keys(blueprint.compatibility).forEach(key => {
            const wrapper = document.createElement('div');
            wrapper.className = 'form-group';
            const label = document.createElement('label');
            label.textContent = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            wrapper.appendChild(label);

            const optionsStr = blueprint[`_${key}_options`] || null;
            let valType = typeof blueprint.compatibility[key];
            if (blueprint.compatibility[key] === null) valType = 'string';

            const input = createInputForField(key, valType, optionsStr, existingComp[key], blueprint.compatibility[key]);
            input.classList.add('comp-input');
            wrapper.appendChild(input);
            elements.compGrid.appendChild(wrapper);
        });
    }
}

function createInputForField(key, valType, optionsStr, existingVal, defaultVal) {
    let input;
    if (optionsStr) {
        input = document.createElement('select');
        input.dataset.key = key;
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '-- Select --';
        input.appendChild(emptyOpt);
        optionsStr.split('|').map(o => o.trim()).forEach(opt => {
            const o = document.createElement('option');
            o.value = opt;
            o.textContent = opt;
            input.appendChild(o);
        });
        if (existingVal !== undefined && existingVal !== null) input.value = existingVal;
    } else if (valType === 'boolean') {
        input = document.createElement('select');
        input.dataset.key = key;
        input.innerHTML = `<option value="">--</option><option value="true">True</option><option value="false">False</option>`;
        if (existingVal !== undefined && existingVal !== null) input.value = existingVal ? 'true' : 'false';
    } else {
        input = document.createElement('input');
        input.type = valType === 'number' ? 'number' : 'text';
        if (valType === 'number') input.step = 'any';
        input.dataset.key = key;
        input.placeholder = `e.g. ${defaultVal === null ? '' : JSON.stringify(defaultVal)}`;
        if (existingVal !== undefined && existingVal !== null) {
            input.value = (Array.isArray(existingVal) || typeof existingVal === 'object')
                ? JSON.stringify(existingVal)
                : existingVal;
        }
    }
    return input;
}

// --- Component form submit ---
elements.form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save');
    btn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Saving...`;
    btn.disabled = true;

    try {
        const schema_data = collectDynamicFields();

        // Preserve existing tags
        if (editingComponent?.schema_data?.tags) {
            schema_data.tags = editingComponent.schema_data.tags;
        }

        const payload = {
            category: currentCategory,
            pid: elements.pid.value.trim(),
            name: elements.name.value.trim(),
            manufacturer: elements.mfg.value.trim(),
            description: elements.desc.value.trim(),
            approx_price: elements.price.value.trim(),
            image_file: elements.img.value.trim(),
            manual_link: elements.manual.value.trim(),
            schema_data,
        };

        const url = editingComponent ? `/api/components/${editingComponent.pid}/` : '/api/components/';
        const method = editingComponent ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(JSON.stringify(await res.json()));

        elements.formContainer.classList.add('hidden');
        const activeNavName = document.querySelector('.nav-item.active span')?.textContent || currentCategory;
        await loadCategory(currentCategory, activeNavName);
        showToast(editingComponent ? `${payload.pid} updated successfully.` : `${payload.pid} created.`, 'success');

    } catch (e) {
        console.error(e);
        showToast(`Error saving: ${e.message}`, 'error');
    } finally {
        btn.innerHTML = `<i class="ph ph-floppy-disk"></i> Save to Database`;
        btn.disabled = false;
    }
};

function collectDynamicFields() {
    const schema_data = {};

    document.querySelectorAll('.dynamic-input').forEach(input => {
        const key = input.dataset.key;
        let val = input.value;
        if (val === '') return;
        if (input.tagName === 'SELECT') {
            if (val === 'true') val = true;
            else if (val === 'false') val = false;
        } else if (input.type === 'number') {
            val = Number(val);
        } else {
            try {
                if (val.startsWith('[') || val.startsWith('{')) val = JSON.parse(val);
            } catch (_) {}
        }
        schema_data[key] = val;
    });

    const compInputs = document.querySelectorAll('.comp-input');
    if (compInputs.length > 0) {
        const comp_data = {};
        compInputs.forEach(input => {
            const key = input.dataset.key;
            let val = input.value;
            if (val === '') return;
            if (input.tagName === 'SELECT') {
                if (val === 'true') val = true;
                else if (val === 'false') val = false;
            } else if (input.type === 'number') {
                val = Number(val);
            } else {
                try {
                    if (val.startsWith('[') || val.startsWith('{')) val = JSON.parse(val);
                } catch (_) {}
            }
            comp_data[key] = val;
        });
        schema_data.compatibility = comp_data;
    }

    return schema_data;
}

// --- Delete with inline confirmation ---
elements.btnDelete.onclick = () => {
    elements.deleteConfirmBar?.classList.remove('hidden');
    elements.btnDelete.classList.add('hidden');
};

elements.btnDeleteAbort?.addEventListener('click', () => {
    elements.deleteConfirmBar?.classList.add('hidden');
    elements.btnDelete.classList.remove('hidden');
});

elements.btnDeleteConfirm?.addEventListener('click', async () => {
    if (!editingComponent) return;
    const pid = editingComponent.pid;
    elements.btnDeleteConfirm.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Deleting...`;
    elements.btnDeleteConfirm.disabled = true;

    try {
        const res = await fetch(`/api/components/${pid}/`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');

        elements.formContainer.classList.add('hidden');
        const activeNavName = document.querySelector('.nav-item.active span')?.textContent || currentCategory;
        await loadCategory(currentCategory, activeNavName);
        showToast(`${pid} deleted.`, 'warning');
    } catch (e) {
        console.error(e);
        showToast('Error deleting component.', 'error');
        elements.btnDeleteConfirm.innerHTML = `<i class="ph ph-trash"></i> Yes, Delete`;
        elements.btnDeleteConfirm.disabled = false;
    }
});

// --- Drone form ---
function openDroneForm(item = null) {
    editingComponent = item;
    elements.formContainer.classList.add('hidden');
    elements.droneFormContainer.classList.remove('hidden');
    elements.droneDeleteConfirmBar?.classList.add('hidden');
    document.querySelector('.editor-split-form')?.scrollTo({ top: 0, behavior: 'smooth' });

    if (item) {
        elements.droneFormTitle.textContent = `Edit Drone: ${item.pid}`;
        elements.dfPid.value = item.pid;
        elements.dfPid.readOnly = true;
        elements.dfName.value = item.name || '';
        elements.dfType.value = item.vehicle_type || '';
        elements.dfClass.value = item.build_class || '';
        elements.dfDesc.value = item.description || '';
        elements.dfImg.value = item.image_file || '';
        elements.dfManual.value = item.pdf_file || '';
        elements.dfRelations.value = JSON.stringify(item.relations || {}, null, 2);
        elements.btnDroneDelete.classList.remove('hidden');
    } else {
        elements.droneFormTitle.textContent = `Create New Drone Model`;
        elements.dfPid.value = '';
        elements.dfPid.readOnly = false;
        elements.dfName.value = '';
        elements.dfType.value = '';
        elements.dfClass.value = '';
        elements.dfDesc.value = '';
        elements.dfImg.value = '';
        elements.dfManual.value = '';
        elements.dfRelations.value = '{\n  "frames": [],\n  "motors": []\n}';
        elements.btnDroneDelete.classList.add('hidden');
    }
}

elements.droneForm.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-drone-save');
    btn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Saving...`;
    btn.disabled = true;

    try {
        let relations = {};
        try {
            relations = JSON.parse(elements.dfRelations.value.trim());
        } catch {
            showToast('Component Relations must be valid JSON.', 'error');
            return;
        }

        const payload = {
            pid: elements.dfPid.value.trim(),
            name: elements.dfName.value.trim(),
            vehicle_type: elements.dfType.value.trim(),
            build_class: elements.dfClass.value.trim(),
            description: elements.dfDesc.value.trim(),
            image_file: elements.dfImg.value.trim(),
            pdf_file: elements.dfManual.value.trim(),
            relations,
        };

        const url = editingComponent ? `/api/drone-models/${editingComponent.pid}/` : '/api/drone-models/';
        const method = editingComponent ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(JSON.stringify(await res.json()));

        elements.droneFormContainer.classList.add('hidden');
        await loadDroneModels();
        showToast(editingComponent ? `${payload.pid} updated.` : `${payload.pid} created.`, 'success');

    } catch (e) {
        console.error(e);
        showToast(`Error saving drone model: ${e.message}`, 'error');
    } finally {
        btn.innerHTML = `<i class="ph ph-floppy-disk"></i> Save Drone Model`;
        btn.disabled = false;
    }
};

// --- Drone delete with inline confirmation ---
elements.btnDroneDelete.onclick = () => {
    elements.droneDeleteConfirmBar?.classList.remove('hidden');
    elements.btnDroneDelete.classList.add('hidden');
};

elements.btnDroneDeleteAbort?.addEventListener('click', () => {
    elements.droneDeleteConfirmBar?.classList.add('hidden');
    elements.btnDroneDelete.classList.remove('hidden');
});

elements.btnDroneDeleteConfirm?.addEventListener('click', async () => {
    if (!editingComponent) return;
    const pid = editingComponent.pid;
    elements.btnDroneDeleteConfirm.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Deleting...`;
    elements.btnDroneDeleteConfirm.disabled = true;

    try {
        const res = await fetch(`/api/drone-models/${pid}/`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');

        elements.droneFormContainer.classList.add('hidden');
        await loadDroneModels();
        showToast(`${pid} deleted.`, 'warning');
    } catch (e) {
        console.error(e);
        showToast('Error deleting drone model.', 'error');
        elements.btnDroneDeleteConfirm.innerHTML = `<i class="ph ph-trash"></i> Yes, Delete`;
        elements.btnDroneDeleteConfirm.disabled = false;
    }
});
