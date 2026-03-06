/* ═══════════════════════════════════════════════════════════
   audit.js — Build Audit Viewer
   ═══════════════════════════════════════════════════════════ */

const auditState = { record: null };

const AUDIT_API = {
    audit: (sn) => `/api/audit/${sn}/`,
    recentSessions: '/api/build-sessions/?status=completed&ordering=-completed_at',
};

const auditDOM = {};

document.addEventListener('DOMContentLoaded', () => {
    cacheAuditDOMRefs();
    initAuditPage();
});

function cacheAuditDOMRefs() {
    [
        'audit-search', 'audit-record', 'audit-sn-input', 'btn-audit-search',
        'audit-recent-builds', 'audit-header', 'audit-timeline',
        'audit-steps-accordion', 'audit-components', 'audit-integrity',
        'btn-back-to-search', 'audit-page-title', 'audit-sn',
        'audit-guide-name', 'audit-status', 'audit-builder',
        'audit-started', 'audit-completed', 'audit-duration',
        'audit-photo-count', 'audit-no-snapshot',
    ].forEach(id => { auditDOM[id] = document.getElementById(id); });
}

function initAuditPage() {
    auditDOM['btn-audit-search']?.addEventListener('click', doAuditSearch);
    auditDOM['audit-sn-input']?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doAuditSearch();
    });
    auditDOM['btn-back-to-search']?.addEventListener('click', () => showAuditPhase('search'));

    // Deep-link: /audit/#DC-20260306-0001
    const hash = window.location.hash.replace('#', '').trim();
    if (hash.startsWith('DC-')) {
        auditDOM['audit-sn-input'].value = hash;
        doAuditSearch();
    } else {
        loadRecentBuilds();
    }
}

function showAuditPhase(phase) {
    auditDOM['audit-search']?.classList.toggle('hidden', phase !== 'search');
    auditDOM['audit-record']?.classList.toggle('hidden', phase !== 'record');
    if (auditDOM['audit-page-title']) {
        auditDOM['audit-page-title'].textContent = phase === 'record' ? 'Audit Record' : 'Build Audit';
    }
}

// ── API helper (standalone — no dependency on guide-state.js) ─
async function auditFetch(url) {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
}

// ── Search ───────────────────────────────────────────────
async function doAuditSearch() {
    const sn = auditDOM['audit-sn-input']?.value.trim().toUpperCase();
    if (!sn) return;

    try {
        auditState.record = await auditFetch(AUDIT_API.audit(sn));
        window.location.hash = sn;
        renderAuditRecord();
        showAuditPhase('record');
    } catch (err) {
        if (typeof showToast === 'function') showToast('Build record not found', 'error');
        else alert('Build record not found');
    }
}

async function loadRecentBuilds() {
    try {
        const data = await auditFetch(AUDIT_API.recentSessions);
        const sessions = data.results || data;
        renderRecentBuilds(Array.isArray(sessions) ? sessions : []);
    } catch (err) {
        console.warn('Failed to load recent builds:', err);
    }
}

function renderRecentBuilds(sessions) {
    const container = auditDOM['audit-recent-builds'];
    if (!container) return;

    if (!sessions.length) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No completed builds yet.</p>';
        return;
    }

    container.innerHTML = sessions.slice(0, 10).map(s => {
        const date = new Date(s.completed_at || s.started_at).toLocaleDateString();
        const statusClass = s.status === 'completed' ? 'completed' : s.status === 'abandoned' ? 'abandoned' : 'in-progress';
        return `<div class="audit-recent-card" onclick="document.getElementById('audit-sn-input').value='${_esc(s.serial_number)}'; doAuditSearch();">
            <div class="audit-recent-sn">${_esc(s.serial_number)}</div>
            <div class="audit-recent-meta">
                <span class="audit-recent-status ${statusClass}">${_esc(s.status)}</span>
                <span>${_esc(s.builder_name || 'Unknown')}</span>
                <span>${date}</span>
            </div>
        </div>`;
    }).join('');
}

// ── Render Full Audit Record ─────────────────────────────
function renderAuditRecord() {
    const r = auditState.record;
    if (!r) return;

    renderAuditHeader(r);
    renderAuditTimeline(r);
    renderAuditSteps(r);
    renderAuditComponents(r);
    renderAuditIntegrity(r);
}

