from django.urls import path

from .views import CsvExportView, PdfExportView, SummaryReportView

urlpatterns = [
    path("summary/", SummaryReportView.as_view(), name="reports-summary"),
    path("export/csv/", CsvExportView.as_view(), name="reports-csv"),
    path("export/pdf/", PdfExportView.as_view(), name="reports-pdf"),
]
