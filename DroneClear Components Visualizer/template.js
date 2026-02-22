document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('schema-editor');
    const loader = document.getElementById('template-loader');
    const workspace = document.getElementById('template-workspace');
    const btnSave = document.getElementById('btn-save-schema');
    const uploadInput = document.getElementById('schema-upload');
    const searchInput = document.getElementById('search-input');

    // View Toggles
    const viewModeToggle = document.getElementById('view-mode-toggle');
    const labelVisual = document.getElementById('label-visual');
    const labelJson = document.getElementById('label-json');
    const visualContainer = document.getElementById('visual-editor-container');

    let currentMode = 'visual'; // 'visual' | 'json'
    let currentSchema = {};
    let codeMirrorEditor = null; // Global reference for CodeMirror

    // Modal Elements
    const categoryModal = document.getElementById('category-modal');
    const attributeModal = document.getElementById('attribute-modal');
    const catNameInput = document.getElementById('category-name-input');
    const attrKeyInput = document.getElementById('attr-key-input');
    const attrValInput = document.getElementById('attr-val-input');
    const attrOptionsInput = document.getElementById('attr-options-input');
    const attrNotesInput = document.getElementById('attr-notes-input');

    let targetCategory = null;
    let targetSubKey = null;

    // Fetch schema on load
    async function loadSchema() {
        try {
            const [schemaRes, catRes] = await Promise.all([
                fetch('/api/schema/'),
                fetch('/api/categories/')
            ]);

            if (!schemaRes.ok) throw new Error('Failed to load schema');

            const data = await schemaRes.json();
            currentSchema = data;

            // Initialize CodeMirror AFTER we have the data
            codeMirrorEditor = CodeMirror.fromTextArea(editor, {
                mode: "application/json",
                theme: "material-darker",
                lineNumbers: true,
                matchBrackets: true,
                indentUnit: 4,
                tabSize: 4,
                lineWrapping: true
            });
            codeMirrorEditor.setValue(JSON.stringify(data, null, 4));

            // Explicitly hide it on load to prevent the blank black box bug
            document.querySelector('.CodeMirror').style.display = 'none';

            renderVisualEditor(currentSchema);

            if (catRes.ok) {
                const categories = await catRes.json();
                let totalParts = 0;
                categories.forEach(cat => totalParts += (cat.count || 0));
                const partsCountEl = document.getElementById('total-parts-count');
                if (partsCountEl) partsCountEl.textContent = `${totalParts} Parts`;
            }

            loader.classList.add('hidden');
            workspace.classList.remove('hidden');
        } catch (error) {
            console.error(error);
            loader.innerHTML = `<i class="ph ph-warning-circle" style="font-size:32px;color:#ef4444;margin-bottom:12px;"></i><p>Could not load Master Schema.</p>`;
        }
    }

    // Save schema to API
    async function saveSchema() {
        if (currentMode === 'visual') {
            syncVisualToJson();
        }

        let parsed;
        try {
            // Read from CodeMirror if in json mode, or whatever syncVisualToJson() put in codeMirrorEditor
            parsed = JSON.parse(codeMirrorEditor.getValue());
            currentSchema = parsed; // keep state in sync
        } catch (e) {
            alert("Invalid JSON format. Please fix any syntax errors before saving.");
            return;
        }

        btnSave.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Saving...`;
        btnSave.disabled = true;

        try {
            const res = await fetch('/api/schema/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(parsed)
            });

            if (!res.ok) throw new Error('Failed to save schema');

            // Success flash via CSS animation class
            btnSave.classList.add('save-success-flash');
            btnSave.innerHTML = `<i class="ph ph-check"></i> Saved!`;
            setTimeout(() => {
                btnSave.classList.remove('save-success-flash');
                btnSave.innerHTML = `<i class="ph ph-floppy-disk"></i> Save`;
                btnSave.disabled = false;
            }, 1500);

        } catch (error) {
            console.error(error);
            alert("An error occurred while saving the schema.");
            btnSave.innerHTML = `<i class="ph ph-floppy-disk"></i> Save`;
            btnSave.disabled = false;
        }
    }

    // Handle Local File Upload with validation preview
    let pendingImportJson = null;

    uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const json = JSON.parse(evt.target.result);
                pendingImportJson = json;
                showImportValidation(json);
            } catch (err) {
                alert("The uploaded file is not valid JSON.");
            }
        };
        reader.readAsText(file);
        uploadInput.value = ''; // allow re-uploading same file
    });

    function showImportValidation(json) {
        const content = document.getElementById('import-validation-content');
        const version = json.schema_version || 'unknown';
        const cats = json.components ? Object.keys(json.components) : [];
        const currentCats = currentSchema.components ? Object.keys(currentSchema.components) : [];

        const newCats = cats.filter(c => !currentCats.includes(c));
        const missingCats = currentCats.filter(c => !cats.includes(c));

        let html = `<div style="margin-bottom:12px;"><strong>Schema Version:</strong> ${version}</div>`;
        html += `<div style="margin-bottom:12px;"><strong>Categories:</strong> ${cats.length}</div>`;

        if (newCats.length > 0) {
            html += `<div style="margin-bottom:8px; color: var(--accent-green, #22c55e);"><strong>New categories:</strong> ${newCats.join(', ')}</div>`;
        }
        if (missingCats.length > 0) {
            html += `<div style="margin-bottom:8px; color: var(--accent-red);"><strong>Missing from import:</strong> ${missingCats.join(', ')}</div>`;
        }

        html += `<div style="margin-top:12px; max-height:200px; overflow-y:auto;">`;
        cats.forEach(cat => {
            const items = json.components[cat];
            const fieldCount = items && items[0] ? Object.keys(items[0]).filter(k => !k.startsWith('_')).length : 0;
            html += `<div style="padding:4px 0; border-bottom:1px solid var(--border-color); font-size:12px;"><code>${cat}</code> — ${fieldCount} fields, ${items ? items.length : 0} example(s)</div>`;
        });
        html += `</div>`;

        content.innerHTML = html;
        document.getElementById('import-validation-modal').classList.remove('hidden');
    }

    document.getElementById('btn-apply-import')?.addEventListener('click', () => {
        if (pendingImportJson) {
            currentSchema = pendingImportJson;
            codeMirrorEditor.setValue(JSON.stringify(pendingImportJson, null, 4));
            if (currentMode === 'visual') renderVisualEditor(pendingImportJson);
            pendingImportJson = null;
        }
        document.getElementById('import-validation-modal').classList.add('hidden');
    });
    document.getElementById('btn-cancel-import')?.addEventListener('click', () => {
        pendingImportJson = null;
        document.getElementById('import-validation-modal').classList.add('hidden');
    });
    document.getElementById('close-import-validation-modal')?.addEventListener('click', () => {
        pendingImportJson = null;
        document.getElementById('import-validation-modal').classList.add('hidden');
    });

    // --- MOBILE SIDEBAR ---
    const mobileNavToggle = document.getElementById('mobile-nav-toggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        if (sidebar && sidebarOverlay) {
            sidebar.classList.toggle('open');
            sidebarOverlay.classList.toggle('hidden');
            sidebarOverlay.classList.toggle('active');
        }
    }

    if (mobileNavToggle && sidebarOverlay) {
        mobileNavToggle.addEventListener('click', toggleSidebar);
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }

    // Wire up search bar
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const cards = document.querySelectorAll('.schema-category-card');
            cards.forEach(card => {
                const summary = card.querySelector('summary').textContent.toLowerCase();
                if (summary.includes(term)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

    // --- VIEW TOGGLE ---
    if (viewModeToggle) {
        viewModeToggle.addEventListener('change', (e) => {
            if (!e.target.checked) {
                // Visual Mode (unchecked)
                currentMode = 'visual';
                if (labelVisual) labelVisual.style.color = 'var(--text-main)';
                if (labelJson) labelJson.style.color = 'var(--text-muted)';

                try {
                    const parsed = JSON.parse(codeMirrorEditor.getValue());
                    currentSchema = parsed;
                } catch (err) { }

                // Hide CodeMirror wrapper, keep visual visible
                document.querySelector('.CodeMirror').style.display = 'none';
                visualContainer.classList.remove('hidden'); // Ensure it's never hidden anyway
                renderVisualEditor(currentSchema);

                btnSave.innerHTML = `<i class="ph ph-floppy-disk"></i> Save`;
            } else {
                // JSON Mode (checked)
                currentMode = 'json';
                if (labelVisual) labelVisual.style.color = 'var(--text-muted)';
                if (labelJson) labelJson.style.color = 'var(--text-main)';

                syncVisualToJson();

                // Show CodeMirror wrapper (visualContainer remains visible below it)
                document.querySelector('.CodeMirror').style.display = 'block';

                // CodeMirror needs a refresh when it becomes visible
                codeMirrorEditor.refresh();

                btnSave.innerHTML = `<i class="ph ph-floppy-disk"></i> Save`;
            }
        });
    }

    // Export dropdown toggle
    const btnExportJson = document.getElementById('btn-export-json');
    const exportMenu = document.getElementById('export-dropdown-menu');
    if (btnExportJson && exportMenu) {
        btnExportJson.addEventListener('click', (e) => {
            e.stopPropagation();
            exportMenu.classList.toggle('hidden');
        });
        document.addEventListener('click', () => exportMenu.classList.add('hidden'));
    }

    function downloadJson(data, filename) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const a = document.createElement('a');
        a.setAttribute("href", dataStr);
        a.setAttribute("download", filename);
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    // Export Full Schema
    document.getElementById('btn-export-full')?.addEventListener('click', () => {
        if (currentMode === 'visual') syncVisualToJson();
        let parsed;
        try { parsed = JSON.parse(codeMirrorEditor.getValue()); } catch (e) { alert("Invalid JSON format."); return; }
        downloadJson(parsed, 'drone_parts_schema_v3_export.json');
    });

    // Export Clean Template (strip example values, keep structure + metadata)
    document.getElementById('btn-export-clean')?.addEventListener('click', () => {
        if (currentMode === 'visual') syncVisualToJson();
        let parsed;
        try { parsed = JSON.parse(codeMirrorEditor.getValue()); } catch (e) { alert("Invalid JSON format."); return; }

        const clean = JSON.parse(JSON.stringify(parsed)); // deep clone
        if (clean.components) {
            for (const [cat, items] of Object.entries(clean.components)) {
                if (!Array.isArray(items) || items.length === 0) continue;
                const template = items[0];
                for (const [key, val] of Object.entries(template)) {
                    if (key.startsWith('_')) continue; // keep metadata
                    if (key === 'compatibility' || key === 'tags') continue;
                    if (typeof val === 'string') template[key] = null;
                    else if (typeof val === 'number') template[key] = null;
                    else if (typeof val === 'boolean') template[key] = null;
                    else if (Array.isArray(val)) template[key] = [];
                    else if (val !== null && typeof val === 'object') {
                        // Nested object — null out its values too
                        for (const [nk, nv] of Object.entries(val)) {
                            if (nk.startsWith('_')) continue;
                            if (typeof nv === 'string' || typeof nv === 'number' || typeof nv === 'boolean') val[nk] = null;
                            else if (Array.isArray(nv)) val[nk] = [];
                        }
                    }
                }
            }
        }
        downloadJson(clean, 'drone_parts_schema_v3_clean_template.json');
    });

    // Schema Format Reference Modal
    document.getElementById('btn-schema-format')?.addEventListener('click', () => {
        document.getElementById('schema-format-modal').classList.remove('hidden');
    });
    document.getElementById('close-schema-format-modal')?.addEventListener('click', () => {
        document.getElementById('schema-format-modal').classList.add('hidden');
    });
    document.getElementById('btn-close-schema-format')?.addEventListener('click', () => {
        document.getElementById('schema-format-modal').classList.add('hidden');
    });

    // --- MODAL LOGIC ---
    function closeCatModal() { categoryModal.classList.add('hidden'); }
    function closeAttrModal() { attributeModal.classList.add('hidden'); }

    document.getElementById('close-category-modal').addEventListener('click', closeCatModal);
    document.getElementById('btn-cancel-category').addEventListener('click', closeCatModal);
    document.getElementById('close-attribute-modal').addEventListener('click', closeAttrModal);
    document.getElementById('btn-cancel-attribute').addEventListener('click', closeAttrModal);

    // Save Category
    document.getElementById('btn-save-category').addEventListener('click', () => {
        const catName = catNameInput.value.trim();
        if (!catName) { alert("Category name cannot be empty."); return; }

        // Remove spaces, keep lowercase, enforce standard underscore keys
        let schemaKey = catName.toLowerCase().replace(/s+/g, '_');

        if (!currentSchema.components) currentSchema.components = {};

        if (currentSchema.components[schemaKey]) {
            alert("A category with this key already exists.");
            return;
        }

        // Initialize with standard template (only taking effect in standard format)
        currentSchema.components[schemaKey] = [{
            "pid": null,
            "name": null,
            "manufacturer": null,
            "description": null,
            "link": null,
            "approx_price": null,
            "image_file": null,
            "weight_g": null,
            "tags": []
        }];

        closeCatModal();
        codeMirrorEditor.setValue(JSON.stringify(currentSchema, null, 4));
        renderVisualEditor(currentSchema);
    });

    // Save Attribute
    document.getElementById('btn-save-attribute').addEventListener('click', () => {
        if (!targetCategory) return;

        let attrKey = attrKeyInput.value.trim().toLowerCase().replace(/s+/g, '_');
        if (!attrKey) { alert("Property Key cannot be empty"); return; }

        let attrValRaw = attrValInput.value.trim();
        let attrVal = attrValRaw;

        // rudimentary parsing
        if (attrValRaw === 'null' || attrValRaw === '') attrVal = null;
        else if (attrValRaw === 'true') attrVal = true;
        else if (attrValRaw === 'false') attrVal = false;
        else if (attrValRaw === '[]') attrVal = [];
        else if (attrValRaw !== '' && !isNaN(attrValRaw)) attrVal = Number(attrValRaw);

        const options = attrOptionsInput.value.trim();
        const notes = attrNotesInput.value.trim();

        // Mutate target object
        let templateObj = currentSchema.components[targetCategory][0];
        if (targetSubKey && targetSubKey !== 'null') {
            if (!templateObj[targetSubKey]) templateObj[targetSubKey] = {};
            templateObj = templateObj[targetSubKey];
        }

        if (templateObj.hasOwnProperty(attrKey)) {
            // Already exists, we are overwriting (which is fine)
        }
        templateObj[attrKey] = attrVal;

        if (options) {
            templateObj[`_${attrKey}_options`] = options;
        } else {
            delete templateObj[`_${attrKey}_options`];
        }

        if (notes) {
            templateObj[`_${attrKey}_notes`] = notes;
        } else {
            delete templateObj[`_${attrKey}_notes`];
        }

        // Before re-render, sync local uncommitted input values to JSON to avoid wiping out user edits!
        syncVisualToJson();

        closeAttrModal();
        codeMirrorEditor.setValue(JSON.stringify(currentSchema, null, 4));
        renderVisualEditor(currentSchema);
    });

    // Global click listener for generated buttons
    document.addEventListener('click', (e) => {
        // Delete Category
        const delCatBtn = e.target.closest('.delete-category');
        if (delCatBtn) {
            const cat = delCatBtn.getAttribute('data-cat');
            if (confirm(`Are you sure you want to delete the entire category '${cat}' and its schema?`)) {
                syncVisualToJson();
                delete currentSchema.components[cat];
                codeMirrorEditor.setValue(JSON.stringify(currentSchema, null, 4));
                renderVisualEditor(currentSchema);
            }
            return;
        }

        // Add Attribute Button
        const addAttrBtn = e.target.closest('.add-attr-btn');
        if (addAttrBtn) {
            targetCategory = addAttrBtn.getAttribute('data-cat');
            targetSubKey = addAttrBtn.getAttribute('data-sub') || null;

            document.getElementById('attribute-modal-title').textContent = targetSubKey === 'compatibility' ? 'Add Compatibility Rule' : 'Add Property';
            document.getElementById('attribute-modal-desc').textContent = targetSubKey === 'compatibility' ? 'Define a matching rule constraint.' : 'Define a new property for this category.';

            attrKeyInput.value = '';
            attrValInput.value = '';
            attrOptionsInput.value = '';
            attrNotesInput.value = '';

            attributeModal.classList.remove('hidden');
            return;
        }

        // Delete Attribute
        const delAttrBtn = e.target.closest('.delete-attr');
        if (delAttrBtn) {
            const cat = delAttrBtn.getAttribute('data-cat');
            const sub = delAttrBtn.getAttribute('data-sub');
            const attrKey = delAttrBtn.getAttribute('data-attr');

            if (confirm(`Delete attribute '${attrKey}'?`)) {
                syncVisualToJson(); // Ensure current changes aren't lost
                let templateObj = currentSchema.components[cat][0];
                if (sub && sub !== 'null') {
                    templateObj = templateObj[sub];
                }

                delete templateObj[attrKey];
                delete templateObj[`_${attrKey}_options`];
                delete templateObj[`_${attrKey}_notes`];

                codeMirrorEditor.setValue(JSON.stringify(currentSchema, null, 4));
                renderVisualEditor(currentSchema);
            }
            return;
        }
    });


    // --- VISUAL EDITOR RENDERING ---
    function renderVisualEditor(schema) {
        visualContainer.innerHTML = ''; // Clear container

        // Ensure the static HTML FAB is wired up
        const btnAddCategory = document.getElementById('btn-add-category');
        if (btnAddCategory && !btnAddCategory.hasAttribute('data-wired')) {
            btnAddCategory.addEventListener('click', () => {
                catNameInput.value = '';
                categoryModal.classList.remove('hidden');
            });
            btnAddCategory.setAttribute('data-wired', 'true');
        }

        const componentsData = schema.components || {};
        const sortedCats = Object.keys(componentsData).sort();

        let currentLetter = '';

        sortedCats.forEach(catKey => {
            const categoryArray = componentsData[catKey];
            if (!Array.isArray(categoryArray) || categoryArray.length === 0) return;

            // Alphabetical Divider Logic
            const firstChar = catKey.charAt(0).toUpperCase();
            if (firstChar !== currentLetter) {
                currentLetter = firstChar;
                const divider = document.createElement('div');
                divider.className = 'alphabet-divider';
                divider.textContent = currentLetter;
                visualContainer.appendChild(divider);
            }

            // We edit the first item in the array as the "Master Template" for this category
            const templateObj = categoryArray[0];

            const details = document.createElement('details');
            details.className = 'schema-category-card';
            details.style = 'background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; margin-bottom: 12px;';

            const summary = document.createElement('summary');
            summary.style = 'padding: 16px; font-weight: 600; cursor: pointer; outline: none; border-bottom: 1px solid transparent; user-select: none; color: var(--accent-cyan); text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: space-between;';
            summary.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <i class="ph ph-folder" style="margin-right: 8px;"></i> ${catKey.replace(/_/g, ' ')}
                </div>
                <div style="display:flex; gap: 8px;">
                    <button class="inline-action-btn delete-action delete-category" data-cat="${catKey}" title="Delete Category" onclick="event.preventDefault();" style="background: rgba(218, 41, 28, 0.1); color: var(--accent-red); border: 1px solid rgba(218, 41, 28, 0.3); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; padding: 0;">
                        <i class="ph ph-trash" style="font-size: 16px;"></i>
                    </button>
                </div>
            `;

            const content = document.createElement('div');
            content.className = 'category-content';
            content.style = 'padding: 16px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 24px;';

            // Split into "Base Properties", "Nested Objects", and "Compatibility"
            const baseProps = {};
            const nestedObjects = {};
            let compatibilityObj = null;

            for (const [k, v] of Object.entries(templateObj)) {
                if (k === 'compatibility') {
                    compatibilityObj = v;
                } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
                    nestedObjects[k] = v;
                } else {
                    baseProps[k] = v;
                }
            }
            if (!compatibilityObj) { compatibilityObj = {}; templateObj['compatibility'] = compatibilityObj; }

            // 1. Base Properties
            const secBase = createSectionHTML('Template Attributes (Defaults, Types, & Options)', catKey, null, baseProps);
            content.appendChild(secBase);

            // 2. Compatibility Rules
            const compSec = createSectionHTML('Compatibility Constraints', catKey, 'compatibility', compatibilityObj);
            compSec.style.backgroundColor = 'rgba(239, 68, 68, 0.05)'; // slight red tint for constraints
            compSec.style.padding = '12px';
            compSec.style.borderRadius = '8px';
            compSec.style.border = '1px solid rgba(239, 68, 68, 0.2)';
            content.appendChild(compSec);

            // 3. Nested Objects (e.g. fc, esc in stacks)
            for (const [nestKey, nestVal] of Object.entries(nestedObjects)) {
                const nestSec = createSectionHTML(`Nested Object: ${nestKey.toUpperCase()}`, catKey, nestKey, nestVal);
                nestSec.style.marginLeft = '16px';
                nestSec.style.marginTop = '12px';
                nestSec.style.paddingLeft = '12px';
                nestSec.style.borderLeft = '2px solid rgba(255,255,255,0.1)';
                content.appendChild(nestSec);
            }

            details.appendChild(summary);
            details.appendChild(content);
            visualContainer.appendChild(details);
        });
    }

    function createSectionHTML(title, catKey, subKey, propertiesObj) {
        const sec = document.createElement('div');
        sec.className = 'schema-group';

        let headerHtml = `<h4 style="color: var(--text-main); margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; display:flex; justify-content:space-between;">
            <span>${title}</span>
        </h4>`;

        let propsHtml = '';

        // Pre-process to find meta description keys (start with _)
        const metaDict = {};
        for (const [k, v] of Object.entries(propertiesObj)) {
            if (k.startsWith('_')) {
                metaDict[k] = v;
            }
        }

        for (const [propKey, propVal] of Object.entries(propertiesObj)) {
            if (propKey.startsWith('_')) continue; // Skip rendering meta keys as standalone rows

            const exactPath = subKey ? `components.${catKey}.0.${subKey}.${propKey}` : `components.${catKey}.0.${propKey}`;

            let displayVal = propVal;
            if (Array.isArray(propVal)) {
                displayVal = propVal.join(', ');
            } else if (propVal === null) {
                displayVal = 'null';
            } else if (typeof propVal === 'boolean') {
                displayVal = propVal ? 'true' : 'false';
            }

            // Find matching meta description (e.g. _propKey_options or _propKey_notes)
            const metaOptionsKey = `_${propKey}_options`;
            const metaNotesKey = `_${propKey}_notes`;
            const metaDesc = metaDict[metaOptionsKey] || metaDict[metaNotesKey] || '';

            const descriptionHtml = metaDesc ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 6px; line-height: 1.4;"><i class="ph ph-info"></i> ${metaDesc}</div>` : '';

            propsHtml += `
                <div class="prop-card" style="background: var(--bg-panel); padding: 16px; border-radius: var(--radius-sm); margin-bottom: 12px; border: 1px solid var(--border-color); box-shadow: var(--card-shadow); position:relative;">
                    
                    <div style="position:absolute; right:12px; top:12px; z-index:2;">
                        <button class="inline-action-btn delete-action delete-attr" data-cat="${catKey}" data-sub="${subKey}" data-attr="${propKey}" title="Delete Property" style="background: rgba(218, 41, 28, 0.1); color: var(--accent-red); border: 1px solid rgba(218, 41, 28, 0.3); border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; padding: 0;">
                            <i class="ph ph-trash" style="font-size: 14px;"></i>
                        </button>
                    </div>

                    <div style="font-weight: 700; font-family: monospace; color: var(--accent-blue); margin-bottom: 12px; font-size: 14px;">${propKey}</div>
                    
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-size:12px; color:var(--text-main); font-weight: 600; margin-bottom: 4px;">Default Value:</span>
                        <input type="text" data-path="${exactPath}" data-original-type="${typeof propVal}" data-is-array="${Array.isArray(propVal)}" value="${displayVal}" style="background: var(--bg-dark); border: 1px solid var(--border-hover); color: var(--text-main); padding: 10px 12px; border-radius: var(--radius-sm); outline:none; font-size: 13px; width: 100%; max-width: 90%; font-family: monospace; transition: all 0.2s; box-shadow: var(--inset-shadow);">
                        ${descriptionHtml}
                    </div>
                </div>
            `;
        }

        if (propsHtml === '') {
            propsHtml = `<div style="font-size:12px; color:var(--text-muted); font-style:italic; margin-bottom: 12px;">No properties defined.</div>`;
        }

        const addBtnLabel = subKey === 'compatibility' ? '+ Add Rule' : '+ Add Property';
        propsHtml += `<button class="add-btn add-attr-btn" data-cat="${catKey}" data-sub="${subKey}">${addBtnLabel}</button>`;

        sec.innerHTML = headerHtml + propsHtml;
        return sec;
    }

    // --- TWO WAY SYNCING ---
    function syncVisualToJson() {
        try {
            const rawJson = JSON.parse(codeMirrorEditor.getValue());

            // Loop over all inputs in the visual editor
            const inputs = visualContainer.querySelectorAll('input[data-path]');
            inputs.forEach(input => {
                const pathStr = input.getAttribute('data-path');
                const originalType = input.getAttribute('data-original-type');
                const isArray = input.getAttribute('data-is-array') === 'true';
                let valStr = input.value.trim();

                let typedVal = valStr;

                if (isArray) {
                    if (valStr === '') {
                        typedVal = [];
                    } else {
                        typedVal = valStr.split(',').map(s => {
                            const trimmed = s.trim();
                            // Attempt to parse number
                            if (trimmed !== '' && !isNaN(trimmed)) return Number(trimmed);
                            return trimmed;
                        });
                    }
                } else if (valStr === 'null') {
                    typedVal = null;
                } else if (valStr === 'true') {
                    typedVal = true;
                } else if (valStr === 'false') {
                    typedVal = false;
                } else if (originalType === 'number' && valStr !== '' && !isNaN(valStr)) {
                    typedVal = Number(valStr);
                }

                setNestedValue(rawJson, pathStr, typedVal);
            });

            currentSchema = rawJson;
            // Update CodeMirror Node
            if (codeMirrorEditor) {
                codeMirrorEditor.setValue(JSON.stringify(rawJson, null, 4));
            }
        } catch (e) {
            console.error("Sync Error:", e);
        }
    }

    function setNestedValue(obj, path, value) {
        const parts = path.split('.');
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            if (current[parts[i]] === undefined) {
                // Determine if next part is an array index
                if (!isNaN(parts[i + 1])) {
                    current[parts[i]] = [];
                } else {
                    current[parts[i]] = {};
                }
            }
            current = current[parts[i]];
        }
        const lastPart = parts[parts.length - 1];
        current[lastPart] = value;
    }

    // Event Listeners
    btnSave.addEventListener('click', saveSchema);

    // Init
    loadSchema();
});