// ── Header ───────────────────────────────────────────────
function renderAuditHeader(r) {
    _setText('audit-sn', r.serial_number);
    _setText('audit-guide-name', r.guide_snapshot?.name || r.guide_name || '—');
    _setText('audit-builder', r.builder_name || 'Unknown');

    const statusEl = auditDOM['audit-status'];
    if (statusEl) {
        statusEl.textContent = r.status;
        statusEl.className = `audit-status-badge status-${r.status}`;
    }

    const started = r.started_at ? new Date(r.started_at) : null;
    const completed = r.completed_at ? new Date(r.completed_at) : null;
    _setText('audit-started', started ? _formatDateTime(started) : '—');
    _setText('audit-completed', completed ? _formatDateTime(completed) : 'In progress');

    if (started && completed) {
        const diffMin = Math.round((completed - started) / 60000);
        _setText('audit-duration', diffMin < 60 ? `${diffMin} min` : `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`);
    } else {
        _setText('audit-duration', '—');
    }

    _setText('audit-photo-count', `${r.photos?.length || 0} photos`);
}

// ── Timeline ─────────────────────────────────────────────
const EVENT_CONFIG = {
    session_started:   { icon: 'ph-play-circle',    color: '#22c55e', label: 'Build Started' },
    session_completed: { icon: 'ph-check-circle',   color: '#22c55e', label: 'Build Completed' },
    session_abandoned: { icon: 'ph-x-circle',       color: '#ef4444', label: 'Build Abandoned' },
    step_started:      { icon: 'ph-arrow-right',    color: '#3b82f6', label: 'Step Started' },
    step_completed:    { icon: 'ph-check',          color: '#3b82f6', label: 'Step Completed' },
    photo_captured:    { icon: 'ph-camera',          color: '#a855f7', label: 'Photo Captured' },
    note_saved:        { icon: 'ph-note-pencil',    color: '#f59e0b', label: 'Note Saved' },
    checklist_updated: { icon: 'ph-check-square',   color: '#6366f1', label: 'Checklist Updated' },
};

function renderAuditTimeline(r) {
    const container = auditDOM['audit-timeline'];
    if (!container) return;

    const events = r.events || [];
    if (!events.length) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No events recorded.</p>';
        return;
    }

    container.innerHTML = events.map(e => {
        const cfg = EVENT_CONFIG[e.event_type] || { icon: 'ph-dot-outline', color: '#6b7280', label: e.event_type };
        const time = new Date(e.timestamp);
        const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = time.toLocaleDateString();

        let detail = '';
        if (e.step_order !== null && e.step_order !== undefined) {
            detail += `<span class="audit-event-step">Step ${e.step_order}</span>`;
        }
        if (e.data?.step_title) detail += ` ${_esc(e.data.step_title)}`;
        if (e.data?.elapsed_ms) detail += ` (${_formatElapsed(e.data.elapsed_ms)})`;
        if (e.data?.sha256) detail += ` <span class="audit-hash-short" title="${_esc(e.data.sha256)}">SHA ${_esc(e.data.sha256.substring(0, 8))}...</span>`;
        if (e.data?.photo_count !== undefined) detail += ` ${e.data.photo_count} photos`;
        if (e.data?.total_elapsed_ms) detail += ` Total: ${_formatElapsed(e.data.total_elapsed_ms)}`;
        if (e.data?.note_length) detail += ` (${e.data.note_length} chars)`;

        return `<div class="audit-event">
            <div class="audit-event-dot" style="background:${cfg.color};">
                <i class="ph ${cfg.icon}" style="color:#fff; font-size:11px;"></i>
            </div>
            <div class="audit-event-content">
                <div class="audit-event-header">
                    <strong>${cfg.label}</strong>
                    <span class="audit-event-time">${dateStr} ${timeStr}</span>
                </div>
                ${detail ? `<div class="audit-event-detail">${detail}</div>` : ''}
            </div>
        </div>`;
    }).join('');
}

