# Deploying DroneClear to PythonAnywhere

## Quick Reference

| Item | Value |
|------|-------|
| App URL | `https://decatron99.pythonanywhere.com` |
| Project path | `/home/decatron99/droneclear` |
| Virtualenv | `/home/decatron99/.virtualenvs/droneclear-venv` |
| WSGI config | `/var/www/decatron99_pythonanywhere_com_wsgi.py` |
| Static mapping | `/static/` → `/home/decatron99/droneclear/staticfiles/` |
| Settings module | `droneclear_backend.settings.prod` |

---

## Initial Setup

### 1. Clone the repo

Open a **Bash console** from the PythonAnywhere Dashboard:

```bash
cd ~
git clone https://github.com/tedstrazimiri/droneclear.git
```

### 2. Create a virtualenv

```bash
mkvirtualenv --python=/usr/bin/python3.10 droneclear-venv
```

If `mkvirtualenv` isn't available:
```bash
python3.10 -m venv ~/.virtualenvs/droneclear-venv
source ~/.virtualenvs/droneclear-venv/bin/activate
```

### 3. Install dependencies

```bash
cd ~/droneclear
pip install -r requirements.txt
```

### 4. Create the `.env` file

```bash
cd ~/droneclear
cp .env.example .env
nano .env
```

Set these values:
```
DJANGO_SETTINGS_MODULE=droneclear_backend.settings.prod
DJANGO_SECRET_KEY=<paste-generated-key>
DJANGO_ALLOWED_HOSTS=decatron99.pythonanywhere.com
CORS_ALLOWED_ORIGINS=https://decatron99.pythonanywhere.com
```

Generate a secret key:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 5. Run migrations and seed the database

```bash
cd ~/droneclear
DJANGO_SETTINGS_MODULE=droneclear_backend.settings.prod python manage.py migrate
DJANGO_SETTINGS_MODULE=droneclear_backend.settings.prod python manage.py reset_to_golden
```

### 6. Collect static files

```bash
DJANGO_SETTINGS_MODULE=droneclear_backend.settings.prod python manage.py collectstatic --noinput
```

This copies everything from `DroneClear Components Visualizer/` into `staticfiles/`.

---

## PythonAnywhere Web Tab Configuration

### Create the web app

1. Go to the **Web** tab in PythonAnywhere Dashboard
2. Click **"Add a new web app"**
3. Choose **"Manual configuration"** (not the Django quick option)
4. Select **Python 3.10**

### Set the virtualenv

In the Web tab under **Virtualenv**, enter:
```
/home/decatron99/.virtualenvs/droneclear-venv
```

### Configure the WSGI file

Click the WSGI config file link (`/var/www/decatron99_pythonanywhere_com_wsgi.py`) and replace its entire contents with:

```python
import os
import sys

# Add project directory to sys.path
project_home = '/home/decatron99/droneclear'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Load .env before Django reads settings
from dotenv import load_dotenv
load_dotenv(os.path.join(project_home, '.env'))

# Set Django settings module
os.environ['DJANGO_SETTINGS_MODULE'] = 'droneclear_backend.settings.prod'

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

### Configure static file mapping

In the Web tab under **Static files**, add:

| URL | Directory |
|-----|-----------|
| `/static/` | `/home/decatron99/droneclear/staticfiles/` |

### Reload

Click the green **"Reload"** button.

---

## Updating After Code Changes

```bash
cd ~/droneclear
git pull origin master
source ~/.virtualenvs/droneclear-venv/bin/activate
pip install -r requirements.txt
DJANGO_SETTINGS_MODULE=droneclear_backend.settings.prod python manage.py migrate
DJANGO_SETTINGS_MODULE=droneclear_backend.settings.prod python manage.py collectstatic --noinput
```

Then click **"Reload"** on the PythonAnywhere Web tab.

---

## Re-seeding the Database

To reset the database to golden examples from the v3 schema:

```bash
cd ~/droneclear
source ~/.virtualenvs/droneclear-venv/bin/activate
DJANGO_SETTINGS_MODULE=droneclear_backend.settings.prod python manage.py reset_to_golden
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **Static files return 404** | Verify the `/static/` mapping in Web tab points to `/home/decatron99/droneclear/staticfiles/`. Run `collectstatic` again. |
| **DisallowedHost error** | Check `DJANGO_ALLOWED_HOSTS` in `.env` includes `decatron99.pythonanywhere.com` |
| **500 error with no detail** | Check the error log: Web tab → "Log files" → Error log |
| **Module not found** | Verify virtualenv path in Web tab. Check that `pip install -r requirements.txt` was run inside the venv. |
| **Changes not appearing** | Click "Reload" on the Web tab after any code or config changes. |
| **CSS/JS not updating** | Run `collectstatic --noinput` again and reload. WhiteNoise uses hashed filenames for cache busting. |

### Log file locations

- **Error log**: `/var/log/decatron99.pythonanywhere.com.error.log`
- **Server log**: `/var/log/decatron99.pythonanywhere.com.server.log`
- **Access log**: `/var/log/decatron99.pythonanywhere.com.access.log`
