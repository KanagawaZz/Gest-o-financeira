from rest_framework.routers import DefaultRouter

from .views import FinancialAccountViewSet

router = DefaultRouter()
router.register("", FinancialAccountViewSet, basename="financial-account")
urlpatterns = router.urls
