# Sprint Report: V3 Schema Overhaul

**Date:** 2026-02-22
**Branch:** `claude/compassionate-ride`
**Commits:** `028a857`, `425e7a1`
**Agent:** Claude (Opus 4.6)
**Merged into:** `master`

---

## Objective

Execute the Tier 4 milestone: harden the DroneClear schema, fix the broken compatibility engine, build import/export infrastructure for the parts library, and clean up legacy data files.

---

## Pre-Sprint Assessment

Before writing any code, a deep audit of the codebase was conducted. This revealed that the original Tier 4 plan (documented in the README) was flawed:

**Original plan proposed:**
- Adding `_field_type`, `_field_required`, `_field_unit` metadata to every field across 27 categories

**Audit discovered:**
- Nothing in the codebase reads `_field_type` — type is inferred from `typeof value` in editor.js and template.js
- Nothing enforces `_field_required` — no client-side or server-side validation checks this flag
- Nothing displays `_field_unit` — the UI doesn't render units next to fields
- Adding these would have tripled the schema size for zero functionality

**Critical bugs found:**
- 4 of 5 compatibility checks in `build.js` silently fail because they reference field names that don't exist in the schema:
  - `max_prop_size_in` (actual: `prop_size_max_in`)
  - `bolt_pattern_mm` (actual: `mounting_pattern_mm`)
  - `motor_mounting_patterns_mm` (does not exist)
  - `cell_count_s` (actual: `cell_count`)
- 3 categories had empty `compatibility: {}` blocks
- 3 categories had no `_options` defined despite having enum-like fields
- 4 copies of schema/database JSON files existed across the repo
- Parts library editor had zero import/export capability

**Revised approach:** Fix the actual data, fix the code that reads it, build real import/export functionality, and only add metadata where something consumes it.

---

## What Was Done (6 Phases)

### Phase 1: Schema V3 Data (`drone_parts_schema_v3.json`)

- Wrote a Python transform script to convert v2 to v3 (script deleted after use)
- Bumped `schema_version` to `"v3"`
- Added `motor_mount_hole_spacing_mm: 16` to frames compatibility block (needed for motor-frame cross-check)
- Added `_compat_hard` and `_compat_soft` arrays to **all 35 compatibility blocks** (33 categories, VTX has 3 template entries)
  - **54 hard constraints** (violations = errors, physical incompatibility)
  - **85 soft constraints** (violations = warnings, suboptimal but workable)
- Added missing `_options` to 3 categories:
  - `flight_controllers`: 9 option sets (firmware_support, uart_protocol, etc.)
  - `ground_antennas`: 5 option sets (connector_type, polarization, etc.)
  - `optical_flow_sensors`: 4 option sets (interface, resolution, etc.)
- Populated previously empty compatibility blocks for wiring_hardware, tools, accessories
- Generated at root (`drone_parts_schema_v3.json`) and copied to `DroneClear Components Visualizer/`

**Files:** `drone_parts_schema_v3.json` (root + visualizer copy)

### Phase 2: Fix Compatibility Engine (`build.js`)

- Added `getConstraintSeverity(comp, fieldName)` helper that reads `_compat_hard`/`_compat_soft` from a component's compatibility block to determine if a violation is an error or warning
- Fixed all 4 broken field references in `getBuildWarnings()`:
  1. **Prop size check:** `frame.schema_data?.max_prop_size_in` → `frame.schema_data?.compatibility?.prop_size_max_in`; propeller reads `diameter_in` instead of non-existent `prop_size_in`
  2. **FC mount check:** `fc.schema_data?.bolt_pattern_mm` → `fc.schema_data?.mounting_pattern_mm`; frame reads `fc_mounting_patterns_mm` from compatibility block
  3. **Motor mount check:** `frame.schema_data?.motor_mounting_patterns_mm` → `frame.schema_data?.compatibility?.motor_mount_hole_spacing_mm` (changed from array `.includes()` to scalar comparison)
  4. **Battery voltage checks:** `bat.schema_data?.cell_count_s` → `bat.schema_data?.cell_count`
- All 5 severity types now use `getConstraintSeverity()` instead of hardcoded values

**Files:** `DroneClear Components Visualizer/build.js`

### Phase 3: Backend Updates (`components/`)

- **Schema path:** `SchemaView.get_schema_path()` now returns `drone_parts_schema_v3.json`
- **POST validation:** Added structured validation to `SchemaView.post()`:
  - Checks `schema_version` key exists
  - Checks `components` key exists and is a dict
  - Checks each category value is a non-empty array
  - Returns structured error list on validation failure
- **Import endpoint:** `POST /api/import/parts/` (`ImportPartsView`)
  - Accepts JSON array of parts
  - Upserts by PID (creates or updates)
  - Splits core model fields from schema_data automatically
  - Returns `{created, updated, errors}` summary
- **Export endpoint:** `GET /api/export/parts/?category=slug` (`ExportPartsView`)
  - Exports all parts (or filtered by category) in flat re-importable JSON format
  - Merges `schema_data` fields at top level for clean import/export round-trip
- **Management command:** `python manage.py reset_to_golden`
  - Wipes all Component, DroneModel, Category records
  - Reads v3 schema, creates Category + golden Component for each of 33 categories
  - Creates golden DroneModel from `drone_models` section
  - Output: "Created 33 categories, 35 components, 1 drone models"

**Files:** `components/views.py`, `components/urls.py`, `components/management/commands/reset_to_golden.py`

### Phase 4: Template Editor Upgrades

