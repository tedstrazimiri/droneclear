# V3 Schema Overhaul Plan

## Context

This plan addresses the Tier 4 milestone: hardening the DroneClear schema and building import/export infrastructure so that the Configurator tool produces clean, consistent data for the production DroneClear compatibility engine.

**The problem:** The current schema v2 has field naming inconsistencies, the build.js compatibility engine references field names that don't exist in the schema (4 broken checks out of 5), compatibility blocks vary wildly in completeness, and there is no import/export infrastructure for the parts library. The previous plan proposed adding `_field_type`/`_field_required`/`_field_unit` metadata to every field — but nothing in the codebase reads that metadata, making it dead weight.

**This revised plan focuses on pragmatic changes:** fix the actual data, fix the code that reads it, build real import/export functionality, and only add metadata where something consumes it.

---

## Current State Audit

### Critical bugs (build.js reads fields that don't exist)
| build.js reads | From category | Actual schema field | Status |
|---|---|---|---|
| `max_prop_size_in` | frames | `prop_size_max_in` | BROKEN |
| `bolt_pattern_mm` | flight_controllers | `mounting_pattern_mm` | BROKEN |
| `motor_mounting_patterns_mm` | frames | does not exist | BROKEN |
| `cell_count_s` | batteries | `cell_count` | BROKEN |

**Result: 4 of 5 compatibility checks silently fail** because they read `undefined`.

### Schema inconsistencies across categories
- Battery `cell_count` (singular) vs everywhere else `cell_count_min`/`cell_count_max` (range)
- ESC `esc_firmware` (string) vs FC `firmware_support` (array) — different semantics for same concept
- Buzzers/LEDs use `voltage_v` (singular) vs most components `voltage_min_v`/`voltage_max_v` (range)
- Frames reference `motor_mounting_patterns_mm` which doesn't exist as a field
- 3 categories have empty `compatibility: {}` blocks
- 3 categories have no `_options` defined despite having enum-like fields
- Propeller size fields use inconsistent names (`prop_size_in`, `diameter_in`, `prop_size_max_in`)

### File duplication
- 4 copies of schema/database JSON files exist (root master, exported DB, visualizer copy, old visualizer DB)
- Backend hardcodes path to `drone_parts_schema_v2.json` at project root
- Frontend `STATICFILES_DIRS` serves from `DroneClear Components Visualizer/`

### No import/export for parts
- Template editor has basic import (file upload) and export (download JSON) — works but no validation
- Parts library editor has zero import/export — CRUD only

---

## Plan: 6 Phases

### Phase 1: Fix the schema data (drone_parts_schema_v3.json)

**Goal:** Clean, consistent field names. Comprehensive compatibility blocks. Classified hard/soft constraints.

**Changes to the JSON:**

1. **Rename file** from `drone_parts_schema_v2.json` to `drone_parts_schema_v3.json` (both root and visualizer copies)

2. **Bump metadata:**
   ```json
   "schema_version": "v3",
   "metadata": { "notes": "..." }
   ```

3. **Standardize field names across all 27 categories:**
   - Frames: keep `prop_size_max_in` (build.js will be fixed to match)
   - Frames: add `motor_mount_hole_spacing_mm` to compatibility block (needed for motor-frame cross-check)
   - Flight controllers: keep `mounting_pattern_mm` (build.js will be fixed to match)
   - Batteries: keep `cell_count` — it's a single value, not a range, which is correct for batteries
   - Ensure every category that has enum-like fields has corresponding `_field_options`

4. **Add `_compat_hard` and `_compat_soft` to every compatibility block:**
   ```json
   "compatibility": {
       "prop_size_min_in": 5.0,
       "prop_size_max_in": 5.3,
       "fc_mounting_patterns_mm": [20, 25.5, 30.5],
       "motor_mount_bolt_size": "M3",
       "_compat_hard": ["fc_mounting_patterns_mm", "motor_mount_bolt_size"],
       "_compat_soft": ["prop_size_min_in", "prop_size_max_in"]
   }
   ```
   This is the ONE piece of metadata that build.js will actually consume (Phase 2).

5. **Fill in missing `_options` for flight_controllers, ground_antennas, optical_flow_sensors** — these categories have enum-like fields but no `_options` defined, so the parts editor renders text inputs instead of dropdowns.

6. **Populate empty compatibility blocks** for wiring_hardware, tools, accessories (even if minimal).

**Files:**
- `drone_parts_schema_v3.json` (root — write from scratch based on v2)
- `DroneClear Components Visualizer/drone_parts_schema_v3.json` (copy)

### Phase 2: Fix build.js compatibility engine

**Goal:** All 5 checks work. Engine reads `_compat_hard`/`_compat_soft` to set severity.

**Changes:**

1. **Fix field name references in `getBuildWarnings()`:**
   - `max_prop_size_in` -> `prop_size_max_in`
   - `bolt_pattern_mm` -> `mounting_pattern_mm`
   - `motor_mounting_patterns_mm` -> `motor_mount_hole_spacing_mm` (read from frame compatibility block)
   - `cell_count_s` -> `cell_count`

2. **Read `_compat_hard`/`_compat_soft` for severity:**
   - If a violated field is in `_compat_hard` -> `type: 'error'`
   - If in `_compat_soft` -> `type: 'warning'`
   - Default to `'warning'` if not classified

**Files:**
- `DroneClear Components Visualizer/build.js` (lines ~169-217, `getBuildWarnings()`)

### Phase 3: Update backend for v3

**Goal:** Backend serves v3, has a reset command, has import/export endpoints.

