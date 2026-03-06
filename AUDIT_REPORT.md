# DroneClear Comprehensive Codebase Audit Report

**Date**: 2026-03-06
**Auditor**: Claude (Opus 4.6)
**Scope**: Full codebase — backend, frontend JS (19 files), CSS (6 files), HTML (5 templates), root-level organization
**Branch**: `claude/trusting-galileo`

---

## Executive Summary

The DroneClear codebase is well-architected for a vanilla JS + Django project at this scale. The code is logically organized, the module separation is clean, and the feature set (10 tiers) is impressive. However, the rapid development pace has left behind some technical debt that this audit addresses.

### What Was Fixed In This Session

| Category | Fix | Files Changed |
|----------|-----|---------------|
| **XSS (Critical)** | `showToast()` now escapes HTML in message parameter via new `escapeHTML()` function | `utils.js` |
| **Regex Bug** | `template.js` category key generation: `/s+/g` → `/\s+/g` (was removing letter 's' instead of whitespace) | `template.js` |
| **Broken DOM** | Removed orphaned `#modal-link` element and 3 extra `</div>` tags floating outside modal in index.html | `index.html` |
| **Keyboard Shortcuts** | Fixed `shortcuts.js` checking for non-existent `'open'` class on build drawer (should check `!contains('closed')`) | `shortcuts.js` |
| **CSRF Tokens** | Added `X-CSRFToken` header to 10+ mutating API calls across `editor.js`, `template.js`, `guide-state.js`, `guide-editor.js` | 4 JS files |
| **Missing CSS Variables** | Added `--accent-purple`, `--accent-green`, `--accent-cyan`, `--negative-red` to both light and dark themes | `base.css` |
| **Missing Dependency** | Added `Pillow>=10.0` to `requirements.txt` (required by `ImageField`) | `requirements.txt` |
| **Dependency Pins** | Added version bounds to all dependencies | `requirements.txt` |
| **Dead Code** | Removed dead `.sidebar-meta` CSS, duplicate `.card-thumb width`, orphaned `.grid-container` selector | `components.css`, `utilities.css` |
| **File Cleanup** | Deleted `diff_output.txt`, `diff_utf8.txt`, `temp_template.html`, `bump_font.py`; moved historical files to `archive/` | Root level |
| **Settings Cleanup** | Moved orphaned flat `settings.py` to `archive/settings_legacy_flat.py` | `droneclear_backend/` |
| **Import Cleanup** | Consolidated all imports to top of `views.py`; removed duplicate `import datetime` | `views.py` |
| **Code Comments** | Added module docstrings to `models.py`, `views.py`, `serializers.py`; added docstrings to all models and viewsets | 3 backend files |
| **Stale Reference** | Updated error message from `drone_parts_schema_v2.json` → generic message | `index.html` |
| **Bug Fix** | Fixed `datetime.now()` → `timezone.now()` in `BugReportView` | `views.py` |
| **.gitignore** | Added `bug_reports/*.txt`, `media/`, `diff_*.txt`, `*.sqlite3-journal`, `*.bak`, `node_modules/` | `.gitignore` |
| **Query Optimization** | Added `select_related('category')` to `ComponentViewSet.get_queryset()` | `views.py` |
| **Model Fix** | Added `verbose_name_plural = "Categories"` to Category Meta | `models.py` |
| **Import Button UX** | Import button was hidden until a category was selected — impossible to bootstrap an empty DB. Now always visible on Parts Library Editor. | `editor.html`, `editor.js` |
| **Reset to Golden** | New `POST /api/maintenance/reset-to-golden/` endpoint + UI button in system drawer. Wipes all data and re-seeds from golden schema. Confirmation dialog, spinner, and success summary. | `views.py`, `urls.py`, `index.html`, `editor.html`, `template.html` |

---

## Remaining Issues — Prioritized Backlog

### CRITICAL — Security (Address Before Any Public Deployment)

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| C1 | **No authentication on API** | `views.py` (all views) | Every endpoint is fully anonymous. No `permission_classes`, no global `DEFAULT_PERMISSION_CLASSES`. Anyone can create/delete/modify all data, restart the server, or overwrite the schema. For internal-only use this is acceptable, but must be locked down before any external access. |
| C2 | **Unauthenticated server restart** | `views.py:RestartServerView` | `POST /api/maintenance/restart/` allows anyone to restart the server. DoS vector. |
| C3 | **No file size/type validation on uploads** | `views.py:StepPhotoUploadView` | No max file size check. No validation that uploaded file is actually an image. Could exhaust disk. |
| C4 | **Bug report disk exhaustion** | `views.py:BugReportView` | No rate limiting. Unlimited file writes to `bug_reports/`. |
| C5 | **Schema file no backup** | `views.py:SchemaView.post()` | Overwrites schema directly with no backup copy. Disk full or power loss mid-write corrupts the file. |

