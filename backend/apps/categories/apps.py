from django.apps import AppConfig


class CategoriesConfig(AppConfig):
    name = "apps.categories"

    def ready(self):
        from django.conf import settings
        from django.db.models.signals import post_save

        from .services import seed_default_categories

        def _seed(sender, instance, created, **kwargs):
            if created:
                seed_default_categories(instance)

        post_save.connect(_seed, sender=settings.AUTH_USER_MODEL, weak=False, dispatch_uid="seed_default_categories")
