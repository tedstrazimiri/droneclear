# DroneClear Architecture

## Frontend

Vanilla JS SPA — no framework. Modular JS files loaded in order:

| Module | Responsibility |
|--------|----------------|
| `state.js` | Global state and DOM element refs (Model Builder only) |
| `utils.js` | Shared utilities: `showToast`, `formatTitle`, `parsePrice`, `getCookie`, `escapeHTML` |
| `filters.js` | Filter/sort logic with debouncing |
| `components.js` | Category sidebar, component grid rendering, search |
| `modal.js` | Component detail modal |
| `build.js` | Build drawer, slot management, constraint validation |
| `wizard.js` | Guided build wizard engine |
| `persist.js` | Save/load drone builds |
| `app.js` | Entry point: init and event wiring |
| `shortcuts.js` | Keyboard shortcut overlay |
| `editor.js` | Parts Library CRUD (editor page only) |
| `template.js` | Master Schema editor logic (template page only) |
| `guide-state.js` | Build Guide global state, DOM refs, settings, API helpers, `CHECKLIST_FIELD_OPTIONS` registry, `resolveChecklistFieldValue()` |
| `guide-selection.js` | Guide card grid, overview rendering, session start |
| `guide-runner.js` | Step-by-step engine, navigation, media carousel/lightbox, timer, notes, markdown, session completion |
| `guide-camera.js` | Camera capture (getUserMedia + file fallback), photo upload |
| `guide-viewer.js` | Three.js STL/3MF viewer wrapper with auto-centre/scale |
| `guide-editor.js` | Guide authoring UI: CRUD for guides/steps, media list editor, checklist field picker |
| `audit.js` | Build Audit viewer: serial lookup, timeline, step accordion, integrity panel |

### CSS Files

| File | Scope |
|------|-------|
| `base.css` | CSS variables, dark/light themes, sidebar, topbar, layout grid |
| `layout.css` | Page-level layout, content body scroll, responsive breakpoints |
| `utilities.css` | Utility classes, toast, tooltip, loading states |
| `components.css` | Component cards, build drawer, wizard, modal, editor forms (~2800 lines) |
| `guide.css` | Guide selection, runner, editor, camera, viewer, carousel, lightbox |
| `audit.css` | Audit viewer: search, timeline, accordion, BOM, integrity panel |

### Third-Party Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| CodeMirror 6 | `@codemirror/*` (CDN) | JSON editor in Master Attributes page |
| Three.js | r162 (CDN) | STL/3MF 3D viewer in Build Guide |
| Phosphor Icons | 2.x (CDN) | Icon set across all pages |

---

## Backend

Django 5 + Django REST Framework. Single app architecture.

```
droneclear_backend/
  settings/
    base.py       # Shared settings (INSTALLED_APPS, MIDDLEWARE, DB, STATIC)
    dev.py        # Development overrides (DEBUG=True, SQLite)
    prod.py       # Production overrides (PythonAnywhere)
  urls.py         # Root URL conf — serves HTML pages + includes API routes
  wsgi.py         # WSGI entry (points to settings.prod)

components/
  models.py       # 8 models: Category, Component, DroneModel, BuildGuide, BuildGuideStep, BuildSession, StepPhoto, BuildEvent
  views.py        # ViewSets + custom views (import, export, maintenance, audit)
  serializers.py  # DRF serializers with nested step handling
  urls.py         # API router + custom URL patterns
  admin.py        # (Sparse — see BACKLOG POLISH-008)
  management/
    commands/
      seed_guides.py       # Seeds a 10-step sample build guide
      reset_to_golden.py   # Wipes DB, re-seeds from schema examples
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/categories/` | List/create categories |
| GET/PUT/DELETE | `/api/categories/{slug}/` | Category detail |
| GET/POST | `/api/components/` | List/create components. Supports `?category=`, `?pids=PID1,PID2` |
| GET/PUT/DELETE | `/api/components/{pid}/` | Component detail (lookup by PID) |
| GET/POST | `/api/drone-models/` | List/create drone models |
| GET/PUT/DELETE | `/api/drone-models/{pid}/` | Drone model detail |
| POST | `/api/import/parts/` | Bulk import components (upsert by PID) |
| GET | `/api/export/parts/` | Export components. `?category=` optional |
| GET/POST | `/api/build-guides/` | List/create guides (steps nested) |
| GET/PUT/DELETE | `/api/build-guides/{pid}/` | Guide detail (steps replaced atomically on PUT) |
| GET/POST | `/api/build-sessions/` | List/create sessions. `?status=` filter |
| GET/PATCH | `/api/build-sessions/{sn}/` | Session detail (lookup by serial number) |
| GET/POST | `/api/build-sessions/{sn}/photos/` | List/upload step photos (multipart) |
| GET/POST | `/api/build-sessions/{sn}/events/` | List/create build events (append-only) |
| GET | `/api/audit/{sn}/` | Full audit record for a session |
| GET/POST | `/api/schema/` | Read/write `drone_parts_schema_v3.json` |
| POST | `/api/maintenance/restart/` | Restart the dev server |
| POST | `/api/maintenance/bug-report/` | Save a bug report to disk |
| POST | `/api/maintenance/reset-to-golden/` | Wipe DB and re-seed from schema |