// ── Steps Accordion ──────────────────────────────────────
function renderAuditSteps(r) {
    const container = auditDOM['audit-steps-accordion'];
    const noSnap = auditDOM['audit-no-snapshot'];
    if (!container) return;

    const guideSnap = r.guide_snapshot;
    if (!guideSnap || !guideSnap.steps || !guideSnap.steps.length) {
        container.innerHTML = '';
        noSnap?.classList.remove('hidden');
        return;
    }
    noSnap?.classList.add('hidden');

    const steps = [...guideSnap.steps].sort((a, b) => a.order - b.order);
    const stepNotes = r.step_notes || {};
    const stepTiming = r.step_timing || {};
    const photos = r.photos || [];
    const compSnap = r.component_snapshot || {};

    container.innerHTML = steps.map((step, i) => {
        const timing = stepTiming[String(step.order)];
        const elapsedStr = timing ? _formatElapsed(typeof timing === 'number' ? timing : timing.elapsed_ms || timing) : null;
        const noteText = stepNotes[String(step.order)] || '';
        const stepPhotos = photos.filter(p => p.step_order === step.order);
        const stepComps = (step.required_components || []).map(pid => compSnap[pid]).filter(Boolean);

        const typeIcons = {
            assembly: 'ph-wrench', soldering: 'ph-lightning', firmware: 'ph-cpu',
            '3d_print': 'ph-cube', inspection: 'ph-magnifying-glass',
        };

        return `<div class="audit-step-panel">
            <div class="audit-step-header" onclick="this.parentElement.classList.toggle('open')">
                <span class="audit-step-num">Step ${step.order}</span>
                <i class="ph ${typeIcons[step.step_type] || 'ph-wrench'}" style="color:var(--text-muted);"></i>
                <span class="audit-step-title">${_esc(step.title)}</span>
                <span style="margin-left:auto; display:flex; align-items:center; gap:8px;">
                    ${elapsedStr ? `<span class="audit-step-timing">${elapsedStr}</span>` : ''}
                    ${stepPhotos.length ? `<span class="audit-step-photos-badge"><i class="ph ph-camera"></i> ${stepPhotos.length}</span>` : ''}
                    <i class="ph ph-caret-down audit-step-chevron"></i>
                </span>
            </div>
            <div class="audit-step-body">
                ${step.safety_warning ? `<div class="audit-safety-warning"><i class="ph ph-warning"></i> ${_esc(step.safety_warning)}</div>` : ''}
                <div class="audit-step-desc">${_esc(step.description || '')}</div>

                ${elapsedStr ? `<div class="audit-step-time-detail">
                    <i class="ph ph-timer"></i> Actual: <strong>${elapsedStr}</strong>
                    ${step.estimated_time_minutes ? ` / Estimated: ${step.estimated_time_minutes} min` : ''}
                </div>` : ''}

                ${noteText ? `<div class="audit-step-note">
                    <h4><i class="ph ph-note-pencil"></i> Builder Notes</h4>
                    <p>${_esc(noteText)}</p>
                </div>` : ''}

                ${stepPhotos.length ? `<div class="audit-step-photos">
                    <h4><i class="ph ph-camera"></i> Photos (${stepPhotos.length})</h4>
                    <div class="audit-photo-grid">
                        ${stepPhotos.map(p => `<div class="audit-photo-item">
                            <img src="${_esc(p.image_url)}" alt="Step ${step.order} photo"
                                 onclick="window.open('${_esc(p.image_url)}', '_blank')" loading="lazy">
                            <div class="audit-photo-meta">
                                <span class="audit-photo-time">${new Date(p.captured_at).toLocaleTimeString()}</span>
                                ${p.sha256 ? `<span class="audit-integrity-badge verified" title="${_esc(p.sha256)}">
                                    <i class="ph ph-seal-check"></i> SHA-256
                                </span>` : ''}
                            </div>
                            ${p.notes ? `<p class="audit-photo-note">${_esc(p.notes)}</p>` : ''}
                        </div>`).join('')}
                    </div>
                </div>` : ''}

                ${stepComps.length ? `<div class="audit-step-comps">
                    <h4><i class="ph ph-package"></i> Components Used</h4>
                    <div class="audit-comp-chips">
                        ${stepComps.map(c => `<span class="audit-comp-chip">
                            ${_esc(c.name)} <span class="audit-comp-pid">${_esc(c.pid)}</span>
                        </span>`).join('')}
                    </div>
                </div>` : ''}
            </div>
        </div>`;
    }).join('');
}

