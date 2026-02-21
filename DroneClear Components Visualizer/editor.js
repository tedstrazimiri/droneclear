let schemaTemplate = {};
let currentCategory = null;
let editingComponent = null;

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

    // Drone Fields
    droneFormContainer: document.getElementById('drone-form-container'),
    droneForm: document.getElementById('drone-form'),
    droneFormTitle: document.getElementById('drone-form-title'),
    btnDroneCancel: document.getElementById('btn-drone-cancel'),
    btnDroneDelete: document.getElementById('btn-drone-delete'),
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
        // Fetch Master Schema for input generation
        const schemaRes = await fetch('/static/drone_parts_schema_v2.json');
        if (!schemaRes.ok) throw new Error("Could not load schema template.");
        const schemaData = await schemaRes.json();
        schemaTemplate = schemaData.components;

        // Fetch categories from API
        await fetchCategories();

        // Intercept deep edit links
        const urlParams = new URLSearchParams(window.location.search);
        const editPid = urlParams.get('edit_pid');
        if (editPid) {
            await handleDeepEditLink(editPid);
        }

        // Wire up search bar
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const cards = elements.itemsList.querySelectorAll('.item-row');
                cards.forEach(card => {
                    const text = card.textContent.toLowerCase();
                    if (text.includes(term)) {
                        card.style.display = 'flex';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        }

    } catch (e) {
        console.error("Failed to init editor", e);
        alert("Failed to load editor data. Is the local Django server active at port 8080?");
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
            const dmNav = document.getElementById('nav-drone-models');
            if (dmNav) dmNav.classList.add('active');

            await loadDroneModels();
            openDroneForm(item);
        } else {
            const categoryObj = document.querySelector(`.nav-item[data-slug="${item.category}"]`);
            if (categoryObj) {
                document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
                categoryObj.classList.add('active');

                // Get the text content for the title, fallback to slug
                const catName = categoryObj.querySelector('span')?.textContent || item.category;
                await loadCategory(item.category, catName);
            }
            openForm(item);
        }
    } catch (e) {
        console.error("Deep link failed:", e);
        alert("Could not load the requested component for editing.");
    }
}

async function fetchCategories() {
    const res = await fetch('/api/categories/');
    const categories = await res.json();

    elements.nav.innerHTML = '';

    // Add special Drone Models nav item
    const dmNav = document.createElement('a');
    dmNav.className = 'nav-item';
    dmNav.id = 'nav-drone-models';
    dmNav.innerHTML = `<span>Drone Models</span><i class="ph ph-cube"></i>`;
    dmNav.href = '#';
    dmNav.onclick = (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        dmNav.classList.add('active');
        loadDroneModels();
    };
    elements.nav.appendChild(dmNav);

    const sep = document.createElement('div');
    sep.style.margin = "10px 0";
    sep.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
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
            loadCategory(cat.slug, cat.name);
        };
        elements.nav.appendChild(a);
    });

    const partsCountEl = document.getElementById('total-parts-count');
    if (partsCountEl) {
        partsCountEl.textContent = `${totalParts} Parts`;
    }
}

async function loadCategory(slug, name) {
    currentCategory = slug;
    elements.title.textContent = `Editing: ${name}`;
    elements.workspace.classList.remove('hidden');
    elements.formContainer.classList.add('hidden');

    elements.itemsList.innerHTML = '<div style="padding:20px; text-align:center; color: var(--text-main);">Loading items...</div>';

    try {
        const res = await fetch(`/api/components/?category=${slug}`);
        const items = await res.json();

        elements.itemsList.innerHTML = '';
        if (items.length === 0) {
            elements.itemsList.innerHTML = '<p style="color:var(--text-muted)">No items in this category yet.</p>';
        } else {
            items.forEach(item => {
                const row = document.createElement('div');
                row.className = 'item-row';
                row.innerHTML = `
                    <div>
                        <strong style="color:var(--text-main)">${item.pid}</strong>
                        <span style="color:var(--text-muted); margin-left: 12px;">${item.name}</span>
                    </div>
                    <i class="ph ph-pencil-simple" style="color:var(--accent-blue);"></i>
                `;
                row.onclick = () => openForm(item);
                elements.itemsList.appendChild(row);
            });
        }
    } catch (e) {
        elements.itemsList.innerHTML = '<p style="color:red">Failed to load items.</p>';
    }
}