**Changes:**

1. **Update schema path** in `components/views.py`:
   - `get_schema_path()` -> return path to `drone_parts_schema_v3.json`

2. **Add schema validation on POST** to `SchemaView`:
   - Check `schema_version` exists
   - Check `components` key exists and is an object
   - Check each category value is an array with at least one template entry
   - Return structured errors if validation fails

3. **Create `reset_to_golden` management command** (`components/management/commands/reset_to_golden.py`):
   - Wipe all Component and DroneModel records
   - Read v3 schema
   - For each category, create a Category record and one Component from the golden example
   - Create the golden DroneModel
   - Print summary

4. **Add import/export endpoints:**
   - `POST /api/import/parts/` — accepts JSON array of parts, upserts by PID, returns `{created, updated, errors}`
   - `GET /api/export/parts/` — exports all parts (or `?category=slug`) in re-importable format

**Files:**
- `components/views.py` (modify SchemaView, add ImportPartsView, ExportPartsView)
- `components/urls.py` (add new routes)
- `components/management/__init__.py` (create)
- `components/management/commands/__init__.py` (create)
- `components/management/commands/reset_to_golden.py` (create)

### Phase 4: Template editor upgrades

**Goal:** Import validation, schema format reference, dual export modes.

**Changes:**

1. **Import validation**: When user uploads a JSON file, show a pre-import summary modal:
   - Schema version detected
   - Number of categories found
   - List of categories with field counts
   - Warnings for missing/extra categories vs current schema
   - "Apply" or "Cancel" buttons

2. **Schema Format reference button**: Add a "Schema Format" button to topbar that opens a modal showing the expected JSON structure with key conventions (`_options`, `_notes`, `_compat_hard`, `_compat_soft`).

3. **Dual export modes**: Replace single export button with dropdown:
   - "Full Schema" — exports everything as-is (current behavior)
   - "Clean Template" — exports with example values stripped to defaults/nulls, keeping only field structure and metadata

**Files:**
- `DroneClear Components Visualizer/template.js` (modify import handler, add modals, modify export)
- `DroneClear Components Visualizer/template.html` (add modal markup, schema format button)

### Phase 5: Parts import/export UI + static files

**Goal:** Users can bulk import/export parts from the editor. LLM guide available.

**Changes:**

1. **Create `parts_import_template.json`** — canonical example showing the expected import format with comments explaining each field.

2. **Create `llm_parts_import_guide.md`** — system prompt template for LLM-assisted scraping. Includes: field-by-field guidance, type expectations, example input (product page URL) -> output (formatted JSON), common pitfalls.

3. **Add Import/Export UI to editor**:
   - "Import Parts" button -> opens modal with 3 tabs:
     - Upload JSON (drag-drop or file picker, shows pre-import summary)
     - View Format (renders parts_import_template.json)
     - LLM Guide (renders llm_parts_import_guide.md as formatted text)
   - "Export Parts" dropdown:
     - Export This Category
     - Export All Parts

**Files:**
- `DroneClear Components Visualizer/parts_import_template.json` (create)
- `DroneClear Components Visualizer/llm_parts_import_guide.md` (create)
- `DroneClear Components Visualizer/editor.js` (add import/export handlers)
- `DroneClear Components Visualizer/editor.html` (add modal markup, buttons)

### Phase 6: Cleanup and verify

**Goal:** Remove dead files, run reset, test everything live.

1. Move legacy data to `archive/`: 3 CSV files, `drone_database_exported_v2.json`, `DroneClear Components Visualizer/drone_database.json`
2. Delete old schema files: `drone_parts_schema_v2.json` (both root and visualizer copies)
3. Run `python manage.py reset_to_golden` to wipe DB and seed from v3 golden examples
4. Start server, test all 3 views in browser:
   - Template editor: load schema, visual/JSON toggle, import/export
   - Parts editor: CRUD, import/export, dynamic form generation
   - Model builder: wizard, compatibility validation (all 5 checks should work)
5. Commit and push to master

---

## What We Are NOT Doing (and why)

| Omitted Item | Reason |
|---|---|
| `_field_type` on every field | Nothing reads it. Type is inferred from `typeof value` in editor.js and template.js. Adding it would triple the schema size for zero functionality. |
| `_field_required` on every field | Nothing enforces it. No client-side or server-side validation checks this flag. If we add validation later, we can add the metadata then. |
| `_field_unit` on every field | Pure documentation. The UI doesn't display units next to fields. If we add unit display later, we can add the metadata then. |
| Rewriting the compatibility engine to be data-driven | Out of scope. The 5 hardcoded checks work for the current category set. A generic engine is a Tier 5+ item. |

---

## Execution Order

1. Phase 1 (schema v3 JSON) — must come first, everything depends on it
2. Phase 2 (build.js fixes) — can only test after schema exists
3. Phase 3 (backend) — schema path update, reset command, import/export endpoints
4. Phase 4 (template editor) — depends on backend schema serving v3
5. Phase 5 (parts import/export) — depends on backend endpoints
6. Phase 6 (cleanup + verify) — final step

---

## Verification

After all phases complete:
1. `python manage.py reset_to_golden` succeeds — DB has 27 categories + 1 example component each + 1 drone model
2. `/template/` loads v3 schema, visual editor renders all categories, import/export both modes work
3. `/library/` shows all categories with golden examples, import modal works with template JSON, export produces re-importable file
4. `/` model builder wizard runs, all 5 compatibility checks fire correctly with proper hard/soft severity
5. Clean commit to master
