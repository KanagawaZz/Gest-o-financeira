from rest_framework.routers import SimpleRouter

from .views import RecurringRuleViewSet

router = SimpleRouter()
router.register("", RecurringRuleViewSet, basename="recurring-rule")
urlpatterns = router.urls
