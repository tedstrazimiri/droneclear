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
- Build wizard: guided step-by-step drone assembly (Frames → Batteries, 9 steps).
- Real-time compatibility validation with hard/soft constraint differentiation.
- Save and load builds to the backend (`/api/drone-models/`).

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

**CSS Architecture** (4 files):
- `base.css` — CSS variables, theme (light/dark), typography
- `layout.css` — Structural layout: sidebar, topbar, main content, build drawer
- `components.css` — Component cards, modals, badges, filter chips
- `utilities.css` — Buttons, forms, toasts, overlays, loaders

**Third-Party**: CodeMirror v5 (JSON editor), Phosphor Icons (`ph`)

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

3. **Run the Application**
   ```bash
   python manage.py runserver 8000
   ```
   Navigate to `http://127.0.0.1:8000/`

4. **Reset Parts Library to Golden State** (wipes all parts, seeds from schema examples)
   ```bash
   python manage.py reset_to_golden
   ```

---

## 🚦 Development Roadmap

### ✅ Completed Tiers

**Tier 1** — Core functionality (schema editor, parts CRUD, model builder)
**Tier 2** — UX polish (dark mode, keyboard shortcuts, filter/sort, list view, save/load builds)
**Tier 3** — UI hardening (inline confirmations, sidebar meta drawer, true black mode, Quick Add button, wizard compatibility highlighting)
**Tier 4 (current)** — Schema hardening & import/export infrastructure:
- ✅ Fix: Duplicate toast function, search debounce, wizard state management
- ✅ Schema v3: explicit `_type`, `_required`, `_unit`, `_compat_hard`/`_compat_soft` metadata
- ✅ Parts library reset: `reset_to_golden` management command
- ✅ Template editor: import validation, Schema Format reference modal, improved export (Full / Clean Template modes)
- ✅ Parts bulk import/export: `POST /api/import/parts/`, `GET /api/export/parts/`
- ✅ LLM-assisted import: `parts_import_template.json` + `llm_parts_import_guide.md`
- ✅ Editor Import/Export UI: 3-tab import modal, export dropdown

### 🔜 Tier 5 Candidates
- **Component Cloning**: Duplicate an existing part or schema category to speed up data entry.
- **Build Export**: Export a completed build to CSV or PDF from the wizard.
- **Advanced 3D Visualization**: WebGL/Three.js component previews.
- **Audit Logging**: Track who changed what in the schema and parts library.
- **Tag Vocabulary**: Controlled tag taxonomy per category instead of free-form strings.

---

## 🎨 UI Standards

### Sidebar Navigation
- Use `.logo-text` gradient class for the logo area
- System versioning and settings in `<details class="system-meta-drawer">` accordion
- Maintenance buttons (Restart, Bug Report) nested inside the meta drawer

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
