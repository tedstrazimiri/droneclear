/* ═══════════════════════════════════════════════════════════
   guide-camera.js — Camera capture + file upload
   ═══════════════════════════════════════════════════════════ */

let _capturedBlob = null;  // Holds the captured/selected image blob

// ── Open camera modal ────────────────────────────────────
async function openCamera() {
    const modal = guideDOM['camera-modal'];
    if (!modal) return;

    _capturedBlob = null;
    modal.classList.remove('hidden');

    // Reset UI
    guideDOM['camera-video']?.classList.remove('hidden');
    guideDOM['camera-preview']?.classList.add('hidden');
    guideDOM['btn-camera-capture']?.classList.remove('hidden');
    guideDOM['btn-camera-accept']?.classList.add('hidden');
    guideDOM['btn-camera-retake']?.classList.add('hidden');

    // Try getUserMedia (prefer rear camera on mobile)
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
        });
        guideState.cameraStream = stream;
        const video = guideDOM['camera-video'];
        if (video) {
            video.srcObject = stream;
            video.play();
        }
    } catch (err) {
        console.warn('Camera access denied or unavailable:', err);
        // Fall back to file input
        closeCamera();
        guideDOM['camera-file-input']?.click();
    }
}

// ── Close camera modal ───────────────────────────────────
function closeCamera() {
    // Stop all media tracks
    if (guideState.cameraStream) {
        guideState.cameraStream.getTracks().forEach(t => t.stop());
        guideState.cameraStream = null;
    }
    const video = guideDOM['camera-video'];
    if (video) video.srcObject = null;

    guideDOM['camera-modal']?.classList.add('hidden');
}

// ── Capture frame from video ─────────────────────────────
function captureFrame() {
    const video = guideDOM['camera-video'];
    const canvas = guideDOM['camera-canvas'];
    const preview = guideDOM['camera-preview'];
    if (!video || !canvas) return;

    const maxWidth = PHOTO_QUALITY_MAP[guideSettings.photoQuality] || 1280;

    // Scale canvas to quality setting
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (w > maxWidth) {
        h = Math.round(h * (maxWidth / w));
        w = maxWidth;
    }
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);

    // Convert to blob
    canvas.toBlob(blob => {
        _capturedBlob = blob;
        // Show preview
        if (preview) {
            preview.src = URL.createObjectURL(blob);
            preview.classList.remove('hidden');
        }
        video.classList.add('hidden');

        // Toggle buttons
        guideDOM['btn-camera-capture']?.classList.add('hidden');
        guideDOM['btn-camera-accept']?.classList.remove('hidden');
        guideDOM['btn-camera-retake']?.classList.remove('hidden');
    }, 'image/jpeg', 0.85);
}

// ── Retake photo ─────────────────────────────────────────
function retakePhoto() {
    _capturedBlob = null;
    guideDOM['camera-preview']?.classList.add('hidden');
    guideDOM['camera-video']?.classList.remove('hidden');
    guideDOM['btn-camera-capture']?.classList.remove('hidden');
    guideDOM['btn-camera-accept']?.classList.add('hidden');
    guideDOM['btn-camera-retake']?.classList.add('hidden');
}

// ── Accept and upload ────────────────────────────────────
async function acceptPhoto() {
    if (!_capturedBlob || !guideState.session) return;

    const g = guideState.selectedGuide;
    const step = g?.steps?.[guideState.currentStepIndex];
    if (!step) return;

    const sn = guideState.session.serial_number;
    const fd = new FormData();
    fd.append('image', _capturedBlob, `step-${step.order}.jpg`);
    fd.append('step', step.id);

    try {
        const result = await apiFetch(GUIDE_API.sessionPhotos(sn), {
            method: 'POST',
            body: fd,
        });

        // Track photo locally
        if (!guideState.photos[step.order]) guideState.photos[step.order] = [];
        guideState.photos[step.order].push(result.image_url || result.image);

        // Refresh gallery
        renderStepPhotos(step);

        closeCamera();

        // Auto-advance if enabled
        if (guideSettings.autoAdvance) {
            const steps = g.steps || [];
            if (guideState.currentStepIndex < steps.length - 1) {
                renderStep(guideState.currentStepIndex + 1);
            }
        }
    } catch (err) {
        console.error('Photo upload failed:', err);
        alert('Failed to upload photo. Please try again.');
    }
}

// ── File input fallback ──────────────────────────────────
function handleFileSelect(file) {
    if (!file) return;

    const maxWidth = PHOTO_QUALITY_MAP[guideSettings.photoQuality] || 1280;

    // Resize via canvas if needed
    const img = new Image();
    img.onload = () => {
        const canvas = guideDOM['camera-canvas'] || document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
            h = Math.round(h * (maxWidth / w));
            w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);

        canvas.toBlob(blob => {
            _capturedBlob = blob;
            // Upload directly (no preview needed for file picker)
            acceptPhoto();
        }, 'image/jpeg', 0.85);
    };
    img.src = URL.createObjectURL(file);
}

// ── Wire up camera buttons ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-close-camera')?.addEventListener('click', closeCamera);
    document.getElementById('btn-camera-capture')?.addEventListener('click', captureFrame);
    document.getElementById('btn-camera-retake')?.addEventListener('click', retakePhoto);
    document.getElementById('btn-camera-accept')?.addEventListener('click', acceptPhoto);

    document.getElementById('btn-camera-file')?.addEventListener('click', () => {
        guideDOM['camera-file-input']?.click();
    });

    document.getElementById('camera-file-input')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelect(file);
        e.target.value = ''; // Reset so same file can be re-selected
    });
});
