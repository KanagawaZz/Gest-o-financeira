from django.urls import path

from .views import ProjectionView, SimulateView, SummaryView

urlpatterns = [
    path("summary/", SummaryView.as_view(), name="dashboard-summary"),
    path("projection/", ProjectionView.as_view(), name="dashboard-projection"),
    path("simulate/", SimulateView.as_view(), name="dashboard-simulate"),
]
