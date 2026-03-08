"""
seed.py — Shared seeding logic for DroneClear parts database.

Reads golden parts from docs/golden_parts_db_seed/ (per-category JSON files)
and creates all categories defined in the schema.

Used by:
  - management command: reset_to_golden
  - API view: ResetToGoldenView
  - post_migrate signal: auto-seed on fresh database
"""
import json
import os
from pathlib import Path

from django.conf import settings
from django.db import transaction

from components.models import Category, Component, DroneModel


# Fields stored directly on the Component model (not in schema_data)
CORE_KEYS = {
    'pid', 'category', 'name', 'manufacturer', 'description',
    'link', 'image_file', 'manual_link', 'approx_price',
}

SEED_DIR = os.path.join(settings.BASE_DIR, 'docs', 'golden_parts_db_seed')
SCHEMA_PATH = os.path.join(settings.BASE_DIR, 'drone_parts_schema_v3.json')


def _load_schema_categories():
    """Return list of category slugs from the schema file."""
    if not os.path.exists(SCHEMA_PATH):
        return []
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        schema = json.load(f)
    return list(schema.get('components', {}).keys())


def _load_seed_parts():
    """Load all parts from the golden seed directory. Returns list of dicts."""
    parts = []
    seed_path = Path(SEED_DIR)
    if not seed_path.is_dir():
        return parts
    for json_file in sorted(seed_path.glob('*.json')):
        with open(json_file, 'r', encoding='utf-8') as f:
            file_parts = json.load(f)
        if isinstance(file_parts, list):
            parts.extend(file_parts)
    return parts


def _load_drone_models():
    """Load golden drone models from the schema file."""
    if not os.path.exists(SCHEMA_PATH):
        return []
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        schema = json.load(f)
    return schema.get('drone_models', [])


@transaction.atomic
def seed_golden(wipe=True):
    """
    Seed the database with golden parts data.

    Args:
        wipe: If True, delete all existing components/models/categories first.

    Returns:
        dict with counts: deleted_components, deleted_models,
                          categories, components, drone_models
    """
    result = {
        'deleted_components': 0,
        'deleted_models': 0,
        'categories': 0,
        'components': 0,
        'drone_models': 0,
    }

    if wipe:
        result['deleted_components'] = Component.objects.count()
        result['deleted_models'] = DroneModel.objects.count()
        Component.objects.all().delete()
        DroneModel.objects.all().delete()
        Category.objects.all().delete()

    # 1. Create all categories from schema (ensures full category list in UI)
    category_slugs = _load_schema_categories()
    category_map = {}
    for slug in category_slugs:
        cat, _ = Category.objects.get_or_create(
            slug=slug,
            defaults={'name': slug.replace('_', ' ').title()},
        )
        category_map[slug] = cat

    # 2. Load seed parts and create components
    seed_parts = _load_seed_parts()
    components_created = 0
    for part in seed_parts:
        pid = part.get('pid')
        cat_slug = part.get('category')
        if not pid or not cat_slug:
            continue

        # Create category on-the-fly if seed file references one not in schema
        if cat_slug not in category_map:
            cat, _ = Category.objects.get_or_create(
                slug=cat_slug,
                defaults={'name': cat_slug.replace('_', ' ').title()},
            )
            category_map[cat_slug] = cat

        schema_data = {k: v for k, v in part.items() if k not in CORE_KEYS}

        Component.objects.create(
            pid=pid,
            category=category_map[cat_slug],
            name=part.get('name', ''),
            manufacturer=part.get('manufacturer', 'Unknown'),
            description=part.get('description', ''),
            link=part.get('link', ''),
            image_file=part.get('image_file', ''),
            manual_link=part.get('manual_link', ''),
            approx_price=part.get('approx_price', ''),
            schema_data=schema_data,
        )
        components_created += 1

    # 3. Seed golden drone models from schema
    models_created = 0
    for model_data in _load_drone_models():
        pid = model_data.get('pid')
        if not pid:
            continue
        DroneModel.objects.create(
            pid=pid,
            name=model_data.get('name', ''),
            description=model_data.get('description', ''),
            image_file=model_data.get('image_file', ''),
            pdf_file=model_data.get('pdf_file', ''),
            vehicle_type=model_data.get('vehicle_type', ''),
            build_class=model_data.get('build_class', ''),
            relations=model_data.get('relations', {}),
        )
        models_created += 1

    result['categories'] = Category.objects.count()
    result['components'] = components_created
    result['drone_models'] = models_created
    return result


def _load_schema_components():
    """Load the single-example components from the schema file."""
    if not os.path.exists(SCHEMA_PATH):
        return {}
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        schema = json.load(f)
    return schema.get('components', {})


@transaction.atomic
def seed_examples():
    """
    Wipe and re-seed from the single-example entries in drone_parts_schema_v3.json.
    This is the lightweight reset (1 example per category).

    Returns:
        dict with counts matching seed_golden() signature.
    """
    result = {
        'deleted_components': Component.objects.count(),
        'deleted_models': DroneModel.objects.count(),
        'categories': 0,
        'components': 0,
        'drone_models': 0,
    }

    Component.objects.all().delete()
    DroneModel.objects.all().delete()
    Category.objects.all().delete()

    schema_components = _load_schema_components()
    components_created = 0
    for cat_slug, items in schema_components.items():
        category = Category.objects.create(
            name=cat_slug.replace('_', ' ').title(),
            slug=cat_slug,
        )
        for item in items:
            pid = item.get('pid')
            if not pid:
                continue
            schema_data = {k: v for k, v in item.items() if k not in CORE_KEYS}
            Component.objects.create(
                pid=pid,
                category=category,
                name=item.get('name', ''),
                manufacturer=item.get('manufacturer', 'Unknown'),
                description=item.get('description', ''),
                link=item.get('link', ''),
                image_file=item.get('image_file', ''),
                manual_link=item.get('manual_link', ''),
                approx_price=item.get('approx_price', ''),
                schema_data=schema_data,
            )
            components_created += 1

    models_created = 0
    for model_data in _load_drone_models():
        pid = model_data.get('pid')
        if not pid:
            continue
        DroneModel.objects.create(
            pid=pid,
            name=model_data.get('name', ''),
            description=model_data.get('description', ''),
            image_file=model_data.get('image_file', ''),
            pdf_file=model_data.get('pdf_file', ''),
            vehicle_type=model_data.get('vehicle_type', ''),
            build_class=model_data.get('build_class', ''),
            relations=model_data.get('relations', {}),
        )
        models_created += 1

    result['categories'] = Category.objects.count()
    result['components'] = components_created
    result['drone_models'] = models_created
    return result
