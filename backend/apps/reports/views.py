from django.http import HttpResponse
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from common.utilities.dates import month_index

from . import exports, services


class PeriodSerializer(serializers.Serializer):
    date_from = serializers.DateField()
    date_to = serializers.DateField()

    def validate(self, attrs):
        if attrs["date_from"] > attrs["date_to"]:
            raise serializers.ValidationError({"date_to": "A data final não pode ser anterior à inicial."})
        if month_index(attrs["date_to"], attrs["date_from"]) > services.MAX_SPAN_MONTHS:
            raise serializers.ValidationError({"date_to": "O período máximo é de 5 anos."})
        return attrs


def _period(request):
    s = PeriodSerializer(data=request.query_params)
    s.is_valid(raise_exception=True)
    return s.validated_data["date_from"], s.validated_data["date_to"]


class SummaryReportView(APIView):
    def get(self, request):
        d_from, d_to = _period(request)
        return Response(services.build_report(request.user, d_from, d_to))


class CsvExportView(APIView):
    def get(self, request):
        d_from, d_to = _period(request)
        resp = HttpResponse(exports.transactions_csv(request.user, d_from, d_to), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="nexo-transacoes-{d_from}-{d_to}.csv"'
        resp["Cache-Control"] = "no-store"
        return resp


class PdfExportView(APIView):
    def get(self, request):
        d_from, d_to = _period(request)
        report = services.build_report(request.user, d_from, d_to)
        resp = HttpResponse(exports.report_pdf(report, request.user.first_name or request.user.username), content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="nexo-relatorio-{d_from}-{d_to}.pdf"'
        resp["Cache-Control"] = "no-store"
        return resp
