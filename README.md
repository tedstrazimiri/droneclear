# DroneClear Configurator

The DroneClear Configurator is a robust internal tool built to manage, visualize, and construct drone component databases. It allows administrators to define a master schema of drone parts, populate a live library of components based on that schema, and provides a "Model Builder" interface to assemble virtual drone builds logically.

> **Purpose**: This is a **data-prep and configuration tool** whose output feeds the production DroneClear compatibility engine. The engine powers end-user features including parts ordering, audit trails, airworthiness checks, and cybersecurity verification. Data quality here directly affects production quality.

---

## 🚀 Features & Capabilities

### 1. Master Attributes Editor (`template.html` → `/template/`)
- Define categories (e.g., Motors, ESCs, Frames) and their specific attributes (e.g., KV, Mounting Pattern, Weight).
- Features a scalable, split-pane JSON code editor alongside a visual interactive form editor.
- Outputs the `drone_parts_schema_v3.json` blueprint — the canonical source of truth for all downstream tooling.
- Supports import validation with schema version checking, and two export modes (Full Schema / Clean Template).
- Field-level metadata: explicit types (`_field_type`), required flags (`_field_required`), units (`_field_unit`), and hard/soft constraint classification (`_compat_hard` / `_compat_soft`).

### 2. Parts Library Editor (`editor.html` → `/library/`)
- Populate the live database with actual drone components based on the Master Schema.
- Split-panel layout: component list on the left, dynamic form on the right.
- Supports bulk import via structured JSON (`parts_import_template.json`) and bulk export by category or full library.
- Deep-link editing: `/library/?edit_pid=MTR-0002` auto-opens a component.
- Inline delete confirmation (no native `confirm()` dialogs).

### 3. Model Builder (`index.html` → `/`)
- Browse components by category, filter by manufacturer/weight/sort.
- Card thumbnails loaded from component `image_file` URLs (lazy-loaded, hidden in list view).
- Build wizard: guided 12-step drone assembly with stack detection (auto-skips FC+ESC if stack selected).
- Real-time compatibility validation: 12 checks covering mounting, voltage, connectors, and video systems.
- Save and load builds to the backend (`/api/drone-models/`).

### 4. Build Guide (`guide.html` → `/guide/`)
Step-by-step guided drone assembly module. After a user creates a parts recipe in the Model Builder, the Build Guide walks them through physical assembly with documentation, photo evidence, and audit trail tracking.

**Core Features**:
- **Guide Selection Grid**: Browse available build guides as cards showing difficulty, estimated time, step count, and drone class.
- **Build Overview**: Full-width pre-build checklist with required tools, component verification checkboxes, builder name entry, and configurable attribute badges (up to 5 fields per component — manufacturer, weight, voltage, KV, mounting pattern, etc.).
- **Step Runner**: Step-by-step instruction engine with progress tracking, previous/next navigation, and per-step photo capture.
- **Serial Number Tracking**: Every build session receives a unique serial number (`DC-YYYYMMDD-XXXX`), generated server-side to prevent race conditions.
- **Photo Capture**: Camera integration via `navigator.mediaDevices.getUserMedia()` (rear camera preferred) with file upload fallback. Photos are stored via Django `ImageField` to `media/build_photos/`.
- **Safety Warnings**: Amber-highlighted warning boxes on steps involving soldering, high voltage, or other hazards. Can be toggled in settings.
- **Betaflight CLI Viewer**: Dark terminal-styled code block for firmware configuration steps, with one-click copy to clipboard.
- **3D STL Viewer**: Three.js-powered 3D model viewer for steps involving 3D-printed parts. Auto-centres and scales models, supports orbit controls.
- **Media Carousel**: Multi-image/video carousel per step with CSS `translateX` sliding, dot indicators, prev/next arrows, and caption bar. Supports YouTube, Vimeo (auto-converted to embed URLs), and direct image/video URLs. Single-item steps auto-hide navigation chrome via `[data-count="1"]` CSS selector.
- **Lightbox Viewer**: Full-screen media viewer (95vw/95vh) with dark backdrop blur, keyboard navigation (Arrow keys, Escape), and synced dot/caption display. Opens from carousel expand button or direct image click.
- **Step Transitions & Animations**: Smooth CSS keyframe transitions between steps with staggered entry animations for content, media, and extras panels.
- **Build Timer**: Dual stopwatch showing total build elapsed time and per-step elapsed time. Updates every second via `setInterval`. Per-step times are accumulated in `guideState.stepElapsed` and displayed alongside step time estimates.
- **Step Notes**: Per-step note-taking textarea with auto-save (debounced 1s) to `guideState.session.step_notes[stepOrder]`. Persisted via PATCH to session API.
- **Markdown & Checklists**: Step descriptions support markdown-style checklists (`- [ ] item`). Rendered as interactive checkboxes tracked in `guideState.stepChecklists`. Plain markdown formatting (bold, headers, code, links) also rendered.
- **Guide Editor**: Dedicated authoring interface (Edit mode toggle). Guide list moved to sidebar panel for full-width editing. **Drag-and-drop step reordering** with grab handles and drop indicators. **Collapsible step detail** panel with animated chevron toggle. Media list editor per step with type/URL/caption rows and add/remove support. Checklist display fields picker (max 5 from 13 options). Refined action bar: compact Delete (left), large Preview + Save Guide (right). Full CRUD for guides and their steps.
- **Configurable Checklist Fields**: Guide authors choose which component attributes appear as badges on overview checklist items. 13 available fields: manufacturer, price, weight, mount pattern, bolt size, voltage, cell count, KV rating, connector, MCU, prop size, current, step usage. Stored in `guide.settings.checklist_fields` JSONField. Defaults: `['manufacturer', 'weight', 'step_reference']`.
- **User Settings**: Configurable photo quality (640/1280/1920px), auto-advance after photo, and safety warning visibility. Persisted to `localStorage`.

