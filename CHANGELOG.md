# DroneClear Changelog

> Session-by-session development log. Newest sessions at the top.
> Each entry is written at session close using `/close-session`.

---

## Session 2026-03-07-1 — Golden Seed, Schema Merge, Guide Fixes & Build Components Panel

**Agent**: Claude
**Branch**: `claude/great-sinoussi`
**Commits**: `8ebb110`, `c458ddb`, `5743ae7`, `c92defb`, `8fcbbf1`, `b618870`, `b724789`

### Summary
Major data foundation session: seeded the database with 3,113 real FPV drone parts from golden seed JSON files (12 categories), merged 79 missing fields into schema blueprints, and added a Reset to Examples button on all pages. Fixed guide page getCookie bug, added Build Components quick-select panel to the guide step editor (so linked drone model parts appear as one-click toggle buttons instead of requiring PID search), and fixed guide save failure caused by DRF 400 validation on blank step title/description.

### Changes
| Category | Description | Files |
|----------|-------------|-------|
| feat | Golden seed system — 3,113 real parts auto-seeded via post_migrate signal | `components/seed.py`, `components/apps.py`, `docs/golden_parts_db_seed/*.json` (12 files) |
| feat | Reset to Examples button on index, editor, template pages | `index.html`, `editor.html`, `template.html` |
| feat | Build Components quick-select panel in guide step editor | `guide-editor.js`, `guide.html`, `guide.css` |
| fix | Merge 79 seed data fields into schema v3 blueprints | `drone_parts_schema_v3.json` (both root and frontend copies) |
| fix | Add missing `utils.js` import to guide page (getCookie not defined) | `guide.html` |
| fix | Allow blank title/description on BuildGuideStep for new empty steps | `components/models.py`, `components/serializers.py`, migration `0008` |
| docs | FPV domain knowledge file, updated CLAUDE.md with seed data and domain docs | `docs/fpv_domain_knowledge.md`, `CLAUDE.md` |

### Backlog Updates
- Completed: FEAT-010, FEAT-011, FEAT-012, BUG-005, BUG-006, BUG-007
- Added: FEAT-010 through FEAT-012, BUG-005 through BUG-007 (all completed this session)

### Notes
- Golden seed loads once via `post_migrate` signal; subsequent migrations skip if data exists. `reset_to_golden` management command available for full reset.
- Build Components panel resolves the UX gap where guide step editors required manual PID entry despite having a linked drone model with all parts already associated.
- The `allow_blank` fix on BuildGuideStep was necessary because "+ Add Step" creates steps with empty fields — DRF's default validation rejects blank strings even with `required=False`.
- FPV domain knowledge (`docs/fpv_domain_knowledge.md`) is a living document capturing compatibility rules, naming conventions, and retailer patterns discovered during seed data analysis.

---

## Session 2026-03-06-4 — Documentation Refactor

**Agent**: Claude
**Branch**: `claude/frosty-johnson`
**Commit**: `fb404c9`

### Summary
Refactored the 710-line README into a modular documentation system. Created BACKLOG.md as single source of truth for tracked issues, CHANGELOG.md for session history, CLAUDE.md for session context, and `/close-session` slash command for standardized session-close workflow.

### Changes
| Category | Description | Files |
|----------|-------------|-------|
| docs | Slim README from 710 → ~120 lines | `README.md` |
| docs | Extract architecture reference | `docs/ARCHITECTURE.md` |
| docs | Extract model reference | `docs/MODELS.md` |
| docs | Extract feature reference | `docs/FEATURES.md` |
| docs | Create living backlog (37 items migrated from AUDIT_REPORT) | `BACKLOG.md` |
| docs | Create session changelog | `CHANGELOG.md` |
| docs | Create project instructions with session-close procedure | `CLAUDE.md` |
| docs | Create /close-session slash command | `.claude/commands/close-session.md` |
| docs | Archive original audit report | `docs/archive/AUDIT_REPORT.md` |

### Backlog Updates
- Added: All items from AUDIT_REPORT.md migrated with permanent IDs (SEC-001–005, BUG-001–004, DEBT-001–008, POLISH-001–015, FEAT-001–009)
- XSS-M1 through XSS-M5 marked as completed (already resolved in prior session)

### Notes
This session establishes the documentation system going forward. All future sessions should use `/close-session` to maintain the backlog and changelog. The AUDIT_REPORT.md has been archived — its content lives in BACKLOG.md and this changelog.

---

## Session 2026-03-06-3 — XSS Vulnerability Fixes

**Agent**: Claude
**Branch**: `claude/frosty-johnson`
**Commit**: `3c3cfcc`

### Summary
Resolved all remaining innerHTML XSS vulnerabilities (M1-M5 from the codebase audit). Applied `escapeHTML()` to all database-sourced content injected via innerHTML. Replaced inline `onclick` handlers with `data-*` attributes + `addEventListener` to eliminate JS-context injection vectors.

### Changes
| Category | Description | Files |
|----------|-------------|-------|
| fix | Card PID, name, manufacturer, description, tags, compat badges, price, weight, image src | `components.js` |
| fix | Tags, spec labels/values, compat labels/values, similar item cards | `modal.js` |
| fix | Build slot names, price, weight; warning titles/messages | `build.js` |
| fix | Build summary names; saved builds list; onclick→data-pid+addEventListener | `persist.js` |
| fix | Item row PIDs and names | `editor.js` |