// ── Component BOM ────────────────────────────────────────
function renderAuditComponents(r) {
    const container = auditDOM['audit-components'];
    if (!container) return;

    const compSnap = r.component_snapshot || {};
    const entries = Object.values(compSnap);

    if (!entries.length) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No component snapshot available.</p>';
        return;
    }

    let html = '<div class="audit-bom-table">';
    html += `<div class="audit-bom-header">
        <span>Component</span><span>Category</span><span>Manufacturer</span><span>Price</span><span>Weight</span>
    </div>`;

    entries.forEach(c => {
        const weight = c.schema_data?.weight_g || c.schema_data?.weight || '—';
        html += `<div class="audit-bom-row">
            <span class="audit-bom-name">
                <strong>${_esc(c.name)}</strong>
                <span class="audit-comp-pid">${_esc(c.pid)}</span>
            </span>
            <span>${_esc(c.category || '—')}</span>
            <span>${_esc(c.manufacturer || '—')}</span>
            <span>${_esc(c.approx_price || '—')}</span>
            <span>${weight !== '—' ? weight + 'g' : '—'}</span>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

// ── Integrity Panel ──────────────────────────────────────
function renderAuditIntegrity(r) {
    const container = auditDOM['audit-integrity'];
    if (!container) return;

    const photos = r.photos || [];
    const events = r.events || [];
    const hasSnapshot = r.guide_snapshot && Object.keys(r.guide_snapshot).length > 0;
    const hasCompSnap = r.component_snapshot && Object.keys(r.component_snapshot).length > 0;

    const checks = [
        {
            label: 'Guide Snapshot',
            ok: hasSnapshot,
            detail: hasSnapshot ? `${r.guide_snapshot.steps?.length || 0} steps captured` : 'Not available',
        },
        {
            label: 'Component Snapshot',
            ok: hasCompSnap,
            detail: hasCompSnap ? `${Object.keys(r.component_snapshot).length} components captured` : 'Not available',
        },
        {
            label: 'Photo Integrity',
            ok: photos.length > 0 && photos.every(p => p.sha256),
            detail: photos.length === 0
                ? 'No photos captured'
                : `${photos.filter(p => p.sha256).length}/${photos.length} photos have SHA-256 hash`,
        },
        {
            label: 'Event Log',
            ok: events.length > 0,
            detail: `${events.length} events recorded`,
        },
        {
            label: 'Build Status',
            ok: r.status === 'completed',
            detail: r.status === 'completed' ? 'Build marked as completed' : `Status: ${r.status}`,
        },
    ];

    container.innerHTML = `<div class="audit-integrity-checks">
        ${checks.map(c => `<div class="audit-integrity-row">
            <span class="audit-integrity-badge ${c.ok ? 'verified' : 'warning'}">
                <i class="ph ${c.ok ? 'ph-seal-check' : 'ph-warning'}"></i>
                ${c.ok ? 'Pass' : 'Warn'}
            </span>
            <div>
                <strong>${_esc(c.label)}</strong>
                <span style="color:var(--text-muted); font-size:12px; margin-left:8px;">${_esc(c.detail)}</span>
            </div>
        </div>`).join('')}
    </div>

    ${photos.length > 0 ? `<div style="margin-top:20px;">
        <h4 style="font-size:13px; margin-bottom:8px;">Photo Hashes</h4>
        <div class="audit-hash-list">
            ${photos.map(p => `<div class="audit-hash-row">
                <span>Step ${p.step_order}</span>
                <code>${_esc(p.sha256 || 'no hash')}</code>
                <span class="audit-photo-time">${new Date(p.captured_at).toLocaleString()}</span>
            </div>`).join('')}
        </div>
    </div>` : ''}`;
}

// ── Utilities ────────────────────────────────────────────
function _esc(s) {
    if (typeof escHTML === 'function') return escHTML(s);
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
}

function _setText(id, text) {
    const el = auditDOM[id] || document.getElementById(id);
    if (el) el.textContent = text ?? '';
}

function _formatDateTime(d) {
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function _formatElapsed(ms) {
    if (!ms && ms !== 0) return '—';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}