**Recommended Fix**: Add to `settings/base.py`:
```python
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_THROTTLE_CLASSES': ['rest_framework.throttling.AnonRateThrottle'],
    'DEFAULT_THROTTLE_RATES': {'anon': '100/hour'},
}
```

### HIGH — Data Integrity

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| H1 | **Guide update cascade-deletes photos** | `serializers.py:88` | `BuildGuideDetailSerializer.update()` deletes all steps then recreates them. Due to `StepPhoto.step` FK with `CASCADE`, this destroys all photos across all sessions for that guide. Needs `transaction.atomic()` and a step-update-in-place strategy instead of delete-recreate. |
| H2 | **Serial number race condition** | `views.py:~295` | Two concurrent `POST /api/build-sessions/` requests could generate the same serial number. The filter/increment pattern is not atomic. Need `select_for_update()` or a retry loop with `IntegrityError` catch. |
| H3 | **BuildEvent CASCADE undermines immutability** | `models.py:159` | `BuildEvent.session` uses `on_delete=CASCADE`. Deleting a session destroys audit trail. Consider `PROTECT` for audit integrity. |
| H4 | **No transaction wrapping** | Multiple files | `ImportPartsView`, `BuildSessionViewSet.perform_create()`, `reset_to_golden` command all run multi-step operations without `transaction.atomic()`. Failures leave partial data. |

### MEDIUM — Frontend XSS (Partially Fixed)

The `showToast()` XSS is fixed. The following innerHTML usages still inject unescaped database content:

| # | File | Lines | Risk |
|---|------|-------|------|
| M1 | `components.js` | 300, 346, 365-387 | Component name, manufacturer, tags, description injected into card innerHTML |
| M2 | `modal.js` | 79, 112, 138, 213-219 | Spec values, tag values, similar item cards |
| M3 | `build.js` | 116, 317-318 | Build slot component names, warning messages |
| M4 | `persist.js` | 13, 89-108 | Saved build names, descriptions |
| M5 | `editor.js` | 249-257 | Item row PIDs and names |

**Recommended Fix**: Use the `escapeHTML()` function (now in `utils.js`) for all user/database data injected via innerHTML. The guide module (`guide-selection.js`, `guide-runner.js`) already uses `escHTML()` consistently — follow that pattern.

### MEDIUM — Code Quality

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| M6 | **Dead code: `notesHtml`** | `modal.js:83-84, 144-149` | `notesHtml` is declared but never populated. Always empty. The conditional check is dead code. |
| M7 | **Missing i18n key** | `components.js:21` → `state.js` | `i18n[currentLang].errLoadDesc` referenced but not defined in `i18n` object. Shows `undefined` in error messages. |
| M8 | **Duplicate Escape handlers** | `app.js:35-43` + `shortcuts.js:62-81` | Both register `keydown` listeners for Escape. Now that shortcuts.js is fixed, the app.js handler is redundant. |
| M9 | **`body *` transition** | `base.css:98-100` | `body * { transition: ... }` applies transitions to every DOM element. Performance concern on pages with 100+ cards during theme switch. |
| M10 | **Event listener stacking** | `guide-editor.js:501` | `_closePickerOnOutsideClick` listener added to `document` every time a step is selected. Stacks after N step selections. |
| M11 | **Weight filter race condition** | `filters.js:515` | `weightDebounceTimer` shared between min and max inputs. Rapid typing in Min then Max cancels the Min callback. |
| M12 | **System maintenance script duplicated** | `index.html`, `editor.html`, `template.html` | ~80 lines of identical inline JS copy-pasted across 3 files. Should be extracted to `maintenance.js`. |
| M13 | **Inline styles** | `template.html` (especially) | Modal input fields have 8+ identical inline style blocks. Should be a `.form-input-modal` CSS class. |

### LOW — Polish / Organization

