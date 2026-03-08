"""
Management command: reset_to_golden

Wipes all Component and DroneModel records, then seeds the database
from the golden parts in docs/golden_parts_db_seed/ plus all schema
categories from drone_parts_schema_v3.json.
"""
from django.core.management.base import BaseCommand

from components.seed import seed_golden


class Command(BaseCommand):
    help = 'Wipe all parts and drone models, then seed from golden parts database.'

    def handle(self, *args, **options):
        self.stdout.write('Resetting to golden parts database...')
        result = seed_golden(wipe=True)

        self.stdout.write(
            f'Deleted {result["deleted_components"]} components, '
            f'{result["deleted_models"]} drone models.'
        )
        self.stdout.write(self.style.SUCCESS(
            f'Done. Created {result["categories"]} categories, '
            f'{result["components"]} components, '
            f'{result["drone_models"]} drone models.'
        ))
