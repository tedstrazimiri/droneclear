document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('schema-editor');
    const loader = document.getElementById('template-loader');
    const workspace = document.getElementById('template-workspace');
    const btnSave = document.getElementById('btn-save-schema');
    const uploadInput = document.getElementById('schema-upload');
    const searchInput = document.getElementById('search-input');

    // View Toggles
    const btnVisual = document.getElementById('btn-view-visual');
    const btnJson = document.getElementById('btn-view-json');
    const visualContainer = document.getElementById('visual-editor-container');

    let currentMode = 'visual'; // 'visual' | 'json'
    let currentSchema = {};

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
            editor.value = JSON.stringify(data, null, 4);

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
            parsed = JSON.parse(editor.value);
        } catch (e) {
            alert("Invalid JSON format. Please fix any syntax errors before saving.");
            return;
        }

        btnSave.innerHTML = `<i class="ph ph-spinner ph-spin"></i><span>Saving...</span>`;
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

            // Success flash
            btnSave.style.background = 'var(--accent-green)';
            btnSave.innerHTML = `<i class="ph ph-check"></i><span>Saved Successfully</span>`;
            setTimeout(() => {
                btnSave.style.background = '';
                btnSave.innerHTML = `<i class="ph ph-floppy-disk"></i><span>Save Master Template</span>`;
                btnSave.disabled = false;
            }, 2000);

        } catch (error) {
            console.error(error);
            alert("An error occurred while saving the schema.");
            btnSave.innerHTML = `<i class="ph ph-floppy-disk"></i><span>Save Master Template</span>`;
            btnSave.disabled = false;
        }
    }

    // Handle Local File Upload overriding
    uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const json = JSON.parse(evt.target.result);
                editor.value = JSON.stringify(json, null, 4);
                if (currentMode === 'visual') {
                    renderVisualEditor(json);
                }
            } catch (err) {
                alert("The uploaded file is not valid JSON.");
            }
        };
        reader.readAsText(file);
    });

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

    // --- VISUAL EDITOR RENDERING ---
    function renderVisualEditor(schema) {
        visualContainer.innerHTML = '';

        const componentsData = schema.components || {};
        const sortedCats = Object.keys(componentsData).sort();

        sortedCats.forEach(catKey => {
            const categoryArray = componentsData[catKey];
            if (!Array.isArray(categoryArray) || categoryArray.length === 0) return;

            // We edit the first item in the array as the "Master Template" for this category
            const templateObj = categoryArray[0];

            const details = document.createElement('details');
            details.className = 'schema-category-card';
            details.style = 'background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; margin-bottom: 12px;';

            const summary = document.createElement('summary');
            summary.style = 'padding: 16px; font-weight: 600; cursor: pointer; outline: none; border-bottom: 1px solid transparent; user-select: none; color: var(--accent-cyan); text-transform: uppercase; letter-spacing: 0.5px;';
            summary.innerHTML = `<i class="ph ph-folder" style="margin-right: 8px;"></i> ${catKey.replace(/_/g, ' ')}`;

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

            // 1. Base Properties
            if (Object.keys(baseProps).length > 0) {
                const sec = createSectionHTML('Template Attributes (Defaults, Types, & Options)', catKey, null, baseProps);
                content.appendChild(sec);
            }

            // 2. Nested Objects (e.g. fc, esc in stacks)
            for (const [nestKey, nestVal] of Object.entries(nestedObjects)) {
                const nestSec = createSectionHTML(`Nested Object: ${nestKey.toUpperCase()}`, catKey, nestKey, nestVal);
                nestSec.style.marginLeft = '16px';
                nestSec.style.marginTop = '12px';
                nestSec.style.paddingLeft = '12px';
                nestSec.style.borderLeft = '2px solid rgba(255,255,255,0.1)';
                content.appendChild(nestSec);
            }

            // 3. Compatibility Rules
            if (compatibilityObj) {
                const compSec = createSectionHTML('Compatibility Constraints', catKey, 'compatibility', compatibilityObj);
                compSec.style.backgroundColor = 'rgba(239, 68, 68, 0.05)'; // slight red tint for constraints
                compSec.style.padding = '12px';
                compSec.style.borderRadius = '8px';
                compSec.style.border = '1px solid rgba(239, 68, 68, 0.2)';
                content.appendChild(compSec);
            }

            details.appendChild(summary);
            details.appendChild(content);
            visualContainer.appendChild(details);
        });
    }

    function createSectionHTML(title, catKey, subKey, propertiesObj) {
        const sec = document.createElement('div');
        sec.className = 'schema-group';

        let headerHtml = `<h4 style="color: var(--text-main); margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">${title}</h4>`;

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
                <div class="prop-card" style="background: var(--bg-panel); padding: 16px; border-radius: var(--radius-sm); margin-bottom: 12px; border: 1px solid var(--border-color); box-shadow: var(--card-shadow);">
                    <div style="font-weight: 700; font-family: monospace; color: var(--accent-blue); margin-bottom: 12px; font-size: 14px;">${propKey}</div>
                    
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-size:12px; color:var(--text-main); font-weight: 600; margin-bottom: 4px;">Default Value:</span>
                        <input type="text" data-path="${exactPath}" data-original-type="${typeof propVal}" data-is-array="${Array.isArray(propVal)}" value="${displayVal}" style="background: var(--bg-dark); border: 1px solid var(--border-hover); color: var(--text-main); padding: 10px 12px; border-radius: var(--radius-sm); outline:none; font-size: 13px; width: 100%; font-family: monospace; transition: all 0.2s; box-shadow: var(--inset-shadow);">
                        ${descriptionHtml}
                    </div>
                </div>
            `;
        }

        if (propsHtml === '') {
            propsHtml = `<div style="font-size:12px; color:var(--text-muted); font-style:italic;">No properties defined.</div>`;
        }

        sec.innerHTML = headerHtml + propsHtml;
        return sec;
    }

    // --- TWO WAY SYNCING ---
    function syncVisualToJson() {
        try {
            const rawJson = JSON.parse(editor.value);

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

            // Update Text Node
            editor.value = JSON.stringify(rawJson, null, 4);
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

    // --- TOGGLE EVENT LISTENERS ---
    btnVisual.addEventListener('click', () => {
        if (currentMode === 'visual') return;

        // Parsing JSON back to Visual View
        try {
            const parsed = JSON.parse(editor.value);
            renderVisualEditor(parsed);

            editor.classList.add('hidden');
            visualContainer.classList.remove('hidden');

            btnVisual.classList.add('active-toggle');
            btnVisual.style.background = 'rgba(255,255,255,0.1)';

            btnJson.classList.remove('active-toggle');
            btnJson.style.background = 'transparent';

            currentMode = 'visual';
        } catch (e) {
            alert("Cannot switch to Visual Editor: Invalid JSON format.");
        }
    });

    btnJson.addEventListener('click', () => {
        if (currentMode === 'json') return;

        // Sync Visual to JSON before showing
        syncVisualToJson();

        visualContainer.classList.add('hidden');
        editor.classList.remove('hidden');

        btnJson.classList.add('active-toggle');
        btnJson.style.background = 'rgba(255,255,255,0.1)';

        btnVisual.classList.remove('active-toggle');
        btnVisual.style.background = 'transparent';

        currentMode = 'json';
    });

    // Default Init Toggle State
    btnVisual.style.background = 'rgba(255,255,255,0.1)';

    // Event Listeners
    btnSave.addEventListener('click', saveSchema);

    // Init
    loadSchema();
});
