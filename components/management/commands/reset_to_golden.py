"""
Management command: reset_to_golden

Wipes all Component and DroneModel records, then seeds the database
from the golden examples defined in drone_parts_schema_v3.json.
"""
import json
import os

from django.conf import settings
from django.core.management.base import BaseCommand

from components.models import Category, Component, DroneModel


class Command(BaseCommand):
    help = 'Wipe all parts and drone models, then seed from schema v3 golden examples.'

    def handle(self, *args, **options):
        schema_path = os.path.join(settings.BASE_DIR, 'drone_parts_schema_v3.json')
        if not os.path.exists(schema_path):
            self.stderr.write(self.style.ERROR(f'Schema file not found: {schema_path}'))
            return

        with open(schema_path, 'r', encoding='utf-8') as f:
            schema = json.load(f)

        # Wipe existing data
        comp_count = Component.objects.count()
        model_count = DroneModel.objects.count()
        Component.objects.all().delete()
        DroneModel.objects.all().delete()
        Category.objects.all().delete()
        self.stdout.write(f'Deleted {comp_count} components, {model_count} drone models, all categories.')

        # Core fields stored on the Component model (not in schema_data)
        CORE_KEYS = {'pid', 'name', 'manufacturer', 'description', 'link',
                     'image_file', 'manual_link', 'approx_price'}

        # Seed categories and golden example components
        components_created = 0
        for cat_slug, items in schema.get('components', {}).items():
            category = Category.objects.create(
                name=cat_slug.replace('_', ' ').title(),
                slug=cat_slug,
            )

            for item in items:
                pid = item.get('pid')
                if not pid:
                    continue

                # Split into core fields vs schema_data
                schema_data = {}
                for key, val in item.items():
                    if key not in CORE_KEYS:
                        schema_data[key] = val

                Component.objects.create(
                    pid=pid,
                    category=category,
                    name=item.get('name', ''),
                    manufacturer=item.get('manufacturer', 'Unknown'),
                    description=item.get('description', ''),
                    link=item.get('link', ''),
                    image_file=item.get('image_file', ''),
                    manual_link=item.get('manual_link', ''),
                    schema_data=schema_data,
                )
                components_created += 1

        # Seed golden drone model(s)
        models_created = 0
        for model_data in schema.get('drone_models', []):
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

        self.stdout.write(self.style.SUCCESS(
            f'Done. Created {Category.objects.count()} categories, '
            f'{components_created} components, {models_created} drone models.'
        ))