**Build Session Lifecycle**:
```
Selection → Overview (checklist) → Start Build → Step 1..N (photos at each) → Complete → Summary
```

Each session records: serial number, guide reference, builder name, start/completion timestamps, current step, status (`in_progress` / `completed` / `abandoned`), component checklist state, per-step notes (`step_notes` JSONField), and all captured photos.

### 5. Build Audit (`audit.html` → `/audit/`)
Enterprise-grade build audit viewer. When a build is started, all guide steps and component specs are frozen into immutable snapshots. Every action during the build (step transitions, photo captures, note saves) is logged as an append-only `BuildEvent`. Photos are SHA-256 hashed server-side for integrity verification.

**Core Features**:
- **Serial Number Lookup**: Search by serial number (`DC-YYYYMMDD-NNNN`) or browse recent completed builds.
- **Deep-link Support**: `/audit/#DC-20260306-0001` auto-loads the record.
- **Audit Header**: Serial number, status badge, builder name, start/end timestamps, total duration, photo count.
- **Event Timeline**: Chronological feed of all build events with color-coded icons (session start/end, step transitions, photo captures, note saves).
- **Step Accordion**: Expandable panels per build step showing description (from guide snapshot), actual timing vs estimate, builder notes, photos with SHA-256 badges, and components used.
- **Component BOM**: Full bill of materials from the component snapshot (name, PID, category, manufacturer, price, weight).
- **Data Integrity Panel**: Five verification checks — guide snapshot, component snapshot, photo hashes, event log, build status — each with pass/warn badges.
- **Photo Hash List**: All SHA-256 hashes displayed with capture timestamps for verification.

**Audit Data Model**:
- `BuildSession.guide_snapshot` — frozen guide + steps at build start (JSONField)
- `BuildSession.component_snapshot` — frozen component specs at build start (JSONField, keyed by PID)
- `BuildSession.step_timing` — per-step elapsed time in ms (JSONField)
- `StepPhoto.sha256` — SHA-256 hash computed server-side at upload
- `BuildEvent` — immutable append-only event log (session FK, event_type, timestamp, step_order, data JSONField)

---

## 🏗️ Architecture

### Frontend
Vanilla JS SPA — no framework. Modular JS files loaded in order:

| Module | Responsibility |
|--------|----------------|
| `state.js` | Global state and DOM element refs (Model Builder only) |
| `utils.js` | Shared utilities: `showToast`, `formatTitle`, `parsePrice`, `getCookie` |
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

**CSS Architecture** (6 files):
- `base.css` — CSS variables, theme (light/dark), typography
- `layout.css` — Structural layout: sidebar, topbar, main content, build drawer
- `components.css` — Component cards, modals, badges, filter chips
- `utilities.css` — Buttons, forms, toasts, overlays, loaders
- `guide.css` — Build Guide module: card grid, runner, camera modal, editor, settings panel
- `audit.css` — Build Audit module: search card, timeline, step accordion, integrity badges, BOM table

**Third-Party**: CodeMirror v5 (JSON editor), Phosphor Icons (`ph`), Three.js r128 + STLLoader + OrbitControls (guide page only, CDN-loaded)

**Media Carousel Engine** (`guide-runner.js`, lines 350-490):
- `detectMediaType(url)` — sniffs YouTube/Vimeo URLs for iframe embed, mp4/webm for `<video>`, everything else as `<img>`
- `toEmbedUrl(url)` — converts `youtube.com/watch?v=X` → `youtube.com/embed/X`, `vimeo.com/ID` → `player.vimeo.com/video/ID`
- `renderStepMedia(step)` — builds slides from `step.media[]`, renders dot indicators, sets `data-count` attribute for CSS conditional display, handles backward compatibility with legacy `step.reference_image`
- `goToMedia(index)` — CSS `translateX` on `.guide-media-track`, updates active dot, syncs caption, updates lightbox if open
- `openLightbox(index)` / `closeLightbox()` — toggle `#media-lightbox` overlay with backdrop blur
- Keyboard: Escape → close lightbox, ArrowLeft/ArrowRight → navigate (only when lightbox is open)

### Backend (Django)
Lightweight Django + Django REST Framework.

- **Location**: `droneclear_backend/` (settings) + `components/` app
- **Database**: `db.sqlite3` (SQLite, local dev)
- **Schema file**: `drone_parts_schema_v3.json` (file-based, not ORM — read/written via `SchemaView`)

