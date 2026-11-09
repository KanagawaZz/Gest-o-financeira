from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import CreditCardViewSet, InvoiceViewSet

invoices = SimpleRouter()
invoices.register("", InvoiceViewSet, basename="invoice")
cards = SimpleRouter()
cards.register("", CreditCardViewSet, basename="credit-card")

# "invoices/" precisa vir antes do roteador de cartões, que captura qualquer segmento como pk.
urlpatterns = [path("invoices/", include(invoices.urls)), path("", include(cards.urls))]
