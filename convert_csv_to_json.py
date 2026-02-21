import csv
import json
import os
import re
from pathlib import Path

import copy

# Paths
BASE_DIR = Path("c:/Users/Ted/Documents/DRONECLEAR/DroneClear Components Visualizer")
OUTPUT_FILE = BASE_DIR / "drone_database.json"
SCHEMA_TEMPLATE_FILE = BASE_DIR / "drone_parts_schema_v2.json"

CSV_FILES = [
    Path("c:/Users/Ted/Documents/DRONECLEAR/Drone Parts 1 - Olympic Bear Build.csv"),
    Path("c:/Users/Ted/Documents/DRONECLEAR/Drone Parts 2 .csv"),
    Path("c:/Users/Ted/Documents/DRONECLEAR/Drone Parts List 3 - Big List .csv")
]

# Map messy CSV categories to strict JSON schema arrays
CATEGORY_MAP = {
    "FRAME": "frames",
    "400K FRAME": "frames",
    
    "MOTORS": "motors",
    "400K MOTORS": "motors",
    
    "SERVOS": "servos",
    
    "STACK": "stacks",
    "EXTRA STACK": "stacks",
    "400K STACK": "stacks",
    
    "EXTRA FC": "flight_controllers",
    
    "ESC": "escs",
    "8S MODE ESC": "escs",
    
    "AIO": "aio_boards",
    "PDB": "pdbs",
    "VOLTAGE REGULATORS": "voltage_regulators",
    
    "BAT AIR": "batteries",
    "BAT GROUND": "batteries",
    "BAT TX": "batteries",
    
    "BAT CHARGER": "battery_chargers",
    
    "PROPS": "propellers",
    "400K PROPS": "propellers",
    
    "CAM": "fpv_cameras",
    "CAM1": "fpv_cameras",
    
    "DIGITAL CAM": "digital_video_cameras",
    "THERMAL": "thermal_cameras",
    "ACTION CAM": "action_cameras",
    
    "VTX": "video_transmitters",
    "VTX SPECIAL": "video_transmitters",
    
    "RX": "receivers",
    "TX": "transmitters",
    "ANT": "antennas",
    "ANTENNA AIR": "antennas",
    "ANTENNA GROUND": "antennas",
    
    "GPS": "gps",
    "GOGGLES": "goggles",
    "GOG": "goggles",
}

# Read original schema to use as templates
with open(SCHEMA_TEMPLATE_FILE, 'r', encoding='utf-8') as f:
    SCHEMA_DATA = json.load(f)

# Built database structure based on schema categories
database = {
    "schema_version": "v2",
    "metadata": {
        "exported_at": "Generated via script",
        "source": "ProjectDClear - CSV Import",
        "notes": "Consolidated database from various user CSV component lists."
    },
    "components": { k: [] for k in SCHEMA_DATA['components'] }
}

# Counters for PID generation
counters = {}

def get_pid(category):
    prefix = ""
    if category == "frames": prefix = "FRM"
    elif category == "motors": prefix = "MTR"
    elif category == "servos": prefix = "SRV"
    elif category == "stacks": prefix = "STK"
    elif category == "flight_controllers": prefix = "FC"
    elif category == "escs": prefix = "ESC"
    elif category == "aio_boards": prefix = "AIO"
    elif category == "pdbs": prefix = "PDB"
    elif category == "voltage_regulators": prefix = "VRG"
    elif category == "batteries": prefix = "BAT"
    elif category == "battery_chargers": prefix = "CHG"
    elif category == "propellers": prefix = "PRP"
    elif category == "fpv_cameras": prefix = "CAM"
    elif category == "digital_video_cameras": prefix = "DVC"
    elif category == "thermal_cameras": prefix = "THM"
    elif category == "action_cameras": prefix = "ACT"
    elif category == "video_transmitters": prefix = "VTX"
    elif category == "receivers": prefix = "RX"
    elif category == "transmitters": prefix = "TX"
    elif category == "antennas": prefix = "ANT"
    elif category == "gps": prefix = "GPS"
    elif category == "goggles": prefix = "GOG"
    else: prefix = "UNK"
    
    if category not in counters:
        counters[category] = 1
    
    pid = f"{prefix}-{counters[category]:04d}"
    counters[category] += 1
    return pid

