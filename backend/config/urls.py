from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

def health(_request):
    """Verificação de saúde para monitoramento (sem dados do usuário)."""
    try:
        connection.ensure_connection()
    except Exception:  # noqa: BLE001
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ok"})


api_v1 = [
    path("health/", health, name="health"),
    path("auth/", include("apps.accounts.auth_urls")),
    path("accounts/", include("apps.accounts.urls")),
    path("categories/", include("apps.categories.urls")),
    path("transactions/", include("apps.transactions.urls")),
    path("recurring/", include("apps.recurring.urls")),
    path("credit-cards/", include("apps.credit_cards.urls")),
    path("installments/", include("apps.installments.urls")),
    path("goals/", include("apps.goals.urls")),
    path("audit/", include("apps.audit.urls")),
    path("dashboard/", include("apps.dashboard.urls")),
    path("reports/", include("apps.reports.urls")),
    path("integrations/", include("apps.integrations.urls")),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1)),
]