### HTML Pages

| URL | Template | JS Files |
|-----|----------|----------|
| `/` | `mission-control.html` | utils, mission-control |
| `/builder/` | `index.html` | state, utils, filters, components, modal, build, wizard, persist, app, shortcuts |
| `/template/` | `template.html` | utils, template |
| `/library/` | `editor.html` | utils, editor |
| `/guide/` | `guide.html` | utils, guide-state, guide-selection, guide-runner, guide-camera, guide-viewer, guide-editor |
| `/audit/` | `audit.html` | utils, audit |

---

## Schema Architecture (v3)

The master schema (`drone_parts_schema_v3.json`) defines all categories and their attributes. It is the canonical source of truth for all downstream tooling.

### Metadata Keys

| Key | Purpose | Values |
|-----|---------|--------|
| `_field_type` | Data type | `"text"` \| `"number"` \| `"select"` \| `"multi-select"` \| `"boolean"` |
| `_field_required` | Required flag | `true` \| `false` |
| `_field_unit` | Physical unit | `"g"` \| `"mm"` \| `"V"` \| `"A"` \| `"W"` \| `"in"` \| `"S"` \| `null` |

### Compatibility Constraint Classification

In each component's `compatibility` block:
- `_compat_hard`: Array of field keys that are **hard constraints** — engine flags as ERROR if violated
- `_compat_soft`: Array of field keys that are **soft constraints** — engine flags as WARNING if violated

```json
"compatibility": {
    "fc_mounting_patterns_mm": [20, 25.5, 30.5],
    "motor_mount_bolt_size": "M3",
    "_compat_hard": ["fc_mounting_patterns_mm", "motor_mount_bolt_size"],
    "_compat_soft": ["prop_size_min_in", "prop_size_max_in"]
}
```

---

## Testing

**72 backend tests** across 13 test classes. Run with:

```bash
python manage.py test components
```

| Test Class | Count | Coverage |
|------------|-------|----------|
| `CategoryModelTests` | 3 | str, slug uniqueness, verbose_name_plural |
| `ComponentModelTests` | 4 | str, PID uniqueness, schema_data default, cascade delete |
| `DroneModelTests` | 2 | str, relations default |
| `BuildGuideModelTests` | 3 | str, step ordering, unique order per guide |
| `BuildSessionModelTests` | 2 | str, status default |
| `BuildEventModelTests` | 2 | str, timestamp ordering |
| `CategoryAPITests` | 3 | list, count annotation, slug lookup |
| `ComponentAPITests` | 6 | create, get by PID, filter, batch PID, update, delete |
| `DroneModelAPITests` | 2 | create, lookup by PID |
| `ImportExportTests` | 8 | create, upsert, missing fields/category, export, round-trip |
| `BuildGuideAPITests` | 5 | create with steps, list, detail, update, drone_model_pid linking |
| `BuildSessionAPITests` | 8 | serial gen, snapshots, events, PATCH, status filter |
| `BuildEventAPITests` | 6 | POST, list, invalid type, PUT/DELETE 405, 404 |
| `PhotoUploadTests` | 6 | upload, SHA-256, photo_captured event, validation |
| `SchemaAPITests` | 7 | GET, save valid, reject invalid schemas |
| `BuildAuditAPITests` | 4 | full record, 404, photos with hash, snapshot immutability |
| `MaintenanceTests` | 1 | bug report creation |
