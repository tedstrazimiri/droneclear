/* ═══════════════════════════════════════════════════════════
   guide-runner.js — Step-by-step engine, session management
   ═══════════════════════════════════════════════════════════ */

// ── Animation state ──────────────────────────────────────
let _isFirstRender = true;
let _renderLock = false;

// ── Media carousel state ─────────────────────────────────
let _mediaItems = [];
let _mediaIndex = 0;
let _lightboxOpen = false;

// ── Render a step (with transition animation) ────────────
function renderStep(index) {
    const g = guideState.selectedGuide;
    if (!g || !g.steps?.length) return;
    if (_renderLock && !_isFirstRender) return;

    const steps = g.steps;
    const step = steps[index];
    if (!step) return;

    const stepContent = document.querySelector('.guide-step-content');
    const photoArea = document.querySelector('.guide-runner-extras');

    if (_isFirstRender || !stepContent) {
        _isFirstRender = false;
        _populateStep(index, step, steps);
        if (stepContent) {
            stepContent.classList.add('step-entering');
            photoArea?.classList.add('step-entering');
            setTimeout(() => {
                stepContent.classList.remove('step-entering');
                photoArea?.classList.remove('step-entering');
            }, 350);
        }
        return;
    }

    // Subsequent renders — exit then enter
    _renderLock = true;
    stepContent.classList.add('step-exiting');

    setTimeout(() => {
        _populateStep(index, step, steps);
        stepContent.classList.remove('step-exiting');
        stepContent.classList.add('step-entering');
        photoArea?.classList.add('step-entering');

        setTimeout(() => {
            stepContent.classList.remove('step-entering');
            photoArea?.classList.remove('step-entering');
            _renderLock = false;
        }, 300);
    }, 150);
}