| # | Issue | Description |
|---|-------|-------------|
| L1 | **`null=True` on text fields** | `models.py` lines 14-19, 30-33: Django convention is `blank=True, default=""` for CharFields/TextFields, not `null=True`. Creates two representations of "empty". |
| L2 | **`unique_together` deprecated** | `models.py:99`: Should use `UniqueConstraint` in `constraints` instead. |
| L3 | **Duplicate `/editor/` route** | `droneclear_backend/urls.py:28`: Both `/library/` and `/editor/` serve `editor.html`. The `/editor/` should be a `RedirectView`. |
| L4 | **`STATICFILES_STORAGE` deprecated** | `settings/prod.py:30`: Should use `STORAGES` dict (Django 4.2+). |
| L5 | **`ALLOWED_HOSTS` empty-string bug** | `settings/prod.py:12`: If env var is unset, results in `['']` not `[]`. Effectively allows any host. |
| L6 | **`prod.py` missing security settings** | No `SECURE_SSL_REDIRECT`, `SECURE_HSTS_*` settings for production HTTPS. |
| L7 | **`asgi.py` uses dev settings** | `droneclear_backend/asgi.py:14`: Points to `settings.dev` while `wsgi.py` points to `settings.prod`. |
| L8 | **No admin registration** | `admin.py`: `Category`, `Component`, `DroneModel`, `BuildEvent` not registered. Admin panel can't manage these. |
| L9 | **Missing `<label>` elements** | All 5 HTML pages: Search inputs have `placeholder` but no `<label>` for screen readers. |
| L10 | **Guide cards not keyboard-accessible** | `guide-selection.js:72`: Cards use `onclick` on `div` with no `tabindex` or `role="button"`. |
| L11 | **Three.js memory leak** | `guide-viewer.js`: `destroySTLViewer` doesn't dispose geometries/materials. Minor GPU memory leak. |
| L12 | **Camera blob URL not revoked** | `guide-camera.js:82-83`: `URL.createObjectURL(blob)` never revoked. Minor memory leak. |
| L13 | **Global scope pollution** | All JS files: No module system. All functions/variables in global scope. Risk of naming collisions. |
| L14 | **`components.css` is 2800+ lines** | Consider splitting into component-cards.css, build-drawer.css, wizard.css, editor-forms.css. |
| L15 | **No cache-busting on guide/audit scripts** | `guide.html`, `audit.html`: Script tags lack `?v=` parameters unlike other pages. |

---

## Test Coverage — ✅ Implemented

`components/tests.py` — **72 tests across 13 test classes, all passing.** Run with `python manage.py test components`.

### Backend Tests (72 total)

| Test Class | Count | What It Covers |
|------------|-------|----------------|
| `CategoryModelTests` | 3 | str, slug uniqueness, verbose_name_plural |
| `ComponentModelTests` | 4 | str, PID uniqueness, schema_data default, cascade delete |
| `DroneModelTests` | 2 | str, relations default |
| `BuildGuideModelTests` | 3 | str, step ordering, unique order per guide |
| `BuildSessionModelTests` | 2 | str, status default |
| `BuildEventModelTests` | 2 | str, timestamp ordering |
| `CategoryAPITests` | 3 | list, count annotation, slug lookup |
| `ComponentAPITests` | 6 | create, get by PID, filter by category, batch PID filter, update, delete |
| `DroneModelAPITests` | 2 | create, lookup by PID |
| `ImportExportTests` | 8 | create, upsert, missing fields, missing category, non-list rejection, export all/by-category, full round-trip |
| `BuildGuideAPITests` | 5 | create with steps, list, detail with steps, update replaces steps, drone_model_pid linking |
| `BuildSessionAPITests` | 8 | serial generation/increment, guide snapshot, component snapshot, session_started event, PATCH, status filter, snapshot read-only |
| `BuildEventAPITests` | 6 | POST event, list events, invalid type rejected, PUT 405, DELETE 405, nonexistent session 404 |
| `PhotoUploadTests` | 6 | upload, SHA-256 matches bytes, photo_captured event, missing step/image, list photos |
| `SchemaAPITests` | 7 | GET, save valid, reject non-object/missing version/missing components/empty category/non-array |
| `BuildAuditAPITests` | 4 | full record, 404 nonexistent, photos with hash, snapshot immutable after guide edit |
| `MaintenanceTests` | 1 | bug report creation |

### Remaining Frontend Tests (Manual/E2E — not yet automated)
1. **Wizard flow**: Complete 12-step wizard, verify stack auto-skip
2. **Compatibility engine**: Verify all 12 checks fire correctly
3. **Guide runner**: Start build → navigate steps → capture photo → complete → verify audit
4. **Media carousel**: Multi-image steps, YouTube/Vimeo embeds, lightbox navigation
5. **Dark mode**: Toggle on all 5 pages, verify no missing/invisible elements

