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
                name = comp.get('name')
                manufacturer = comp.get('manufacturer', 'Unknown')
                description = comp.get('description', '')
                link = comp.get('link', '')
                approx_price = comp.get('_approx_price', '')

                # Store EVERYTHING else in the JSON schema_data field
                # By stripping out the core fields we just took
                schema_data = {k: v for k, v in comp.items() if k not in [
                    'pid', 'name', 'manufacturer', 'description', 'link', '_approx_price'
                ]}

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
                        'schema_data': schema_data
                    }
                )
                count += 1

        self.stdout.write(self.style.SUCCESS(f'Successfully imported {count} components!'))
