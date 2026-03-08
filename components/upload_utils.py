"""
upload_utils.py — Shared file upload validation for DroneClear.

Used by GuideMediaUploadView and StepPhotoUploadView.
Designed for easy migration to cloud storage backends (S3, Azure, etc.).
"""

import uuid

from PIL import Image
from django.core.exceptions import ValidationError


# ── Size limits ───────────────────────────────────────────
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

# ── Allowed MIME types ────────────────────────────────────
ALLOWED_IMAGE_MIMES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
ALLOWED_VIDEO_MIMES = {'video/mp4', 'video/webm'}
ALLOWED_MEDIA_MIMES = ALLOWED_IMAGE_MIMES | ALLOWED_VIDEO_MIMES

# ── MIME → extension mapping (for UUID filenames) ─────────
MIME_TO_EXT = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
}


def validate_upload_size(file, max_bytes=MAX_UPLOAD_SIZE_BYTES):
    """Reject files exceeding max size."""
    if file.size > max_bytes:
        max_mb = max_bytes / (1024 * 1024)
        raise ValidationError(f'File too large. Maximum size is {max_mb:.0f} MB.')


def validate_upload_mime(file, allowed_mimes=ALLOWED_MEDIA_MIMES):
    """Reject files with disallowed MIME types."""
    if file.content_type not in allowed_mimes:
        raise ValidationError(
            f'File type "{file.content_type}" not allowed. '
            f'Allowed: {", ".join(sorted(allowed_mimes))}'
        )


def validate_image_content(file):
    """Verify the file is a real image via PIL (magic byte check). Resets seek position."""
    try:
        img = Image.open(file)
        img.verify()
        file.seek(0)
    except Exception:
        file.seek(0)
        raise ValidationError('File does not appear to be a valid image.')


def validate_uploaded_file(file, allowed_mimes=ALLOWED_MEDIA_MIMES, max_bytes=MAX_UPLOAD_SIZE_BYTES):
    """
    Full validation pipeline: size, MIME type, and content verification for images.
    Returns (media_type, extension) on success.
    """
    validate_upload_size(file, max_bytes)
    validate_upload_mime(file, allowed_mimes)

    is_image = file.content_type in ALLOWED_IMAGE_MIMES
    if is_image:
        validate_image_content(file)

    media_type = 'image' if is_image else 'video'
    ext = MIME_TO_EXT.get(file.content_type, '')
    return media_type, ext


def guide_media_upload_path(instance, filename):
    """
    Generate compartmentalized upload path: guide_media/<guide_pid>/<uuid>.<ext>.
    Enables per-guide access policies when migrating to secured storage.
    """
    ext = ''
    if '.' in filename:
        ext = '.' + filename.rsplit('.', 1)[1].lower()
    # Override extension from MIME if available
    if hasattr(instance, 'content_type') and instance.content_type in MIME_TO_EXT:
        ext = MIME_TO_EXT[instance.content_type]
    guide_pid = instance.guide.pid if instance.guide else 'unlinked'
    return f'guide_media/{guide_pid}/{uuid.uuid4().hex}{ext}'