async function loadDroneModels() {
    currentCategory = '__DRONE_MODELS__';
    elements.title.textContent = `Editing: Drone Models`;
    elements.workspace.classList.remove('hidden');
    elements.formContainer.classList.add('hidden');
    elements.droneFormContainer.classList.add('hidden');

    elements.itemsList.innerHTML = '<div style="padding:20px; text-align:center; color: var(--text-main);">Loading items...</div>';

    try {
        const res = await fetch(`/api/drone-models/`);
        const items = await res.json();

        elements.itemsList.innerHTML = '';
        if (items.length === 0) {
            elements.itemsList.innerHTML = '<p style="color:var(--text-muted)">No drones created yet.</p>';
        } else {
            items.forEach(item => {
                const row = document.createElement('div');
                row.className = 'item-row';
                row.innerHTML = `
                    <div>
                        <strong style="color:var(--text-main)">${item.pid}</strong>
                        <span style="color:var(--text-muted); margin-left: 12px;">${item.name}</span>
                    </div>
                    <i class="ph ph-pencil-simple" style="color:var(--accent-blue);"></i>
                `;
                row.onclick = () => openDroneForm(item);
                elements.itemsList.appendChild(row);
            });
        }
    } catch (e) {
        elements.itemsList.innerHTML = '<p style="color:red">Failed to load items.</p>';
    }
}

elements.btnCreate.onclick = () => {
    if (currentCategory === '__DRONE_MODELS__') {
        openDroneForm();
    } else {
        openForm();
    }
};
elements.btnCancel.onclick = () => elements.formContainer.classList.add('hidden');
elements.btnDroneCancel.onclick = () => elements.droneFormContainer.classList.add('hidden');

function openForm(item = null) {
    editingComponent = item;
    elements.droneFormContainer.classList.add('hidden');
    elements.formContainer.classList.remove('hidden');
    elements.formContainer.scrollIntoView({ behavior: 'smooth' });

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
        elements.btnDelete.style.display = 'block';
    } else {
        elements.formTitle.textContent = `Create New ${currentCategory}`;
        elements.pid.value = '';
        elements.pid.readOnly = false;
        elements.name.value = '';
        elements.mfg.value = '';
        elements.price.value = '';
        elements.desc.value = '';
        elements.img.value = '';
        elements.manual.value = '';
        elements.btnDelete.style.display = 'none';
    }

    generateDynamicFields(item ? item.schema_data : {});
}