**Key API Endpoints**:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/schema/` | GET | Load master schema JSON |
| `/api/schema/` | POST | Save master schema JSON |
| `/api/categories/` | GET | List all categories + part counts |
| `/api/components/` | GET/POST | List or create components |
| `/api/components/{pid}/` | GET/PUT/DELETE | Component CRUD |
| `/api/drone-models/` | GET/POST | List or create drone builds |
| `/api/drone-models/{pid}/` | GET/PUT/DELETE | Drone model CRUD |
| `/api/import/parts/` | POST | Bulk import parts from JSON |
| `/api/export/parts/` | GET | Bulk export parts as importable JSON |
| `/api/build-guides/` | GET/POST | List or create build guides |
| `/api/build-guides/{pid}/` | GET/PUT/DELETE | Build guide CRUD (detail includes nested steps) |
| `/api/build-sessions/` | GET/POST | List or create build sessions (SN auto-generated) |
| `/api/build-sessions/{sn}/` | GET/PATCH/DELETE | Build session CRUD by serial number |
| `/api/build-sessions/{sn}/photos/` | GET/POST | List or upload step photos for a session |
| `/api/build-sessions/{sn}/events/` | GET/POST | List or log audit events for a session |
| `/api/audit/{sn}/` | GET | Complete audit record (snapshots, photos, timeline) |
| `/api/maintenance/restart/` | POST | Touch wsgi.py to restart server |
| `/api/maintenance/bug-report/` | POST | Save bug report to disk |

---

## 📐 Schema Architecture (v3)

The master schema (`drone_parts_schema_v3.json`) is the single source of truth for all component categories and their fields. Every field in the schema uses a set of metadata sidecar keys:

```json
"weight_g": 145,
"_weight_g_type": "number",
"_weight_g_required": true,
"_weight_g_unit": "g"
```

**Metadata key conventions**:

| Key | Purpose | Values |
|-----|---------|--------|
| `_field_options` | Pipe-delimited enum list | `"quad \| hex \| octo"` |
| `_field_notes` | Human-readable constraint notes | Free text |
| `_field_type` | Explicit type declaration | `"string" \| "number" \| "boolean" \| "array" \| "enum"` |
| `_field_required` | Required for ingestion | `true \| false` |
| `_field_unit` | Physical unit | `"g" \| "mm" \| "V" \| "A" \| "W" \| "in" \| "S" \| null` |

**Compatibility constraint classification** (in each component's `compatibility` block):
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

## 🔧 Build Guide Data Model

The Build Guide module adds four Django models to the `components` app:

### `BuildGuide`
Top-level guide definition. References an optional `DroneModel` for linking to a saved parts recipe.

| Field | Type | Notes |
|-------|------|-------|
| `pid` | `CharField(50, unique)` | e.g. `BG-5IN-FREE-01` |
| `name` | `CharField(255)` | Display name |
| `description` | `TextField` | Rich description |
| `difficulty` | `CharField` | `beginner` / `intermediate` / `advanced` |
| `estimated_time_minutes` | `IntegerField` | Total build time estimate |
| `drone_class` | `CharField(50)` | e.g. `5inch`, `3inch_cinewhoop` |
| `thumbnail` | `CharField(500)` | URL for card thumbnail |
| `drone_model` | `FK → DroneModel` | Optional link to saved build |
| `required_tools` | `JSONField(list)` | e.g. `["Soldering iron", "Hex drivers"]` |
| `settings` | `JSONField(dict)` | Extensible guide-level settings (e.g. `{ "checklist_fields": ["manufacturer", "weight", "step_reference"] }`) |

### `BuildGuideStep`
Ordered steps within a guide. Each step has a type that controls which UI elements are shown.

| Field | Type | Notes |
|-------|------|-------|
| `guide` | `FK → BuildGuide` | Parent guide |
| `order` | `IntegerField` | Step sequence (unique per guide) |
| `title` | `CharField(255)` | Step title |
| `description` | `TextField` | Assembly instructions |
| `safety_warning` | `TextField` | Displayed in amber warning box |
| `media` | `JSONField(list)` | Media array: `[{type, url, caption}]` |
| `stl_file` | `CharField(500)` | URL to STL for 3D viewer |
| `betaflight_cli` | `TextField` | CLI dump for firmware steps |
| `step_type` | `CharField` | `assembly` / `soldering` / `firmware` / `3d_print` / `inspection` |
| `estimated_time_minutes` | `IntegerField` | Per-step time estimate |
| `required_components` | `JSONField(list)` | Component PIDs needed, e.g. `["MTR-0001"]` |

### `BuildSession`
Tracks an individual build attempt. Serial number is auto-generated server-side.

| Field | Type | Notes |
|-------|------|-------|
| `serial_number` | `CharField(50, unique)` | Format: `DC-YYYYMMDD-XXXX` |
| `guide` | `FK → BuildGuide` | Which guide is being followed |
| `started_at` | `DateTimeField(auto)` | Session start |
| `completed_at` | `DateTimeField(null)` | Set on completion |
| `current_step` | `IntegerField` | Last active step index |
| `status` | `CharField` | `in_progress` / `completed` / `abandoned` |
| `notes` | `TextField` | Builder notes |
| `step_notes` | `JSONField(dict)` | Per-step notes: `{ "1": "note text", ... }` |
| `component_checklist` | `JSONField(dict)` | `{ "MTR-0001": true, ... }` |
| `builder_name` | `CharField(255)` | Who performed the build |
| `guide_snapshot` | `JSONField(dict)` | Frozen guide + steps at build start (audit) |
| `component_snapshot` | `JSONField(dict)` | Frozen component specs at build start (audit) |
| `step_timing` | `JSONField(dict)` | Per-step elapsed time: `{ "1": 12345, ... }` |

### `StepPhoto`
Photos captured during a build session, linked to specific steps. Used for audit trail and CV dataset collection.

| Field | Type | Notes |
|-------|------|-------|
| `session` | `FK → BuildSession` | Parent session |
| `step` | `FK → BuildGuideStep` | Which step this photo documents |
| `image` | `ImageField` | Stored in `media/build_photos/YYYY/MM/DD/` |
| `captured_at` | `DateTimeField(auto)` | Timestamp |
| `notes` | `TextField` | Optional photo annotation |
| `sha256` | `CharField(64)` | SHA-256 hash for integrity verification |

### `BuildEvent`
Immutable audit log entries. Append-only — no update or delete via API.

| Field | Type | Notes |
|-------|------|-------|
| `session` | `FK → BuildSession` | Parent session |
| `event_type` | `CharField(30)` | `session_started` / `session_completed` / `session_abandoned` / `step_started` / `step_completed` / `photo_captured` / `note_saved` / `checklist_updated` |
| `timestamp` | `DateTimeField(auto)` | Server-side, prevents backdating |
| `step_order` | `IntegerField(null)` | Which step (null for session-level events) |
| `data` | `JSONField(dict)` | Event-specific payload |

### Guide Editor (Authoring Workflow)

The guide editor (`/guide/` → Edit mode) provides a dedicated authoring interface:

1. **Guide List** (sidebar panel): All existing guides with PID and step count, displayed in the left sidebar below session info. Click to edit, or "+ New" to create.
2. **Guide Metadata Form** (full-width): PID, name, difficulty, drone class, estimated time, thumbnail URL, description, required tools (comma-separated). Increased padding (24px) for comfortable editing.
3. **Steps Manager**: Ordered list of steps with click-to-select, **drag-and-drop reordering** (grab handle + drop indicators), "+ Add Step" red action button (compact, right-aligned), and remove button (X) on each step. Dragging a step splices the array and renumbers all `order` fields automatically; the currently-selected step tracks correctly through reorder operations.
4. **Step Detail Form** (collapsible): Clickable header with animated chevron toggle to collapse/expand the form — keeps the step list visible when editing long guides. Contains: title, type, time, description, safety warning, **media list editor** (add/remove rows of type/URL/caption), STL URL, Betaflight CLI, required component PIDs.
5. **Checklist Display Fields Picker**: 2-column checkbox grid of 13 available attributes. Max 5 enforced (unchecked boxes disable when limit reached). Saved to `guide.settings.checklist_fields`.
6. **Actions**: Three-button bar — small Delete (muted, left), large Preview (outline), and large Save Guide (prominent red primary, right). Save PUTs to API with nested steps including settings. Preview saves then switches to Browse mode.

Steps are saved as a nested array in the guide PUT payload — the API replaces all steps atomically on each save.

### Runner Layout

The step runner uses a single-column flex layout:

```
┌─────────────────────────────────────────┐
│ Progress Bar (full width)               │
├─────────────────────────────────────────┤
│ Step Header (number, type, timer)       │
│ Step Title                              │
│ Safety Warning (if present)             │
│ Step Description (markdown/checklists)  │
│ Media Carousel (if media attached)      │
│ STL Viewer / CLI Block (if applicable)  │
├────────────────────┬────────────────────┤
│ Photo Gallery      │ Step Notes         │
│ (camera capture)   │ (auto-save)        │
├────────────────────┴────────────────────┤
│ [Prev 15%] [  Step X of N  ] [Next 15%]│
└─────────────────────────────────────────┘
```

- **Photos + Notes** sit in a 2-column grid row (`guide-runner-extras`) below step content
- **Nav bar** uses CSS grid: `minmax(100px, 15%) 1fr minmax(100px, 15%)` for proportional button sizing
- **Media carousel** is hidden when step has no media items

### Seed Data

A management command creates a sample guide for testing:

```bash
python manage.py seed_guides
```

This seeds a **10-step "5-inch Freestyle Quad Build"** guide covering: Frame Assembly → Motor Mounting → ESC Soldering → FC Stack → Receiver Wiring → VTX Installation → Camera Mounting → 3D-Printed Accessories → Betaflight Flash & Tune → Final Inspection. Includes safety warnings on soldering/VTX steps, a Betaflight CLI dump, and **multi-media test data** — steps with multiple images (for carousel testing), a YouTube video embed, and steps with no media (graceful empty state).

---

## ⚙️ Compatibility Engine (`build.js`)

The compatibility engine validates drone builds in real-time as users add components. It lives in `getBuildWarnings(buildState)` and runs 12 checks that compare field values across the selected components.

### How It Works

1. **Each component has a `compatibility` block** inside `schema_data` with key-value pairs the engine reads.
2. **`_compat_hard` / `_compat_soft` arrays** on each component classify which fields are hard constraints (ERROR) vs soft constraints (WARNING). The function `getConstraintSeverity(comp, fieldName)` reads these arrays.
3. **Stack awareness**: If a stack (FC+ESC combo) is selected, the engine extracts its nested `fc` and `esc` sub-objects and uses them as "effective" FC/ESC for all downstream checks.
4. **Null-safe**: Every check silently skips if either value is missing — no false warnings for incomplete data.

### Check Reference

| # | Check | Components | Severity | Fields Compared |
|---|-------|-----------|----------|-----------------|
| 1 | Prop size vs frame max | Frame + Propellers | SOFT | `frame.compat.prop_size_max_in` vs `props.diameter_in` |
| 2 | FC mounting pattern vs frame | Frame + FC | HARD | `frame.compat.fc_mounting_patterns_mm[]` includes `fc.mounting_pattern_mm` |
| 3 | Motor mount spacing vs frame | Frame + Motors | HARD | `frame.compat.motor_mount_hole_spacing_mm` vs `motor.compat.motor_mount_hole_spacing_mm` |
| 4 | Battery cells vs motor max | Battery + Motors | SOFT | `bat.cell_count` vs `motor.compat.cell_count_max` |
| 5 | Battery cells vs ESC range | Battery + ESC | SOFT/HARD | `bat.cell_count` vs `esc.compat.cell_count_min/max` |
| 6 | FC mounting hole size vs frame | Frame + FC | HARD | `frame.fc_mounting_hole_size` vs `fc.compat.mounting_hole_size` |
| 7 | Motor bolt size vs frame | Frame + Motors | HARD | `frame.compat.motor_mount_bolt_size` vs `motor.compat.motor_mount_bolt_size` |
| 8 | ESC mounting pattern vs frame | Frame + ESC | HARD | `frame.compat.fc_mounting_patterns_mm[]` includes `esc.compat.mounting_pattern_mm` |
| 9 | Battery connector vs ESC | Battery + ESC | HARD | `bat.compat.connector_type` vs `esc.compat.battery_connector` |
| 10 | Battery voltage vs ESC range | Battery + ESC | SOFT | `bat.compat.voltage_max_v` vs `esc.compat.voltage_min/max_v` |
| 11 | Camera-VTX video system | VTX + Camera | SOFT | `vtx.video_standard` + `vtx.digital_system` vs camera equivalent |
| 12 | Motor current vs ESC rating | Motors + ESC | SOFT | `motor.compat.min_esc_current_per_motor_a` vs `esc.continuous_current_per_motor_a` |

### Adding a New Check

To add check #13, follow this pattern in `getBuildWarnings()`:

```js
// 13. Your new check description
if (componentA && componentB) {
    const valA = parseFloat(componentA.schema_data?.compatibility?.field_a);
    const valB = parseFloat(componentB.schema_data?.field_b);
    if (valA && valB && /* mismatch condition */) {
        const severity = getConstraintSeverity(componentA, 'field_a');
        warnings.push({
            type: severity,       // 'error' or 'warning'
            title: 'Human-Readable Title',
            message: `Explanation with ${valA} and ${valB} values.`
        });
    }
}
```

Then ensure the relevant `_compat_hard` or `_compat_soft` array in the schema includes the field name so `getConstraintSeverity()` returns the correct level.

### Build Wizard Flow

The wizard (`wizard.js`) guides users through 12 steps in `wizardSequence` (defined in `state.js`):

```
Frames → Stacks (optional) → Flight Controllers → ESCs → Motors → Propellers
→ Video Transmitters → FPV Cameras → Receivers → Batteries
→ Antennas (optional) → Action Cameras (optional)
```

**Stack detection**: If a stack is selected in step 2, steps 3 (FC) and 4 (ESC) are auto-skipped with a toast notification. The wizard confirms before clearing an existing build.

**Wizard highlighting**: During each step, every component in the active category is simulated in the build via `getBuildWarnings()`. Components are highlighted green (compatible), yellow (warnings), or faded (incompatible).

---

## 📥 Parts Import Workflow

Parts can be bulk-imported via a structured JSON format. This enables an LLM-assisted workflow where users can scrape product pages and format the output for import.

**Import file format**: See `DroneClear Components Visualizer/parts_import_template.json`

**LLM-assisted import guide**: See `DroneClear Components Visualizer/llm_parts_import_guide.md`

**In-app**: Parts Library Editor → "Import Parts" button → Upload JSON tab

The import endpoint (`POST /api/import/parts/`) performs upsert by PID and returns a summary: `{ created, updated, errors }`.

---

## 📦 Setup & Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/tedstrazimiri/droneclear.git
   cd droneclear
   ```

