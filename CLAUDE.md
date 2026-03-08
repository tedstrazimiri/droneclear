# DroneClear — Project Instructions

## Project Overview

DroneClear Configurator: Django 5 + vanilla JS internal tool for drone component management, build assembly guides, and audit trails. 5 pages, no frontend framework. Output feeds a production compatibility engine for parts ordering, airworthiness checks, and cybersecurity verification.

## Quick Orientation

- **Frontend**: `DroneClear Components Visualizer/` — 5 HTML pages, 19 JS files, 6 CSS files
- **Backend**: `components/` app (models, views, serializers, URLs) + `droneclear_backend/settings/{base,dev,prod}.py`
- **Schema**: `drone_parts_schema_v3.json` (root copy is canonical)
- **Domain knowledge**: `docs/fpv_domain_knowledge.md` — FPV drone expertise (compatibility rules, naming conventions, specs). **Read this before working on the compatibility engine or parts data.**
- **Detailed docs**: `docs/` — [ARCHITECTURE.md](docs/ARCHITECTURE.md), [MODELS.md](docs/MODELS.md), [FEATURES.md](docs/FEATURES.md)
- **Seed data**: `docs/golden_parts_db_seed/` — 3,113 real parts across 12 categories (auto-seeded on first migrate)
- **Backlog**: [BACKLOG.md](BACKLOG.md) — single source of truth for all tracked issues
- **Changelog**: [CHANGELOG.md](CHANGELOG.md) — session-by-session development history
- **Deployment**: [DEPLOY_PYTHONANYWHERE.md](DEPLOY_PYTHONANYWHERE.md)

## Before Starting Work

1. Read `BACKLOG.md` to understand current priorities and open issues
2. Check the top entry in `CHANGELOG.md` for the most recent session's context

## Key Conventions

- **Commit messages**: `feat:`, `fix:`, `style:`, `refactor:`, `docs:`, `test:`
- **XSS safety**: Always use `escapeHTML()` from `utils.js` when injecting database content via innerHTML
- **CSRF**: All mutating fetch calls must include `X-CSRFToken: getCookie('csrftoken')` header
- **API fetch**: Guide module uses `apiFetch()` from `guide-state.js`; other pages use raw `fetch()`
- **Dark mode**: `[data-theme="dark"]` on `<html>`, persisted to `localStorage` key `dc-theme`
- **Build drawer**: Uses `closed` class (not `open`) — check `!contains('closed')` to test if open
- **Schema sync**: Schema exists at both root and `DroneClear Components Visualizer/` — keep them in sync
- **Settings**: Split into `settings/{base,dev,prod}.py`. The flat `settings.py` in archive/ is dead.

## Testing

```bash
python manage.py test components
```

92 tests across 19 classes. All must pass before committing.

## Development Server

```bash
python manage.py runserver 8000
```

Navigate to http://127.0.0.1:8000/

## Development

- **Agent**: Claude (sole developer)
- **Working directory**: `C:\Users\Ted\Documents\DRONECLEAR - Claude` (and git worktrees)
- **Repo**: `github.com/tedstrazimiri/droneclear` (`master` branch)

## Domain Knowledge (`docs/fpv_domain_knowledge.md`)

This file is our **living FPV drone expert brain**. It captures compatibility rules, naming conventions, component specs, retailer data patterns, and hard-won insights that make the compatibility engine work correctly.

**Rules:**
- **Consult it** before working on compatibility logic, parts import/export, schema changes, or data processing
- **Update it** when you discover new domain insights during your work — naming patterns you decoded, edge cases in compatibility checks, retailer quirks, corrections to existing entries
- **Add to the Revision History** at the bottom when you make changes
- **Never delete content** without replacing it with something more accurate — this knowledge was built from analysis of thousands of real products
- Treat this file with the same discipline as BACKLOG.md: it accumulates value over time

## Backlog Rules

- Before adding a new issue, **search BACKLOG.md by keyword** to avoid duplicates
- Use the next available ID with the appropriate prefix: `SEC-`, `BUG-`, `DEBT-`, `FEAT-`, `POLISH-`
- When completing an item, move it to the "Completed" section with today's date and session ID
- Never delete a backlog item — always move to Completed

## Session Close Procedure

When the user says "close session", "wrap up", "session close", or runs `/close-session`, execute these steps:

### Step 1: Review Changes
Run `git diff` and `git log` to understand what was done this session.

### Step 2: Update BACKLOG.md
- Move any items you completed to the "Completed" section with today's date and session ID
- Add any new issues discovered during this session (search for duplicates first!)
- Verify no items were forgotten or skipped

### Step 3: Write CHANGELOG.md Entry
Add an entry at the **top** of CHANGELOG.md (below the header) using this template:

```
## Session YYYY-MM-DD-N — [Short Title]

**Agent**: Claude
**Branch**: `branch-name`
**Commit(s)**: `abc1234`

### Summary
[1-3 sentences on what was accomplished]

### Changes
| Category | Description | Files |
|----------|-------------|-------|
| feat/fix/etc | [Description] | `file.ext` |

### Backlog Updates
- Completed: [IDs]
- Added: [IDs]

### Notes
[Architectural decisions, known limitations, context for next session]
```

The `-N` suffix is a sequential number for multiple sessions on the same date (start at 1 if unclear).

### Step 4: Commit Documentation
```bash
git add BACKLOG.md CHANGELOG.md
git commit -m "docs: session close — [short summary]"
```

### Step 5: Report to User
Summarize: what was completed, what was added to backlog, and suggested priorities for next session.