function generateDynamicFields(existingData) {
    elements.dynamicFieldsGrid.innerHTML = '';
    elements.compGrid.innerHTML = '';
    elements.compSection.style.display = 'none';

    // Get blueprint from master schema
    const blueprint = schemaTemplate[currentCategory] ? schemaTemplate[currentCategory][0] : null;
    if (!blueprint) {
        elements.dynamicFieldsGrid.innerHTML = '<p style="color:var(--text-muted)">No schema definition found for this category in v2.</p>';
        return;
    }

    const ignoredKeys = ['pid', 'name', 'manufacturer', 'description', 'link', 'image_file', 'manual_link', 'compatibility', 'tags'];

    Object.keys(blueprint).forEach(key => {
        if (ignoredKeys.includes(key)) return;
        if (key.startsWith('_')) return; // Ignore notes

        // Try to find options for this field if it's a dropdown
        let optionsStr = blueprint[`_${key}_options`] || null;
        let valType = typeof blueprint[key];

        // Handle explicit null defaults
        if (blueprint[key] === null) {
            valType = 'string';
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';

        const label = document.createElement('label');
        // Prettify label (e.g., flight_controller -> Flight Controller)
        label.textContent = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        wrapper.appendChild(label);

        let input = createInputForField(key, valType, optionsStr, existingData[key], blueprint[key]);
        input.classList.add('dynamic-input');
        wrapper.appendChild(input);
        elements.dynamicFieldsGrid.appendChild(wrapper);
    });

    // Generate Compatibility Fields
    if (blueprint.compatibility) {
        elements.compSection.style.display = 'block';
        const existingComp = existingData.compatibility || {};

        Object.keys(blueprint.compatibility).forEach(key => {
            const wrapper = document.createElement('div');
            wrapper.className = 'form-group';

            const label = document.createElement('label');
            label.textContent = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            wrapper.appendChild(label);

            let optionsStr = blueprint[`_${key}_options`] || null;
            let valType = typeof blueprint.compatibility[key];
            if (blueprint.compatibility[key] === null) valType = 'string';

            let input = createInputForField(key, valType, optionsStr, existingComp[key], blueprint.compatibility[key]);
            input.classList.add('comp-input'); // Special class for collection
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
        const opts = optionsStr.split('|').map(o => o.trim());

        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '-- Select --';
        input.appendChild(emptyOpt);

        opts.forEach(opt => {
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
        if (existingVal !== undefined && existingVal !== null) {
            input.value = existingVal ? "true" : "false";
        }
    } else {
        input = document.createElement('input');
        input.type = valType === 'number' ? 'number' : 'text';
        if (valType === 'number') input.step = 'any';
        input.dataset.key = key;
        input.placeholder = `e.g. ${defaultVal === null ? '' : JSON.stringify(defaultVal)}`;

        if (existingVal !== undefined && existingVal !== null) {
            if (Array.isArray(existingVal) || typeof existingVal === 'object') {
                input.value = JSON.stringify(existingVal);
            } else {
                input.value = existingVal;
            }
        }
    }
    return input;
}

elements.form.onsubmit = async (e) => {
    e.preventDefault();

    const btn = elements.form.querySelector('#btn-save');
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
        // Collect schema_data
        const dynamicInputs = document.querySelectorAll('.dynamic-input');
        const schema_data = {};

        dynamicInputs.forEach(input => {
            const key = input.dataset.key;
            let val = input.value;

            // Clean empty strings
            if (val === '') return;

            // Parse typings
            if (input.tagName === 'SELECT') {
                if (val === 'true') val = true;
                else if (val === 'false') val = false;
            } else if (input.type === 'number') {
                val = Number(val);
            } else if (input.type === 'text') {
                try {
                    // Try to parse arrays/objects like [4, 5] or {"width": 10}
                    if (val.startsWith('[') || val.startsWith('{')) {
                        val = JSON.parse(val);
                    }
                } catch (err) { } // Keep as string if it fails
            }

            schema_data[key] = val;
        });

        // Collect compatibility data
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
                } else if (input.type === 'text') {
                    try {
                        if (val.startsWith('[') || val.startsWith('{')) val = JSON.parse(val);
                    } catch (err) { }
                }
                comp_data[key] = val;
            });
            schema_data['compatibility'] = comp_data;
        }

        // Keep tags if they exist
        if (editingComponent && editingComponent.schema_data && editingComponent.schema_data.tags) {
            schema_data['tags'] = editingComponent.schema_data.tags;
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
            schema_data: schema_data,
        };

        let url = '/api/components/';
        let method = 'POST';

        if (editingComponent) {
            url += `${editingComponent.pid}/`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(JSON.stringify(err));
        }

        elements.formContainer.classList.add('hidden');
        await loadCategory(currentCategory, document.querySelector('.nav-item.active span').textContent);

    } catch (e) {
        console.error(e);
        alert(`Error saving component:\n${e.message}`);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
};

elements.btnDelete.onclick = async () => {
    if (!editingComponent) return;

    if (confirm(`Are you sure you want to permanently delete component ${editingComponent.pid}?`)) {
        try {
            const res = await fetch(`/api/components/${editingComponent.pid}/`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error("Delete failed");

            elements.formContainer.classList.add('hidden');
            await loadCategory(currentCategory, document.querySelector('.nav-item.active span').textContent);
        } catch (e) {
            console.error(e);
            alert("Error deleting component.");
        }
    }
};

function openDroneForm(item = null) {
    editingComponent = item;
    elements.formContainer.classList.add('hidden');
    elements.droneFormContainer.classList.remove('hidden');
    elements.droneFormContainer.scrollIntoView({ behavior: 'smooth' });

    if (item) {
        elements.droneFormTitle.textContent = `Edit Drone: ${item.pid}`;
        elements.dfPid.value = item.pid;
        elements.dfPid.readOnly = true;
        elements.dfName.value = item.name || '';
        elements.dfType.value = item.vehicle_type || '';
        elements.dfClass.value = item.build_class || '';
        elements.dfDesc.value = item.description || '';
        elements.dfImg.value = item.image_file || '';
        elements.dfManual.value = item.pdf_file || ''; // Mapping manual to pdf_file in DroneModel
        elements.dfRelations.value = JSON.stringify(item.relations || {}, null, 2);
        elements.btnDroneDelete.style.display = 'block';
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
        elements.btnDroneDelete.style.display = 'none';
    }
}

elements.droneForm.onsubmit = async (e) => {
    e.preventDefault();

    const btn = elements.droneForm.querySelector('#btn-drone-save');
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
        let relations = {};
        try {
            relations = JSON.parse(elements.dfRelations.value.trim());
        } catch (err) {
            alert("Component Relations must be valid JSON.");
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
            relations: relations,
        };

        let url = '/api/drone-models/';
        let method = 'POST';

        if (editingComponent) {
            url += `${editingComponent.pid}/`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(JSON.stringify(err));
        }

        elements.droneFormContainer.classList.add('hidden');
        await loadDroneModels();

    } catch (e) {
        console.error(e);
        alert(`Error saving drone model:\n${e.message}`);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
};