2. **Backend Setup**
   ```bash
   python -m venv venv
   .\venv\Scripts\activate   # Windows
   # source venv/bin/activate  # Mac/Linux
   pip install -r requirements.txt
   ```

3. **Run Migrations**
   ```bash
   python manage.py migrate
   ```

4. **Seed Sample Data** (optional — creates a sample build guide for testing)
   ```bash
   python manage.py seed_guides
   ```

5. **Run the Application**
   ```bash
   python manage.py runserver 8000
   ```
   Navigate to `http://127.0.0.1:8000/`

6. **Reset Parts Library to Golden State** (wipes all parts, seeds from schema examples)
   ```bash
   python manage.py reset_to_golden
   ```

---

## 🚦 Development Roadmap

### ✅ Completed Tiers

**Tier 1** — Core functionality (schema editor, parts CRUD, model builder)
**Tier 2** — UX polish (dark mode, keyboard shortcuts, filter/sort, list view, save/load builds)
**Tier 3** — UI hardening (inline confirmations, sidebar meta drawer, true black mode, Quick Add button, wizard compatibility highlighting)
**Tier 4** — Schema hardening & import/export infrastructure:
- ✅ Schema v3: explicit `_type`, `_required`, `_unit`, `_compat_hard`/`_compat_soft` metadata
- ✅ Parts bulk import/export: `POST /api/import/parts/`, `GET /api/export/parts/`
- ✅ LLM-assisted import: `parts_import_template.json` + `llm_parts_import_guide.md`