- **Schema Format modal:** "Format" button in topbar opens a reference modal showing the expected JSON structure with key conventions (`_options`, `_notes`, `_compat_hard`, `_compat_soft`, `_field_options`)
- **Dual export:** Replaced single Export button with dropdown:
  - "Full Schema" — downloads the current schema as-is
  - "Clean Template" — deep clones, strips example values to null/empty while keeping metadata keys and structure
- **Import validation:** When user uploads a JSON file, shows a pre-import summary modal:
  - Schema version detected, number of categories, field counts per category
  - Warnings for missing or new categories vs current schema
  - "Apply" or "Cancel" buttons before committing

**Files:** `DroneClear Components Visualizer/template.html`, `DroneClear Components Visualizer/template.js`

### Phase 5: Parts Import/Export UI

- **Static files created:**
  - `parts_import_template.json` — canonical 2-part example (motor + frame) showing every field
  - `llm_parts_import_guide.md` — system prompt template for LLM-assisted product page scraping with PID prefix table, field reference, example I/O, common pitfalls
- **Editor UI additions:**
  - "Import" button in topbar (appears when a category is selected, hidden for Drone Models)
  - "Export" dropdown in topbar with "This Category" and "All Parts" options
  - 3-tab import modal:
    - **Upload JSON** — drag-drop or file picker with pre-import preview (groups by category, warns about missing required fields)
    - **View Format** — renders `parts_import_template.json` in a scrollable pre block
    - **LLM Guide** — renders the markdown guide with a "Copy to Clipboard" button
  - Import handler POSTs to `/api/import/parts/`, shows success/error toast, refreshes category view and sidebar counts

**Files:** `DroneClear Components Visualizer/editor.html`, `DroneClear Components Visualizer/editor.js`, `DroneClear Components Visualizer/parts_import_template.json`, `DroneClear Components Visualizer/llm_parts_import_guide.md`

### Phase 6: Cleanup

- **Archived legacy files** (moved to `archive/`):
  - `Drone Parts 1 - Olympic Bear Build.csv`
  - `Drone Parts 2 .csv`
  - `Drone Parts List 3 - Big List .csv`
  - `drone_database_exported_v2.json`
  - `DroneClear Components Visualizer/drone_database.json`
- **Deleted v2 schema files:**
  - `drone_parts_schema_v2.json` (root)
  - `DroneClear Components Visualizer/drone_parts_schema_v2.json`

---

## Verification Results

All 3 views were tested live on `localhost:8001` after running `reset_to_golden`:

| View | Test | Result |
|------|------|--------|
| Parts Library (`/library/`) | 33 categories loaded with golden examples | PASS |
| Parts Library | Import button visible when category selected | PASS |
| Parts Library | Import modal opens with 3 tabs (Upload/Format/LLM Guide) | PASS |
| Parts Library | View Format tab loads `parts_import_template.json` | PASS |
| Parts Library | LLM Guide tab loads markdown with Copy button | PASS |
| Parts Library | Export dropdown shows "This Category" / "All Parts" | PASS |
| Template Editor (`/template/`) | V3 schema loads, all categories render | PASS |
| Template Editor | Format button and Export dropdown visible | PASS |
| Model Builder (`/`) | All categories display with golden components | PASS |
| Model Builder | Component detail modal shows v3 schema fields | PASS |
| Model Builder | Add to Build works, build drawer shows weight/cost | PASS |
| Backend | `reset_to_golden` creates 33 categories, 35 components, 1 model | PASS |
| Backend | `GET /api/schema/` returns v3 schema (HTTP 200) | PASS |

---

## Diff Summary

```
21 files changed, 4262 insertions(+), 2026 deletions(-)
```

| Category | Files | Lines Added | Lines Removed |
|----------|-------|-------------|---------------|
| Schema v3 JSON | 2 (root + visualizer) | ~3,145 | ~1,399 (v2 deleted) |
| build.js fixes | 1 | 42 | 30 |
| Backend (views, urls, mgmt cmd) | 4 | 226 | 2 |
| Template editor (HTML + JS) | 2 | 219 | 20 |
| Parts editor (HTML + JS) | 2 | 415 | 0 |
| Static files (template, LLM guide) | 2 | 220 | 0 |
| Plan document | 1 | 234 | 0 |
| Legacy files archived | 5 | 0 | 0 (moved) |
| Old v2 schema deleted | 1 | 0 | 1,787 |

---

## What Was NOT Done (and why)

| Omitted Item | Reason |
|---|---|
| `_field_type` on every field | Nothing reads it. Type is inferred from `typeof value`. |
| `_field_required` on every field | Nothing enforces it. No validation checks this flag. |
| `_field_unit` on every field | Pure documentation. UI doesn't display units. |
| Data-driven compatibility engine | Out of scope. The 5 hardcoded checks work for current categories. |
| Live browser testing of import round-trip | Would require creating test JSON and uploading — functional endpoints verified via curl + UI visual check. |

---

## Remaining Known Issues

- Language toggle only covers ~20 strings
- No undo/history for edits
- Import round-trip not tested end-to-end through the UI (endpoint works, modal works, not tested together with actual file upload)
- `db.sqlite3` in worktree is fresh from `reset_to_golden` — main repo DB may need the same reset after merge

---

## Next Steps (Tier 5 candidates)

1. Populate real component data using the LLM import guide + import endpoint
2. Add more compatibility checks as real data reveals new constraint patterns
3. Consider data-driven compatibility engine if category count grows beyond 33
4. Add `_field_unit` display if/when the UI adds unit labels next to fields
5. Add undo/history for schema and part edits