def build_component_from_template(category, name, link, price, note, filepath):
    # Grab the template object for this category if it exists
    template_list = SCHEMA_DATA["components"].get(category, [])
    if template_list:
        base_comp = copy.deepcopy(template_list[0])
    else:
        # Fallback if no template exists
        base_comp = {}

    # Helper to nullify values recursively, but preserve keys starting with "_"
    def clear_dict(d):
        for k, v in d.items():
            if k.startswith("_"):
                continue
            if isinstance(v, dict):
                clear_dict(v)
            elif isinstance(v, list):
                d[k] = []
            else:
                d[k] = None

    # Nullify everything first
    clear_dict(base_comp)

    # Now populate our known data
    base_comp["pid"] = get_pid(category)
    base_comp["name"] = name
    base_comp["manufacturer"] = "Unknown"
    base_comp["description"] = note.strip() if note else "Imported from CSV"
    
    if link:
        base_comp["link"] = link
    if price:
        base_comp["_approx_price"] = price
        
    base_comp["_source"] = filepath.name
    
    return base_comp

def extract_link(note_field):
    # Very crude URL extraction
    url_pattern = re.compile(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+')
    match = url_pattern.search(note_field)
    if match:
        return match.group(0), note_field.replace(match.group(0), "").strip()
    return None, note_field.strip()

def process_csv(filepath):
    print(f"Parsing: {filepath.name}...")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            for row in reader:
                if not row or len(row) < 3:
                    continue
                
                # Try to determine if this is a component row by checking col 0
                col0 = str(row[0]).strip().upper()
                
                # Check for direct mapping
                mapped_cat = None
                for key, val in CATEGORY_MAP.items():
                    if key in col0:
                        mapped_cat = val
                        break
                
                # Check column 1 as fallback for Category (List 3 sometimes shifts)
                col1 = str(row[1]).strip().upper()
                if not mapped_cat:
                    for key, val in CATEGORY_MAP.items():
                        if key in col1:
                            mapped_cat = val
                            break

                if mapped_cat:
                    name = ""
                    note = ""
                    link = None
                    price = None
                    
                    # Columns vary wildly, so let's try to extract intel
                    for idx, cell in enumerate(row[1:], 1):
                        cell_str = str(cell).strip()
                        if not cell_str: continue
                        
                        # Is it a price?
                        if cell_str.startswith('$'):
                            if not price: price = cell_str
                            continue
                            
                        # Is it a link?
                        extracted_link, leftover_note = extract_link(cell_str)
                        if extracted_link and not link:
                            link = extracted_link
                            if leftover_note: note += f" {leftover_note}"
                            continue
                            
                        # If it's quite long, it's likely a note or a long name
                        if len(cell_str) > 5 and not name:
                            # Avoid numbers like '11' or '22'
                            if not re.match(r'^\d+$', cell_str):
                                name = cell_str
                                continue
                                
                        if name and cell_str and cell_str != name and not re.match(r'^[\d\.]+$', cell_str):
                            # It's additional text, add as a note
                            note += f" | {cell_str}" if note else cell_str

                    if name:
                        comp = build_component_from_template(mapped_cat, name, link, price, note, filepath)
                        database["components"].setdefault(mapped_cat, []).append(comp)
                        
    except Exception as e:
        print(f"Error reading {filepath.name}: {e}")

# Process all files
for file in CSV_FILES:
    if file.exists():
        process_csv(file)
    else:
        print(f"File not found: {file}")

# We DO NOT clean up empty categories to keep the template shape.

# Write output
with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(database, f, indent=2)

print(f"Successfully generated database with {sum(len(v) for v in database['components'].values())} components.")
print(f"Wrote to: {OUTPUT_FILE}")