**Tier 5** — Data population & UI/engine overhaul:
- ✅ RotorVillage.ca mass extraction: 836 components scraped from local HTML dump across 20 categories
- ✅ Modal display cleanup: null fields hidden, `_compat_hard`/`_compat_soft` filtered from UI, unit-aware formatting
- ✅ Card thumbnails: component images shown on grid cards (lazy-loaded)
- ✅ Compatibility engine expanded: 5 checks → 12 checks (mounting, voltage, connectors, video systems, current)
- ✅ Stack awareness: compatibility engine reads nested FC/ESC data from stack components
- ✅ Wizard overhaul: 9 steps → 12 steps, stack detection auto-skips FC+ESC, confirmation before clearing build
- ✅ Compat badge cleanup: internal `_compat` keys filtered from card badges, labels formatted with units

**Tier 6** — Build Guide module + Dynamic filters:
- ✅ Dynamic category-specific attribute filters: `DYNAMIC_FILTER_CONFIG` maps 12 categories to contextual filter UIs (range sliders, dropdowns) based on schema_data fields
- ✅ Build Guide module (`/guide/`): step-by-step guided assembly with serial number tracking, photo capture, STL 3D viewer, Betaflight CLI display, and dedicated guide editor
- ✅ 4 new Django models: `BuildGuide`, `BuildGuideStep`, `BuildSession`, `StepPhoto`
- ✅ REST API: ViewSets for guides and sessions, multipart photo upload endpoint
- ✅ Camera integration: `getUserMedia` with rear-camera preference, file upload fallback, configurable quality
- ✅ Three.js STL viewer: auto-centre, orbit controls, responsive resize
- ✅ Seed data: 10-step "5-inch Freestyle Quad Build" management command