// ── Populate step content (extracted from renderStep) ────
function _populateStep(index, step, steps) {
    // Record time for previous step (timer feature)
    if (typeof recordStepTime === 'function') recordStepTime();

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

    // Description (markdown-rendered if available)
    if (typeof renderStepDescription === 'function') {
        renderStepDescription(step);
    } else {
        setText('runner-step-description', step.description || '');
    }

    // Media carousel
    renderStepMedia(step);

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

    // Step notes (load saved notes for this step)
    if (typeof loadStepNotes === 'function') loadStepNotes(step);

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

// ── Timer ────────────────────────────────────────────────
function formatTimer(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startBuildTimer() {
    guideState.buildStartTime = Date.now();
    guideState.stepStartTime = Date.now();
    guideState.stepElapsed = {};
    guideState.timerInterval = setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const now = Date.now();

    // Build elapsed
    const buildVal = document.getElementById('timer-build-value');
    if (buildVal && guideState.buildStartTime) {
        buildVal.textContent = formatTimer(now - guideState.buildStartTime);
    }

    // Step elapsed
    const stepVal = document.getElementById('timer-step-value');
    if (stepVal && guideState.stepStartTime) {
        const stepMs = now - guideState.stepStartTime;
        stepVal.textContent = formatTimer(stepMs);

        // Compare to estimate — highlight amber if over
        const step = guideState.selectedGuide?.steps?.[guideState.currentStepIndex];
        const badge = document.getElementById('timer-step-elapsed');
        if (step && badge) {
            const estimateMs = (step.estimated_time_minutes || 5) * 60000;
            badge.classList.toggle('over-estimate', stepMs > estimateMs);
        }
    }

    // Nav bar estimate comparison
    const estVal = document.getElementById('timer-estimate-value');
    if (estVal && guideState.selectedGuide) {
        const totalEstimate = guideState.selectedGuide.estimated_time_minutes || 0;
        const buildMs = guideState.buildStartTime ? (now - guideState.buildStartTime) : 0;
        const actualMin = Math.floor(buildMs / 60000);
        estVal.textContent = `${actualMin} / ${totalEstimate} min`;
    }
}

function recordStepTime() {
    if (guideState.stepStartTime) {
        const step = guideState.selectedGuide?.steps?.[guideState.currentStepIndex];
        if (step) {
            const elapsed = Date.now() - guideState.stepStartTime;
            guideState.stepElapsed[step.order] = (guideState.stepElapsed[step.order] || 0) + elapsed;
        }
    }
    guideState.stepStartTime = Date.now();
}

function stopBuildTimer() {
    if (guideState.timerInterval) {
        clearInterval(guideState.timerInterval);
        guideState.timerInterval = null;
    }
}

// ── Step Notes ──────────────────────────────────────────
let _notesSaveTimer = null;

function loadStepNotes(step) {
    const textarea = document.getElementById('runner-step-notes');
    if (!textarea) return;
    const stepNotes = guideState.session?.step_notes || {};
    textarea.value = stepNotes[String(step.order)] || '';
}

function saveStepNotes() {
    const textarea = document.getElementById('runner-step-notes');
    if (!textarea || !guideState.session) return;

    const step = guideState.selectedGuide?.steps?.[guideState.currentStepIndex];
    if (!step) return;

    // Update local state immediately
    if (!guideState.session.step_notes) guideState.session.step_notes = {};
    guideState.session.step_notes[String(step.order)] = textarea.value;

    // Show "Saving..." indicator
    const status = document.getElementById('notes-save-status');
    if (status) {
        status.textContent = 'Saving...';
        status.className = 'guide-notes-status visible saving';
    }

    // Debounced save to server
    clearTimeout(_notesSaveTimer);
    _notesSaveTimer = setTimeout(async () => {
        try {
            await apiFetch(GUIDE_API.sessionDetail(guideState.session.serial_number), {
                method: 'PATCH',
                body: JSON.stringify({ step_notes: guideState.session.step_notes }),
            });
            if (status) {
                status.textContent = 'Saved';
                status.className = 'guide-notes-status visible saved';
                setTimeout(() => { status.className = 'guide-notes-status'; }, 2000);
            }
        } catch (err) {
            console.warn('Failed to save step notes:', err);
            if (status) {
                status.textContent = 'Save failed';
                status.className = 'guide-notes-status visible saving';
            }
        }
    }, 800);
}

function flushPendingNotes() {
    if (_notesSaveTimer) {
        clearTimeout(_notesSaveTimer);
        _notesSaveTimer = null;
        // Save immediately
        const textarea = document.getElementById('runner-step-notes');
        if (textarea && guideState.session?.step_notes) {
            apiFetch(GUIDE_API.sessionDetail(guideState.session.serial_number), {
                method: 'PATCH',
                body: JSON.stringify({ step_notes: guideState.session.step_notes }),
            }).catch(err => console.warn('Failed to flush step notes:', err));
        }
    }
}

// ── Markdown + Checklists ─────────────────────────────────
function renderStepDescription(step) {
    const el = guideDOM['runner-step-description'];
    if (!el) return;

    let raw = step.description || '';
    if (!raw) { el.innerHTML = ''; return; }

    // Extract checklist lines: "- [ ] text" or "- [x] text"
    const checklistRegex = /^- \[([ x])\] (.+)$/gm;
    const checklistItems = [];
    let match;
    while ((match = checklistRegex.exec(raw)) !== null) {
        checklistItems.push({
            checked: match[1] === 'x',
            text: match[2],
            fullMatch: match[0],
        });
    }

    // Remove checklist lines from raw markdown
    let markdownPart = raw;
    checklistItems.forEach(item => {
        markdownPart = markdownPart.replace(item.fullMatch, '');
    });

    // Render markdown
    let html = '';
    if (typeof snarkdown === 'function') {
        html = snarkdown(markdownPart.trim());
    } else {
        // Fallback: plain text with line breaks
        html = `<p>${escHTML(markdownPart).replace(/\n/g, '<br>')}</p>`;
    }

    // Render interactive checklist
    if (checklistItems.length > 0) {
        const savedState = guideState.stepChecklists?.[step.order] || {};
        html += '<div class="guide-step-checklist">';
        checklistItems.forEach((item, i) => {
            const isChecked = savedState[i] !== undefined ? savedState[i] : item.checked;
            const checkedClass = isChecked ? ' checked' : '';
            const checkedAttr = isChecked ? ' checked' : '';
            const renderedText = typeof snarkdown === 'function' ? snarkdown(item.text) : escHTML(item.text);
            html += `<label class="guide-step-checklist-item${checkedClass}">
                <input type="checkbox"${checkedAttr} data-step-order="${step.order}" data-check-index="${i}"
                       onchange="toggleStepChecklist(${step.order}, ${i}, this.checked, this.parentElement)">
                <span>${renderedText}</span>
            </label>`;
        });
        html += '</div>';
    }

    el.innerHTML = html;
}

function toggleStepChecklist(stepOrder, index, checked, labelEl) {
    if (labelEl) labelEl.classList.toggle('checked', checked);
    if (!guideState.stepChecklists) guideState.stepChecklists = {};
    if (!guideState.stepChecklists[stepOrder]) guideState.stepChecklists[stepOrder] = {};
    guideState.stepChecklists[stepOrder][index] = checked;
}

// ── Media Carousel ───────────────────────────────────────

function detectMediaType(url) {
    if (!url) return 'image';
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('vimeo.com')) return 'video';
    if (lower.match(/\.(mp4|webm|ogg)(\?|$)/)) return 'video';
    return 'image';
}

function toEmbedUrl(url) {
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
    const vim = url.match(/vimeo\.com\/(\d+)/);
    if (vim) return `https://player.vimeo.com/video/${vim[1]}`;
    return url;
}

function renderStepMedia(step) {
    const carousel = guideDOM['runner-media-carousel'];
    const track = guideDOM['media-track'];
    if (!carousel || !track) return;

    // Build media array — support new field and old fallback
    let items = [];
    if (step.media && step.media.length) {
        items = step.media;
    } else if (step.reference_image) {
        items = [{ type: 'image', url: step.reference_image, caption: '' }];
    }

    _mediaItems = items;
    _mediaIndex = 0;

    if (!items.length) {
        carousel.classList.add('hidden');
        return;
    }

    carousel.classList.remove('hidden');
    carousel.setAttribute('data-count', items.length);

    // Build slides
    track.innerHTML = items.map((item, i) => {
        const type = item.type || detectMediaType(item.url);
        if (type === 'video') {
            if (item.url.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
                return `<div class="guide-media-slide" data-index="${i}">
                    <video controls preload="metadata" src="${escHTML(item.url)}"></video>
                </div>`;
            }
            return `<div class="guide-media-slide" data-index="${i}">
                <iframe src="${escHTML(toEmbedUrl(item.url))}" allowfullscreen loading="lazy"></iframe>
            </div>`;
        }
        return `<div class="guide-media-slide" data-index="${i}">
            <img src="${escHTML(item.url)}" alt="${escHTML(item.caption || 'Reference')}"
                 loading="${i === 0 ? 'eager' : 'lazy'}" onclick="openLightbox(${i})">
        </div>`;
    }).join('');

    // Build dots
    const dotsEl = guideDOM['media-dots'];
    if (dotsEl) {
        dotsEl.innerHTML = items.map((_, i) =>
            `<button class="guide-media-dot${i === 0 ? ' active' : ''}" data-index="${i}"
                     onclick="goToMedia(${i})" aria-label="Go to media ${i + 1}"></button>`
        ).join('');
    }

    track.style.transform = 'translateX(0)';
    updateMediaCaption(0);
}

function goToMedia(index) {
    if (index < 0 || index >= _mediaItems.length) return;
    _mediaIndex = index;

    const track = guideDOM['media-track'];
    if (track) track.style.transform = `translateX(-${index * 100}%)`;

    const dots = guideDOM['media-dots']?.querySelectorAll('.guide-media-dot');
    dots?.forEach((dot, i) => dot.classList.toggle('active', i === index));

    updateMediaCaption(index);

    if (_lightboxOpen) renderLightboxSlide(index);
}

function updateMediaCaption(index) {
    const captionEl = guideDOM['media-caption'];
    if (captionEl) captionEl.textContent = _mediaItems[index]?.caption || '';
}

function openLightbox(index) {
    _lightboxOpen = true;
    _mediaIndex = typeof index === 'number' ? index : _mediaIndex;
    const overlay = guideDOM['media-lightbox'];
    if (overlay) overlay.classList.remove('hidden');
    renderLightboxSlide(_mediaIndex);
    renderLightboxDots();
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    _lightboxOpen = false;
    const overlay = guideDOM['media-lightbox'];
    if (overlay) overlay.classList.add('hidden');
    document.body.style.overflow = '';
}

function renderLightboxSlide(index) {
    const viewport = guideDOM['lightbox-viewport'];
    const captionEl = guideDOM['lightbox-caption'];
    if (!viewport) return;

    const item = _mediaItems[index];
    if (!item) return;

    const type = item.type || detectMediaType(item.url);
    if (type === 'video') {
        if (item.url.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
            viewport.innerHTML = `<video controls autoplay src="${escHTML(item.url)}"></video>`;
        } else {
            viewport.innerHTML = `<iframe src="${escHTML(toEmbedUrl(item.url))}" allowfullscreen></iframe>`;
        }
    } else {
        viewport.innerHTML = `<img src="${escHTML(item.url)}" alt="${escHTML(item.caption || 'Reference')}">`;
    }

    if (captionEl) captionEl.textContent = item.caption || '';

    const dots = guideDOM['lightbox-dots']?.querySelectorAll('.guide-media-dot');
    dots?.forEach((dot, i) => dot.classList.toggle('active', i === index));
}

function renderLightboxDots() {
    const dotsEl = guideDOM['lightbox-dots'];
    if (!dotsEl) return;
    dotsEl.innerHTML = _mediaItems.map((_, i) =>
        `<button class="guide-media-dot${i === _mediaIndex ? ' active' : ''}" data-index="${i}"
                 onclick="goToMedia(${i})" aria-label="Go to media ${i + 1}"></button>`
    ).join('');
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

    // Step notes auto-save
    document.getElementById('runner-step-notes')?.addEventListener('input', saveStepNotes);

    // Media carousel navigation
    document.getElementById('media-prev')?.addEventListener('click', () => {
        if (_mediaIndex > 0) goToMedia(_mediaIndex - 1);
    });
    document.getElementById('media-next')?.addEventListener('click', () => {
        if (_mediaIndex < _mediaItems.length - 1) goToMedia(_mediaIndex + 1);
    });
    document.getElementById('media-expand')?.addEventListener('click', () => openLightbox());

    // Lightbox controls
    document.getElementById('lightbox-close')?.addEventListener('click', closeLightbox);
    document.getElementById('lightbox-prev')?.addEventListener('click', () => {
        if (_mediaIndex > 0) goToMedia(_mediaIndex - 1);
    });
    document.getElementById('lightbox-next')?.addEventListener('click', () => {
        if (_mediaIndex < _mediaItems.length - 1) goToMedia(_mediaIndex + 1);
    });
    document.getElementById('media-lightbox')?.addEventListener('click', (e) => {
        if (e.target.id === 'media-lightbox' || e.target.classList.contains('guide-lightbox-content')) {
            closeLightbox();
        }
    });

    // Keyboard: arrows in lightbox, escape to close
    document.addEventListener('keydown', (e) => {
        if (_lightboxOpen) {
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft' && _mediaIndex > 0) goToMedia(_mediaIndex - 1);
            if (e.key === 'ArrowRight' && _mediaIndex < _mediaItems.length - 1) goToMedia(_mediaIndex + 1);
        }
    });

    // Back to guides from completed
    document.getElementById('btn-back-to-guides')?.addEventListener('click', () => {
        loadGuideList().then(() => setGuidePhase('selection'));
    });
});

// ── Session completion ───────────────────────────────────
async function completeSession() {
    if (!guideState.session) return;

    // Record final step time and stop timer
    recordStepTime();
    stopBuildTimer();
    flushPendingNotes();

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

        // Duration — use build timer if available, fallback to server timestamps
        let diffMin;
        if (guideState.buildStartTime) {
            diffMin = Math.round((Date.now() - guideState.buildStartTime) / 60000);
        } else {
            const started = new Date(guideState.session.started_at);
            const ended = new Date(now);
            diffMin = Math.round((ended - started) / 60000);
        }
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
