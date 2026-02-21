// =============================================================
// persist.js — Save / Load builds to/from Django backend
// =============================================================

function getBuildComponentCount() {
    return Object.values(currentBuild).filter(c => c !== null).length;
}

function buildSummaryHtml() {
    const filled = Object.entries(currentBuild).filter(([, v]) => v !== null);
    if (filled.length === 0) return '<p style="color:var(--text-faint);font-size:13px;">No components selected yet.</p>';
    return filled.map(([cat, comp]) =>
        `<div class="save-summary-row"><span class="save-summary-cat">${formatTitle(cat)}</span><span class="save-summary-name">${comp.name}</span></div>`
    ).join('');
}

function generateBuildPid() {
    return 'BUILD-' + Date.now().toString(36).toUpperCase();
}

function openSaveBuildModal() {
    if (getBuildComponentCount() === 0) {
        showToast('Add at least one component before saving.', 'warning');
        return;
    }
    if (elements.buildNameInput) elements.buildNameInput.value = '';
    if (elements.buildDescInput) elements.buildDescInput.value = '';
    if (elements.saveBuildSummary) elements.saveBuildSummary.innerHTML = buildSummaryHtml();
    elements.saveBuildModal?.classList.remove('hidden');
    setTimeout(() => elements.buildNameInput?.focus(), 50);
}

function closeSaveBuildModal() {
    elements.saveBuildModal?.classList.add('hidden');
}

async function confirmSaveBuild() {
    const name = elements.buildNameInput?.value.trim();
    if (!name) {
        elements.buildNameInput?.focus();
        elements.buildNameInput?.classList.add('input-error');
        setTimeout(() => elements.buildNameInput?.classList.remove('input-error'), 1200);
        return;
    }

    const desc = elements.buildDescInput?.value.trim() || '';
    const relations = {};
    Object.entries(currentBuild).forEach(([cat, comp]) => { if (comp) relations[cat] = comp.pid; });

    const payload = { pid: generateBuildPid(), name, description: desc, relations };

    try {
        elements.saveBuildConfirmBtn.disabled = true;
        elements.saveBuildConfirmBtn.innerHTML = '<i class="ph ph-spinner"></i> Saving…';

        const response = await fetch('/api/drone-models/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(JSON.stringify(await response.json()));

        closeSaveBuildModal();
        showToast(`Build "${name}" saved successfully!`, 'success');
    } catch (err) {
        console.error('Save build failed:', err);
        showToast('Failed to save build. Please try again.', 'error');
    } finally {
        elements.saveBuildConfirmBtn.disabled = false;
        elements.saveBuildConfirmBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Save';
    }
}

async function openLoadBuildModal() {
    elements.loadBuildModal?.classList.remove('hidden');
    elements.savedBuildsList.innerHTML = '<div class="saved-builds-loading"><i class="ph ph-spinner"></i> Loading saved builds…</div>';

    try {
        const response = await fetch('/api/drone-models/');
        if (!response.ok) throw new Error('Failed to fetch builds');
        const builds = await response.json();

        if (builds.length === 0) {
            elements.savedBuildsList.innerHTML = '<div class="saved-builds-empty"><i class="ph ph-archive"></i><p>No saved builds yet.</p></div>';
            return;
        }

        elements.savedBuildsList.innerHTML = builds.map(b => {
            const slotCount = Object.keys(b.relations || {}).length;
            const slotNames = Object.keys(b.relations || {}).map(k => formatTitle(k)).join(', ') || 'Empty';
            return `
                <div class="saved-build-item">
                    <div class="saved-build-info">
                        <div class="saved-build-name">${b.name}</div>
                        <div class="saved-build-meta">${slotCount} component${slotCount !== 1 ? 's' : ''} · <span style="color:var(--text-faint);font-size:11px;">${b.pid}</span></div>
                        ${b.description ? `<div class="saved-build-desc">${b.description}</div>` : ''}
                        <div class="saved-build-slots">${slotNames}</div>
                    </div>
                    <div class="saved-build-actions">
                        <button class="btn btn-primary btn-sm" onclick="loadBuild('${b.pid}')">
                            <i class="ph ph-download-simple"></i> Load
                        </button>
                        <button class="btn btn-outline btn-sm" style="border-color:rgba(239,68,68,0.3);color:#ef4444;" onclick="deleteBuild('${b.pid}', '${b.name.replace(/'/g, "\\'")}')">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </div>`;
        }).join('');
    } catch (err) {
        console.error(err);
        elements.savedBuildsList.innerHTML = '<div class="saved-builds-empty"><i class="ph ph-warning-circle"></i><p>Could not load builds.</p></div>';
    }
}

function closeLoadBuildModal() {
    elements.loadBuildModal?.classList.add('hidden');
}

window.loadBuild = async function(pid) {
    try {
        const response = await fetch(`/api/drone-models/${pid}/`);
        if (!response.ok) throw new Error('Build not found');
        const build = await response.json();
        const relations = build.relations || {};

        for (let key in currentBuild) currentBuild[key] = null;

        const loadPromises = Object.entries(relations).map(async ([cat, compPid]) => {
            try {
                if (schemaData[cat]) {
                    const found = schemaData[cat].find(c => c.pid === compPid);
                    if (found) { currentBuild[cat] = found; return; }
                }
                const r = await fetch(`/api/components/?category=${cat}`);
                if (!r.ok) return;
                const comps = await r.json();
                schemaData[cat] = comps;
                const found = comps.find(c => c.pid === compPid);
                if (found) currentBuild[cat] = found;
            } catch (e) { console.warn(`Could not resolve ${cat}:${compPid}`, e); }
        });

        await Promise.all(loadPromises);

        renderBuildSlots();
        updateBuildTotals();
        updateBuildBadge();
        validateBuild();

        closeLoadBuildModal();
        openBuildDrawer();
        showToast(`Build "${build.name}" loaded!`, 'success');
    } catch (err) {
        console.error(err);
        showToast('Failed to load build.', 'error');
    }
};

window.deleteBuild = async function(pid, name) {
    if (!confirm(`Delete build "${name}"? This cannot be undone.`)) return;
    try {
        const response = await fetch(`/api/drone-models/${pid}/`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': getCookie('csrftoken') }
        });
        if (!response.ok && response.status !== 204) throw new Error('Delete failed');
        showToast(`Build "${name}" deleted.`, 'info');
        openLoadBuildModal();
    } catch (err) {
        console.error(err);
        showToast('Failed to delete build.', 'error');
    }
};