**Tier 7** — Build Guide UX overhaul + Media system:
- ✅ **Media carousel**: Replaced single `reference_image` CharField with `media` JSONField (`[{type, url, caption}]`). CSS `translateX` carousel with prev/next arrows, dot indicators, expand button, caption bar. Auto-hides navigation on single-item steps.
- ✅ **Lightbox viewer**: Full-screen (95vw/95vh) media overlay with dark backdrop blur, prev/next arrows, keyboard navigation (Escape, Arrow keys), synced dots and captions.
- ✅ **Video embed support**: Auto-detects YouTube/Vimeo URLs and converts to embeddable iframe URLs. Direct mp4/webm treated as `<video>` elements.
- ✅ **Editor media list**: Per-step media authoring with type select (image/video), URL input, caption input, add/remove buttons. Reads DOM inputs back to step data on save.
- ✅ **Data migration**: `0006_replace_reference_image_with_media.py` — three-phase: AddField(media) → RunPython(convert existing reference_image values) → RemoveField(reference_image).
- ✅ **Step transitions/animations**: CSS keyframe staggered entry for step content, media carousel, and extras panels on step change.
- ✅ **Build timer**: Dual stopwatch (total build + per-step elapsed), `setInterval`-driven, accumulated in `guideState.stepElapsed`.
- ✅ **Step notes**: Per-step textarea with debounced auto-save (1s) to session API via PATCH.
- ✅ **Markdown & checklists**: Step descriptions render markdown formatting (bold, headers, code, links) and interactive `- [ ]` checklists tracked in `guideState.stepChecklists`.
- ✅ **Runner layout overhaul**: Changed from 2-column grid (cramped right panel) to single-column flex with photos/notes in a horizontal `guide-runner-extras` row below step content.
- ✅ **Nav bar proportional layout**: Changed from flex (oversized Previous button) to CSS grid: `minmax(100px, 15%) 1fr minmax(100px, 15%)`.
- ✅ **Editor UI overhaul**: Guide list moved to sidebar panel, editor form area made full-width, increased padding to 24px, form gap to 14px.

**Tier 8** — Build Guide + Parts Library integration & UX fixes:
- ✅ **Batch PID endpoint**: `GET /api/components/?pids=PID1,PID2` added to ComponentViewSet for efficient multi-component resolution.
- ✅ **Serializer split**: `BuildGuideDetailSerializer` reads `drone_model` as nested `DroneModelSerializer`, writes via `drone_model_pid` slug field.
- ✅ **Component resolution**: `resolveComponents()` in `guide-state.js` batch-fetches and caches components in `guideState.resolvedComponents`.
- ✅ **Overview enrichment**: Rich checklist with images, names, category grouping, BOM summary (cost + weight). Full-width single-column layout (replaced cramped 2-column grid).
- ✅ **Configurable checklist fields**: 13 available attribute fields (manufacturer, price, weight, mounting, bolt size, voltage, cells, KV, connector, MCU, prop size, current, step usage). Guide authors pick up to 5 via checkbox grid in editor. Stored in `guide.settings.checklist_fields` JSONField. Dynamic rendering via `resolveChecklistFieldValue()` — fields with no data for a component are gracefully hidden.
- ✅ **Runner enrichment**: "Parts for This Step" panel with component cards, spec tips from `extractComponentTips()`.
- ✅ **Editor picker**: Component chips UI replacing freeform PID text, linked drone model dropdown, search suggestions from build parts.
- ✅ **Scroll fix**: Wrapped `guide.html` content in `.content-body` scroll container (matching other pages). Fixed overflow clipping on glass panels extending beyond viewport.
- ✅ **630+ real parts imported** from DRONECLEAR_SCRAPE/imports/ (frames, motors, ESCs, FCs, props, batteries, cameras, VTXs, receivers, antennas, stacks).

