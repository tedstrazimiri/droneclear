# DroneClear Configurator

The DroneClear Configurator is a robust internal tool built to manage, visualize, and construct drone component databases. It allows administrators to define a master schema of drone parts, populate a live library of components based on that schema, and provides a "Model Builder" interface to assemble virtual drone builds logically.

## 🚀 Features & Capabilities

1. **Master Attributes Editor (`template.html`)**
   - Define categories (e.g., Motors, ESCs, Frames) and their specific attributes (e.g., KV, Mounting Pattern, Weight).
   - Features a scalable, split-pane JSON code editor alongside a visual interactive form editor.
   - Outputs the `drone_parts_schema_v2.json` blueprint.

2. **Parts Library Editor (`editor.html`)**
   - Populate the live database (`drone_database_exported_v2.json`) with actual drone components based on the Master Schema.
   - Includes real-time validation, JSON export/import, and dynamic form generation.

3. **Model Builder (`index.html`)**
   - A guided, responsive interface for piecing together a virtual drone build.
   - Features a 9-step "Build Wizard" that walks the user through selecting a Frame, Flight Controller, ESCs, Motors, etc.
   - Calculates estimated weight and total cost dynamically.
   - Visual "In Build" badges and persistent drawer summarizing the current configuration.

## 🛠️ Tech Stack & Architecture

### Frontend (Vanilla JS + CSS)
The frontend relies entirely on standard ES Modules and Vanilla CSS, meaning no complex build tools (Webpack/Vite) or heavy frameworks (React/Vue) are required. 

- **Structure**: Located in `DroneClear Components Visualizer/`.
- **Styling**: `style.css` contains a unified design system using custom properties (`var(--accent-red)`, `var(--bg-dark)`) and a responsive CSS Grid architecture.
- **JavaScript Modules**:
  - `app.js` / `script.js` - Core initialization.
  - `components.js` - Fetches and renders the component data.
  - `editor.js` - Handles Parts Library CRUD operations.
  - `template.js` - Manages the Master Attributes Master Schema logic.
  - `build.js` / `wizard.js` - Drives the logical states of the Model Builder and the step-by-step wizard.
  - `modal.js` / `persist.js` / `state.js` - Shared state and UI overlay logic.
- **Third-Party Libraries**: `CodeMirror` (for JSON editing) and Phosphor Icons (`ph`).

### Backend (Django)
A lightweight Django application serves the REST API responsible for ingesting, managing, and delivering the JSON schemas and components to the frontend.

- **Structure**: Located in `droneclear_backend/` and the `components/` app.
- **Database**: `db.sqlite3`
- **Execution**: Can be run locally via `python manage.py runserver`. Supports environment-based configuration for dev/prod.

## 🚦 Development Roadmap & Known Issues

We have recently completed "Tier 1 + Tier 2" UI regressions and bug fixes. The application layout is currently stable, featuring dark mode, keyboard shortcuts, inline confirmations, and properly anchored floating action buttons.

**Tier 3 Candidates (Upcoming Fixes/Features):**
- ~~**Persistence Confirms**: The `persist.js` `deleteBuild()` logic still uses a blocking browser `confirm()` prompt and needs to be migrated to the new inline HTML confirmation bar (similar to the "Clear Build" button).~~
- ~~**Builder Skip Flow**: Introduce a card-level "Add to Build" button to let power users skip the detailed component modal during the wizard.~~
- ~~**Weight Filter Validation**: Ensure the inline weight filter inputs enforce minimum > maximum validation logic.~~
- ~~**Slot Replacement Confirm**: Add a "Replace?" overlay warning when a user attempts to add a component to a build slot that is already filled.~~
- ~~**Wizard Highlighting**: Wire up the existing visual component highlighting logic to match the current active step in the wizard.~~

## 📦 Setup & Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/tedstrazimiri/droneclear.git
   cd droneclear
   ```

2. **Backend Setup (Virtual Environment)**
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Run the Application**
   ```bash
   python manage.py runserver 8000
   ```
   *Navigate to `http://127.0.0.1:8000/` to launch the Model Builder, or view the other tabs in the sidebar.*


## UI Standards

#### Topbar Navigation Standard
To maintain visual consistency, all core pages MUST use the following flexbox structural standard for the <header class="topbar">. The mobile toggle and page title reside on the left, while tools and toggles reside on the right.

`html
<header class="topbar">
    <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
        <div style="display: flex; align-items: center; gap: 12px;">
            <button class="mobile-nav-toggle" id="mobile-nav-toggle" style="display:none; background:none; border:none; cursor:pointer; color:var(--text-main);">
                <i class="ph ph-list" style="font-size:28px;"></i>
            </button>
            <h1 class="page-title">Page Title</h1>
        </div>

        <div style="display: flex; align-items: center; gap: 16px;">
            <!-- Page Specific Tools (Search, Buttons, etc) Go Here -->
            
            <div style="width: 1px; height: 24px; background: var(--border-color); margin: 0 8px;"></div>
            
            <!-- Global Theme Toggles Go Here -->
            <button class="dark-mode-toggle" id="dark-mode-toggle">
                <i class="ph ph-moon" id="dark-mode-icon"></i>
            </button>
            <button class="dark-mode-toggle" id="shortcuts-help-btn">
                <i class="ph ph-keyboard"></i>
            </button>
        </div>
    </div>
</header>
`

