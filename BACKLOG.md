# DroneClear Backlog

> **Single source of truth** for all tracked issues, bugs, and feature requests.
> Each item has a permanent ID. Do NOT duplicate items — update existing entries.
> When completing an item, move it to the Completed section with the session date.

## How to Use This File

- Before starting work, read the full backlog
- Before adding an item, **search by keyword** to avoid duplicates
- Use the next available ID in the appropriate prefix
- When completing an item, move it to "Completed" at the bottom with the date

## ID Prefixes

- `SEC-` — Security issues
- `BUG-` — Bugs and data integrity issues
- `DEBT-` — Technical debt and code quality
- `FEAT-` — Feature requests and enhancements
- `POLISH-` — Low-priority polish and cleanup

---

## Critical — Security

| ID | Issue | Location | Description | Added |
|----|-------|----------|-------------|-------|
| SEC-001 | No API authentication | `views.py` (all views) | Every endpoint is anonymous. No `permission_classes`. Must lock down before external access. | 2026-03-06 |
| SEC-002 | Unauthenticated server restart | `views.py:RestartServerView` | `POST /api/maintenance/restart/` allows anyone to restart. DoS vector. | 2026-03-06 |
| SEC-003 | No file size/type validation | `views.py:StepPhotoUploadView` | No max size check. No validation that uploaded file is actually an image. Could exhaust disk. | 2026-03-06 |
| SEC-004 | Bug report disk exhaustion | `views.py:BugReportView` | No rate limiting. Unlimited file writes to `bug_reports/`. | 2026-03-06 |
| SEC-005 | Schema overwrite no backup | `views.py:SchemaView.post()` | Overwrites schema directly with no backup copy. Corruption risk on failure. | 2026-03-06 |

## High — Data Integrity

| ID | Issue | Location | Description | Added |
|----|-------|----------|-------------|-------|
| BUG-001 | Guide update cascade-deletes photos | `serializers.py:88` | `update()` deletes all steps then recreates. CASCADE destroys all photos across sessions. Need atomic update-in-place. | 2026-03-06 |
| BUG-002 | Serial number race condition | `views.py:~295` | Concurrent `POST /api/build-sessions/` can generate duplicate SNs. Need `select_for_update()`. | 2026-03-06 |
| BUG-003 | BuildEvent CASCADE breaks immutability | `models.py:159` | `on_delete=CASCADE` means deleting session destroys audit trail. Consider `PROTECT`. | 2026-03-06 |
| BUG-004 | No transaction wrapping | Multiple files | `ImportPartsView`, `ResetToGoldenView`, `perform_create()`, `BuildGuideDetailSerializer.update()` lack `transaction.atomic()`. | 2026-03-06 |

## Medium — Technical Debt

| ID | Issue | Location | Description | Added |
|----|-------|----------|-------------|-------|
| DEBT-001 | Dead code: `notesHtml` | `modal.js:83-84, 144-149` | Declared but never populated. Dead conditional. | 2026-03-06 |
| DEBT-002 | Missing i18n key | `components.js:21` / `state.js` | `i18n[currentLang].errLoadDesc` undefined. Shows `undefined` in error. | 2026-03-06 |
| DEBT-003 | Duplicate Escape handlers | `app.js:35-43` + `shortcuts.js:62-81` | Both register keydown for Escape. app.js handler now redundant. | 2026-03-06 |
| DEBT-004 | `body *` transition perf | `base.css:98-100` | Applies transition to every DOM element. Performance hit on 100+ cards. | 2026-03-06 |
| DEBT-005 | Event listener stacking | `guide-editor.js:501` | `_closePickerOnOutsideClick` stacks on document every step selection. | 2026-03-06 |
| DEBT-006 | Weight filter race condition | `filters.js:515` | Shared debounce timer between min/max cancels callbacks. | 2026-03-06 |
| DEBT-007 | Maintenance script duplicated | `index.html`, `editor.html`, `template.html` | ~80 lines identical JS across 3 files. Extract to `maintenance.js`. | 2026-03-06 |
| DEBT-008 | Inline styles in template.html | `template.html` | 8+ identical style blocks on modal inputs. Should be CSS class. | 2026-03-06 |

## Low — Polish