**Tier 9** — Guide Editor UX & authoring efficiency:
- ✅ **Drag-and-drop step reordering**: Native HTML5 drag-and-drop on the step list. Grab handle (`ph-dots-six-vertical`) per step, `dragstart`/`dragover`/`drop`/`dragend` event chain. Drop indicators show red `box-shadow` above or below the target. On drop: array splice + automatic `order` renumbering. `editingStepIndex` tracks through reorder (handles dragged-step-is-selected, third-party-shift, and no-op cases). Current step form is saved before reorder to prevent data loss.
- ✅ **Collapsible step detail panel**: Clickable header with `ph-caret-up` chevron icon. CSS `max-height` transition (3000px → 0) with opacity fade. Chevron rotates 180° when collapsed. Keeps step list visible while working on long guides with many steps.
- ✅ **Add Step button restyle**: Changed from full-width outline to compact red `btn-primary` with `padding: 5px 12px`, right-aligned next to "Steps" header. Red colour signals actionable intent.
- ✅ **Action bar layout overhaul**: Replaced uniform button row with hierarchical layout — small muted Delete button (left, `font-size: 12px`), large Preview outline button (`min-width: 140px`), and large Save Guide primary button (`min-width: 160px`, `font-weight: 600`) on the right. All three on the same horizontal baseline via `flex-direction: row; align-items: center; flex-wrap: nowrap`.

**Tier 10** — Build Audit module:
- ✅ **Build Audit page** (`/audit/`): Serial number lookup, deep-link support (`/audit/#DC-XXXXXXXX-XXXX`), recent builds list, full audit record viewer.
- ✅ **BuildEvent model**: Immutable append-only event log. 8 event types: session_started, session_completed, session_abandoned, step_started, step_completed, photo_captured, note_saved, checklist_updated. Server-timestamped, no update/delete API.
- ✅ **Guide + component snapshots**: `guide_snapshot` and `component_snapshot` JSONFields on BuildSession, frozen at build start. Audit viewer renders from snapshots regardless of later edits/deletions.
- ✅ **Photo integrity**: SHA-256 hash computed server-side on upload, stored in `StepPhoto.sha256`. Displayed on audit viewer with "verified at upload" badges.
- ✅ **Step timing persistence**: `step_timing` JSONField on BuildSession, populated during build via PATCH alongside `current_step`.
- ✅ **Event emission**: Frontend `emitBuildEvent()` queues events (500ms debounce), `flushEventQueue()` sends to `/api/build-sessions/{sn}/events/`. `beforeunload` handler uses `navigator.sendBeacon()` for page-close safety.
- ✅ **Audit viewer**: Header card (serial, status, builder, dates), event timeline (color-coded icons), step accordion (timing, notes, photos, components), BOM table, integrity panel (5 verification checks).
- ✅ **Sidebar navigation**: "Build Audit" link added to all 5 pages. "View Audit Record" button on build completion screen.
- ✅ **Audit API endpoints**: `GET/POST /api/build-sessions/{sn}/events/`, `GET /api/audit/{sn}/`.

### 🔜 Tier 11 Candidates
- **Component Cloning**: Duplicate an existing part or schema category to speed up data entry.
- **Build Export**: Export a completed build to CSV or PDF from the wizard.
- **Photo AI Analysis**: Run CV models on captured step photos for quality assurance.
- **Schema Audit Logging**: Track who changed what in the schema and parts library.
- **Tag Vocabulary**: Controlled tag taxonomy per category instead of free-form strings.
- **Additional data sources**: Scrape GetFPV, RaceDayQuads, or manufacturer sites for broader coverage.
- **Media upload**: Direct file upload for step media (currently URL-only).
- **Build guide versioning**: Track guide revisions so sessions reference a specific version.
- **Audit PDF export**: Generate downloadable PDF audit reports from the audit viewer.

---

## 🎨 UI Standards

### Sidebar Navigation
- Use `.logo-text` gradient class for the logo area
- System versioning and settings in `<details class="system-meta-drawer">` accordion
- Maintenance buttons (Restart, Bug Report) nested inside the meta drawer
- Five menu items on all pages: Master Attributes → Parts Library Editor → Model Builder → Build Guide → Build Audit
- Active page highlighted with `.btn-menu.active` class

### Topbar Navigation
All pages use this flexbox structure:

```html
<header class="topbar">
    <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
        <div style="display: flex; align-items: center; gap: 12px;">
            <button class="mobile-nav-toggle" id="mobile-nav-toggle" style="display:none; background:none; border:none; cursor:pointer; color:var(--text-main);">
                <i class="ph ph-list" style="font-size:28px;"></i>
            </button>
            <h1 class="page-title">Page Title</h1>
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
            <!-- Page-specific tools here -->
            <div style="width: 1px; height: 24px; background: var(--border-color); margin: 0 8px;"></div>
            <!-- Global toggles -->
            <button class="dark-mode-toggle" id="dark-mode-toggle">
                <i class="ph ph-moon" id="dark-mode-icon"></i>
            </button>
            <button class="dark-mode-toggle" id="shortcuts-help-btn">
                <i class="ph ph-keyboard"></i>
            </button>
        </div>
    </div>
</header>
```