### Backlog Updates
- Completed: XSS-M1, XSS-M2, XSS-M3, XSS-M4, XSS-M5

---

## Session 2026-03-06-2 — Django Test Suite

**Agent**: Claude
**Commit**: `c41e452`

### Summary
Added 72-test Django test suite covering all API endpoints and models. Tests span 13 test classes including model constraints, CRUD operations, import/export round-trip, serial number generation, snapshot immutability, event append-only enforcement, photo SHA-256 integrity, and schema validation.

### Changes
| Category | Description | Files |
|----------|-------------|-------|
| test | 72 tests across 13 test classes | `components/tests.py` |

---

## Session 2026-03-06-1 — Comprehensive Codebase Audit & Refactor

**Agent**: Claude
**Branch**: `claude/trusting-galileo`
**Commits**: `ac8ed79`, `f9d5c2f`

### Summary
Full codebase audit across all backend (20 files) and frontend (19 JS, 6 CSS, 5 HTML) files. Fixed XSS in showToast, regex bug in template.js, broken DOM in index.html, CSRF token gaps, missing CSS variables and dependencies. Cleaned up dead files, organized archives. Added Reset to Golden feature and fixed import button UX. Produced AUDIT_REPORT.md with prioritized backlog of remaining issues.

### Changes
| Category | Description | Files |
|----------|-------------|-------|
| fix | XSS in `showToast()` — added `escapeHTML()` | `utils.js` |
| fix | Regex bug `/s+/g` → `/\s+/g` | `template.js` |
| fix | Orphaned DOM elements, stale v2 reference | `index.html` |
| fix | Build drawer shortcut class check | `shortcuts.js` |
| fix | CSRF tokens on 10+ mutating fetch calls | `editor.js`, `template.js`, `guide-state.js`, `guide-editor.js` |
| fix | `datetime.now()` → `timezone.now()` | `views.py` |
| fix | N+1 query — added `select_related('category')` | `views.py` |
| feat | Reset to Golden endpoint + UI button | `views.py`, `urls.py`, `index.html`, `editor.html`, `template.html` |
| feat | Import button always visible (empty DB fix) | `editor.html`, `editor.js` |
| refactor | Missing CSS variables, dependency pins, dead CSS, imports consolidation | Multiple files |
| docs | AUDIT_REPORT.md, architecture diagram | Root level |

---

## Session 2026-03-06-0 — Build Audit Module (Tier 10)

**Agent**: Claude
**Branch**: `claude/trusting-galileo`
**Commit**: `8ab4e56`

### Summary
Designed and implemented the entire Build Audit module in a single session — 16 files touched, 4 new files created, ~700 lines of new code. Added immutable event logging, guide/component snapshots frozen at build start, SHA-256 photo hashing, and a full audit viewer with serial lookup, event timeline, step accordion, BOM table, and integrity verification panel.

### Changes
| Category | Description | Files |
|----------|-------------|-------|
| feat | Audit viewer page | `audit.html`, `audit.js`, `audit.css` |
| feat | BuildEvent model (append-only, 8 event types) | `models.py`, `migrations/0007_build_audit.py` |
| feat | Guide/component snapshots, step timing, SHA-256 | `models.py`, `views.py`, `serializers.py` |
| feat | Event emission + sendBeacon fallback | `guide-state.js`, `guide-runner.js` |
| feat | Audit API endpoints | `urls.py`, `views.py` |
| feat | Sidebar nav links on all pages | `guide.html`, `editor.html`, `template.html`, `index.html` |

---

## Historical Summary (Pre-Changelog)

Tiers 1–10 were completed between 2026-02-21 and 2026-03-06 across ~20 sessions.

| Tier | Focus | Key Deliverables |
|------|-------|-----------------|
| 1 | Core | Schema editor, parts CRUD, model builder |
| 2 | UX | Dark mode, keyboard shortcuts, filter/sort, list view, save/load builds |
| 3 | UI hardening | Inline confirmations, sidebar meta drawer, true black mode, Quick Add, wizard compat highlighting |
| 4 | Schema hardening | v3 schema with `_type`, `_required`, `_unit`, `_compat_hard`/`_compat_soft`; bulk import/export; LLM-assisted import |
| 5 | Data population | 836 components scraped from RotorVillage.ca; modal cleanup; card thumbnails; 5→12 compat checks; stack awareness; wizard overhaul (9→12 steps) |
| 6 | Build Guide + Filters | Dynamic category-specific filters; Build Guide module with serial tracking, photo capture, STL viewer, Betaflight CLI; 4 new Django models; seed data |
| 7 | Guide UX overhaul | Media carousel + lightbox; video embeds; editor media list; step transitions; build timer; step notes; markdown checklists; runner layout overhaul; nav bar grid |
| 8 | Parts integration | Batch PID endpoint; component resolution; overview enrichment; configurable checklist fields (13 options, max 5); runner component cards; editor component chips; scroll fix; 630+ real parts imported |
| 9 | Guide Editor UX | Drag-and-drop step reordering; collapsible step detail; Add Step restyle; action bar hierarchy |
| 10 | Build Audit | Audit page; BuildEvent model (append-only); guide/component snapshots; SHA-256 photo hashing; event emission with sendBeacon; audit viewer with timeline, accordion, BOM, integrity panel |
