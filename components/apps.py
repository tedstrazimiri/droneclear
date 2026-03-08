from django.apps import AppConfig


class ComponentsConfig(AppConfig):
    name = 'components'

    def ready(self):
        from django.db.models.signals import post_migrate
        post_migrate.connect(_auto_seed, sender=self)


def _auto_seed(sender, **kwargs):
    """Seed the golden parts database on first migrate (empty DB only)."""
    import sys
    if 'test' in sys.argv:
        return

    from components.models import Component
    if Component.objects.exists():
        return

    from components.seed import seed_golden, SEED_DIR
    import os
    if not os.path.isdir(SEED_DIR):
        return

    result = seed_golden(wipe=False)
    if result['components'] > 0:
        print(
            f'[DroneClear] Auto-seeded: {result["categories"]} categories, '
            f'{result["components"]} components, {result["drone_models"]} drone models.'
        )
