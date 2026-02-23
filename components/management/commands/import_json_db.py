import json
import os
from django.core.management.base import BaseCommand
from django.conf import settings
from components.models import Category, Component

class Command(BaseCommand):
    help = 'Imports the drone_database.json into the SQLite database'

    def handle(self, *args, **options):
        # Path to the JSON database
        json_path = os.path.join(settings.BASE_DIR, 'DroneClear Components Visualizer', 'drone_database.json')

        if not os.path.exists(json_path):
            self.stdout.write(self.style.ERROR(f'Database file not found at {json_path}'))
            return

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        components_data = data.get('components', {})
        count = 0

        # Core fields extracted into model columns (not stored in schema_data)
        CORE_FIELDS = {
            'pid', 'name', 'manufacturer', 'description', 'link',
            'approx_price', '_approx_price', 'image_file', 'manual_link', 'category'
        }

        for cat_slug, comp_list in components_data.items():
            # Create or get category
            cat_name = cat_slug.replace('_', ' ').title()
            category, created = Category.objects.get_or_create(
                slug=cat_slug,
                defaults={'name': cat_name}
            )

            for comp in comp_list:
                # Extract core fields
                pid = comp.get('pid')
                if not pid:
                    continue

                name = comp.get('name', 'Unnamed')
                manufacturer = comp.get('manufacturer', 'Unknown')
                description = comp.get('description', '')
                link = comp.get('link', '')
                image_file = comp.get('image_file', '')
                manual_link = comp.get('manual_link', '')

                # Handle both price field conventions
                approx_price = comp.get('approx_price', '') or comp.get('_approx_price', '')
                if isinstance(approx_price, (int, float)):
                    approx_price = f'${approx_price:.2f}'

                # Store EVERYTHING else in the JSON schema_data field
                schema_data = {k: v for k, v in comp.items() if k not in CORE_FIELDS}

                # Update or create the component
                Component.objects.update_or_create(
                    pid=pid,
                    defaults={
                        'category': category,
                        'name': name,
                        'manufacturer': manufacturer,
                        'description': description,
                        'link': link,
                        'approx_price': approx_price,
                        'image_file': image_file,
                        'manual_link': manual_link,
                        'schema_data': schema_data
                    }
                )
                count += 1

        self.stdout.write(self.style.SUCCESS(f'Successfully imported {count} components!'))