### Dark Mode
- Applied via `[data-theme="dark"]` on `<html>`
- True black palette: `--bg-dark: #000000`, `--bg-panel: #0a0a0a`
- Persisted to `localStorage` key `dc-theme`

### Toast Notifications
- Call `showToast(message, type)` from `utils.js` (loaded on all pages)
- Types: `'success'`, `'error'`, `'warning'`, `'info'`
- Self-dismisses after 3.5 seconds

---

## 🤝 Multi-Agent Development Notes

This repo is developed collaboratively between two AI agents:
- **Claude** works in: `C:\Users\Ted\Documents\DRONECLEAR - Claude` (and git worktrees)
- **Gemini** works in: `C:\Users\Ted\Documents\DRONECLEAR - Claude - Gemini`
- **Shared repo**: `github.com/tedstrazimiri/droneclear` (`master` branch)

Always `git fetch && git merge origin/master --ff-only` before starting work to pick up the other agent's commits. Commits follow conventional format: `feat:`, `fix:`, `style:`, `refactor:`, `docs:`.

---

## 📋 Session Log (2026-03-06) — Build Audit Module

### What was built
The entire Build Audit module (Tier 9) was designed, planned, and implemented in a single session. This is the biggest single-session feature addition to date — 16 files touched, 4 new files created, ~700 lines of new code across backend and frontend.

### Files created
| File | Purpose |
|------|---------|
| `DroneClear Components Visualizer/audit.html` | Audit viewer page template — search phase + record phase |
| `DroneClear Components Visualizer/audit.js` | ~320 lines. Serial lookup, timeline render, step accordion, BOM table, integrity panel |
| `DroneClear Components Visualizer/audit.css` | ~540 lines. Full styling: glass panels, timeline, accordion, BOM grid, responsive breakpoints |
| `components/migrations/0007_build_audit.py` | Django migration: BuildEvent model + snapshot/timing/sha256 fields |

### Files modified
| File | Changes |
|------|---------|
| `components/models.py` | +`BuildEvent` model (8 event types, append-only). +`guide_snapshot`, `component_snapshot`, `step_timing` JSONFields on BuildSession. +`sha256` CharField on StepPhoto |
| `components/views.py` | +169 lines. Snapshot logic in `perform_create()`, SHA-256 in photo upload, `BuildEventView` (GET/POST), `BuildAuditView` (GET), status/ordering filters on sessions |
| `components/serializers.py` | +`sha256` on StepPhotoSerializer. +snapshot/timing fields on BuildSessionSerializer (read-only) |
| `components/urls.py` | +2 URL patterns: `events/` and `audit/` |
| `droneclear_backend/urls.py` | +1 route: `/audit/` → audit.html |
| `guide-state.js` | +46 lines. `emitBuildEvent()`, `flushEventQueue()`, `beforeunload` sendBeacon handler |
| `guide-runner.js` | +43 lines. Event emission at 4 hook points: step_started, step_completed, session_completed, note_saved. step_timing PATCH. "View Audit Record" button handler |
| `guide.html` | +Build Audit sidebar link. +Completion screen "View Audit Record" button |
| `editor.html`, `template.html`, `index.html` | +Build Audit sidebar link (each) |
| `README.md` | +Tier 9 documentation, BuildEvent model docs, audit API endpoints, audit.js/css in architecture tables |

### Current state
- All migrations applied (`0001` through `0007`)
- Server boots cleanly, all pages render
- Audit page tested live: search works, recent builds populate, full audit record renders (header, timeline, step accordion with expandable details, BOM table, integrity panel with pass/warn badges)
- Seeded with: 35 components, 1 drone model, 1 build guide (10 steps), 1 completed build session with 22 events
- Dark mode and light mode both tested

### Known limitations / future work
1. **No real photos in test data** — the seed command fast-forwards through steps, so photo integrity shows "Warn (no photos)". A real build with camera captures will fully exercise the SHA-256 hashing and photo grid display.
2. **Step timing shows 0s–2s** — the seed build was rapid-fire. Real builds will show meaningful timing data.
3. **No audit PDF export yet** — Tier 10 candidate. The audit viewer is read-only HTML; exporting to a downloadable PDF (or printing) would be valuable for compliance/regulatory handoff.
4. **Event batching is fire-and-forget** — events POST with 500ms debounce. If the server is down, events are lost. Could add IndexedDB queue for offline resilience.
5. **Guide reference media is still URL-only** — build photos use Django `ImageField` (stored on disk), but guide step media (tutorial images, YouTube videos) are stored as URLs. Direct file upload for guide media is a Tier 10 candidate.

### Architecture decisions
- **JSONField snapshots** over separate snapshot tables — simpler for read-heavy audit queries, ~15-30KB per session, acceptable for expected build volume.
- **Append-only model** (no PUT/PATCH/DELETE API) for BuildEvent — simpler than Django-level immutability; the API simply doesn't expose mutation endpoints.
- **Server-side SHA-256** over client-side — prevents spoofing; hash is computed from actual file bytes on upload.
- **Fire-and-forget event emission** with sendBeacon fallback — avoids blocking the build UX for non-critical telemetry.
- **Standalone audit.js** — no dependency on guide-state.js or guide-runner.js. The audit page only needs `utils.js` for shared utilities (toast, escHTML, getCookie).
