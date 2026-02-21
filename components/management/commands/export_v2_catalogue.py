import json
import os
from django.core.management.base import BaseCommand
from components.models import Category, Component, DroneModel
from django.utils import timezone

class Command(BaseCommand):
    help = 'Exports the SQL database to a drone_database_v2.json file according to the V2 schema'

    def handle(self, *args, **options):
        self.stdout.write("Starting V2 Catalogue Export...")

        output = {
            "schema_version": "v2",
            "metadata": {
                "exported_at": timezone.now().isoformat(),
                "source": "ProjectDClear - Live Catalogue Builder",
                "notes": "Generated from live SQL database."
            },
            "components": {},
            "drone_models": []
        }

        # Export Components
        categories = Category.objects.all()
        for cat in categories:
            components = Component.objects.filter(category=cat)
            cat_list = []
            
            for c in components:
                # Build the root keys
                comp_obj = {
                    "pid": c.pid,
                    "name": c.name,
                    "manufacturer": c.manufacturer,
                    "description": c.description,
                    "link": c.link,
                    "approx_price": c.approx_price,
                }
                
                # Merge dynamic schema_data fields into root
                if isinstance(c.schema_data, dict):
                    comp_obj.update(c.schema_data)
                
                cat_list.append(comp_obj)
            
            output["components"][cat.slug] = cat_list
            
        # Export Drone Models
        drones = DroneModel.objects.all()
        for d in drones:
            drone_obj = {
                "pid": d.pid,
                "name": d.name,
                "description": d.description,
                "vehicle_type": d.vehicle_type,
                "build_class": d.build_class,
                "image_file": d.image_file,
                "pdf_file": d.pdf_file,
                "relations": d.relations if isinstance(d.relations, dict) else {}
            }
            output["drone_models"].append(drone_obj)

        filepath = os.path.join(os.getcwd(), 'drone_database_exported_v2.json')
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2)
            
        self.stdout.write(self.style.SUCCESS(f'Successfully exported catalogue to {filepath}'))