---

## Architecture Observations

### Strengths
- **Clean module separation**: Each JS file has a clear responsibility
- **Guide module is well-engineered**: `escHTML()` used consistently, `apiFetch()` wrapper, proper state management
- **Audit trail design**: Append-only events, server-side SHA-256, snapshot-based integrity
- **CSS variable system**: Comprehensive theming with consistent light/dark modes
- **Schema architecture**: v3 with explicit types, units, and constraint classification is solid

### Areas for Future Improvement
- **Module system**: Consider migrating to ES modules (`import`/`export`) to eliminate global scope pollution
- **Component framework**: As the app grows, vanilla JS will become harder to maintain. Consider Svelte, Alpine.js, or Lit for incremental adoption
- **API authentication**: Essential before any deployment. Django's session auth + DRF's `SessionAuthentication` is the simplest path
- **Database**: SQLite is fine for dev/single-user. For multi-user, migrate to PostgreSQL
- **Error boundaries**: Frontend fetch calls should have consistent error handling with user-facing feedback

---

## Files Changed In This Audit

| File | Action | Summary |
|------|--------|---------|
| `diff_output.txt` | Deleted | Temp diff artifact (103 KB) |
| `diff_utf8.txt` | Deleted | Temp diff artifact (52 KB) |
| `temp_template.html` | Deleted | Orphaned legacy UTF-16 template |
| `bump_font.py` | Deleted | One-off migration script, target file doesn't exist |
| `convert_csv_to_json.py` | Moved to `archive/` | References v2 schema, no longer functional |
| `v3_schema_overhaul_plan.md` | Moved to `archive/` | Completed plan, historical reference |
| `SPRINT_REPORT_v3_schema.md` | Moved to `archive/` | Completed sprint, historical reference |
| `droneclear_backend/settings.py` | Moved to `archive/settings_legacy_flat.py` | Orphaned, no entry point references it |
| `.gitignore` | Updated | Added `bug_reports/*.txt`, `media/`, `diff_*.txt`, `*.sqlite3-journal`, `*.bak`, `node_modules/` |
| `requirements.txt` | Updated | Added `Pillow>=10.0`, version bounds on all deps |
| `base.css` | Updated | Added 4 missing CSS variables to both light and dark themes |
| `utils.js` | Updated | Added `escapeHTML()`, XSS-safe `showToast()` |
| `template.js` | Updated | Fixed `/s+/g` → `/\s+/g` regex bug, added CSRF token to schema save |
| `index.html` | Updated | Removed orphaned DOM elements, fixed stale v2 error message |
| `shortcuts.js` | Updated | Fixed `'open'` → `!contains('closed')` class check on build drawer |
| `editor.js` | Updated | Added CSRF tokens to 5 fetch calls |
| `guide-state.js` | Updated | Added CSRF token to `apiFetch()` for mutating requests |
| `guide-editor.js` | Updated | Added CSRF token to guide delete |
| `components.css` | Updated | Removed dead `.sidebar-meta` rules, fixed duplicate `width` |
| `utilities.css` | Updated | Removed dead `.grid-container` selector |
| `models.py` | Updated | Added module docstring, model docstrings, `Categories` verbose plural |
| `views.py` | Updated | Consolidated imports, added module docstring, viewset docstrings, `select_related`, `timezone.now()` fix |
| `serializers.py` | Updated | Added module docstring, documented cascade-delete warning |

| `editor.html` | Updated | Import button always visible (removed `hidden` class), added Reset to Golden button + JS handler |
| `editor.js` | Updated | Import button now shown unconditionally; export still requires category selection |
| `urls.py` | Updated | Added `api/maintenance/reset-to-golden/` route |

**Total: 26 files touched, 4 deleted, 4 moved to archive, 18 modified**

---

## Recommended Next Session Priorities

1. ~~**Write basic Django tests**~~ — **Done.** 72 tests across 13 classes. See § "Test Coverage" above.
2. **Fix remaining innerHTML XSS** — Apply `escapeHTML()` to component cards, modal specs, and persist.js build names
3. **Extract duplicated maintenance script** — Move the ~100-line system maintenance block (now including Reset to Golden handler) from 3 HTML files into `maintenance.js`
4. **Add `transaction.atomic()`** — Wrap `ImportPartsView.post()`, `ResetToGoldenView.post()`, `BuildSessionViewSet.perform_create()`, and `BuildGuideDetailSerializer.update()`
5. **Add API authentication** — When ready for non-local access
