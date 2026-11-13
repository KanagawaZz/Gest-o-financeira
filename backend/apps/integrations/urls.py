from django.urls import path

from .views import PluggyCredentialView, PluggySyncView

urlpatterns = [
    path("pluggy/", PluggyCredentialView.as_view(), name="pluggy-credential"),
    path("pluggy/sync/", PluggySyncView.as_view(), name="pluggy-sync"),
]

