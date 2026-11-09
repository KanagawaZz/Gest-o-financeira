from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import InstallmentPlanViewSet, InstallmentViewSet

plans = SimpleRouter()
plans.register("", InstallmentPlanViewSet, basename="installment-plan")
rows = SimpleRouter()
rows.register("", InstallmentViewSet, basename="installment")

urlpatterns = [path("plans/", include(plans.urls)), path("", include(rows.urls))]