| ID | Issue | Location | Description | Added |
|----|-------|----------|-------------|-------|
| POLISH-001 | `null=True` on text fields | `models.py:14-19, 30-33` | Should be `blank=True, default=""` per Django convention. | 2026-03-06 |
| POLISH-002 | `unique_together` deprecated | `models.py:99` | Replace with `UniqueConstraint`. | 2026-03-06 |
| POLISH-003 | Duplicate `/editor/` route | `urls.py:28` | Both `/library/` and `/editor/` serve same view. Use `RedirectView`. | 2026-03-06 |
| POLISH-004 | `STATICFILES_STORAGE` deprecated | `settings/prod.py:30` | Use `STORAGES` dict (Django 4.2+). | 2026-03-06 |
| POLISH-005 | `ALLOWED_HOSTS` empty string | `settings/prod.py:12` | Unset env var gives `['']` not `[]`. | 2026-03-06 |
| POLISH-006 | Missing prod security settings | `settings/prod.py` | No `SECURE_SSL_REDIRECT`, `SECURE_HSTS_*`. | 2026-03-06 |
| POLISH-007 | `asgi.py` uses dev settings | `droneclear_backend/asgi.py:14` | Points to `settings.dev` while `wsgi.py` points to `settings.prod`. | 2026-03-06 |
| POLISH-008 | No admin registration | `admin.py` | Models not registered in Django admin. | 2026-03-06 |
| POLISH-009 | Missing `<label>` elements | All 5 HTML pages | Search inputs lack `<label>` for screen readers. | 2026-03-06 |
| POLISH-010 | Guide cards not keyboard-accessible | `guide-selection.js:72` | Cards use `onclick` on `div`, no `tabindex` or `role`. | 2026-03-06 |
| POLISH-011 | Three.js memory leak | `guide-viewer.js` | `destroySTLViewer` doesn't dispose geometries/materials. | 2026-03-06 |
| POLISH-012 | Camera blob URL not revoked | `guide-camera.js:82-83` | `URL.createObjectURL` never revoked. | 2026-03-06 |
| POLISH-013 | Global scope pollution | All JS files | No module system. Risk of naming collisions. | 2026-03-06 |
| POLISH-014 | `components.css` is 2800+ lines | `components.css` | Should split into focused files. | 2026-03-06 |
| POLISH-015 | No cache-busting on guide/audit | `guide.html`, `audit.html` | Script tags lack `?v=` unlike other pages. | 2026-03-06 |

## Feature Requests

| ID | Feature | Description | Added |
|----|---------|-------------|-------|
| FEAT-001 | Component cloning | Duplicate an existing part or schema category to speed up data entry. | 2026-03-06 |
| FEAT-002 | Build export | Export a completed build to CSV or PDF from the wizard. | 2026-03-06 |
| FEAT-003 | Photo AI analysis | Run CV models on captured step photos for quality assurance. | 2026-03-06 |
| FEAT-004 | Schema audit logging | Track who changed what in the schema and parts library. | 2026-03-06 |
| FEAT-005 | Tag vocabulary | Controlled tag taxonomy per category instead of free-form strings. | 2026-03-06 |
| FEAT-006 | Additional data sources | Scrape GetFPV, RaceDayQuads, or manufacturer sites for broader coverage. | 2026-03-06 |
| FEAT-007 | Media upload | Direct file upload for guide step media (currently URL-only). | 2026-03-06 |
| FEAT-008 | Build guide versioning | Track guide revisions so sessions reference a specific version. | 2026-03-06 |
| FEAT-009 | Audit PDF export | Generate downloadable PDF audit reports from the audit viewer. | 2026-03-06 |

---

## Completed

| ID | Issue | Completed | Session |
|----|-------|-----------|---------|
| ~~XSS-M1~~ | `components.js` innerHTML XSS | 2026-03-06 | 2026-03-06-3 |
| ~~XSS-M2~~ | `modal.js` innerHTML XSS | 2026-03-06 | 2026-03-06-3 |
| ~~XSS-M3~~ | `build.js` innerHTML XSS | 2026-03-06 | 2026-03-06-3 |
| ~~XSS-M4~~ | `persist.js` innerHTML XSS | 2026-03-06 | 2026-03-06-3 |
| ~~XSS-M5~~ | `editor.js` innerHTML XSS | 2026-03-06 | 2026-03-06-3 |
| ~~FEAT-010~~ | Golden seed system (3,113 real parts auto-seeded) | 2026-03-07 | 2026-03-07-1 |
| ~~FEAT-011~~ | Reset to Examples button on all pages | 2026-03-07 | 2026-03-07-1 |
| ~~FEAT-012~~ | Build Components quick-select panel in guide step editor | 2026-03-07 | 2026-03-07-1 |
| ~~BUG-005~~ | `getCookie is not defined` on guide page (missing utils.js import) | 2026-03-07 | 2026-03-07-1 |
| ~~BUG-006~~ | Schema field mismatch — 79 seed fields missing from schema blueprints | 2026-03-07 | 2026-03-07-1 |
| ~~BUG-007~~ | Guide save fails with blank step title/description (DRF 400 validation) | 2026-03-07 | 2026-03-07-1 |
