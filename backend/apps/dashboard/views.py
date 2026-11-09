from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services


class MonthSerializer(serializers.Serializer):
    month = serializers.RegexField(r"^\d{4}-(0[1-9]|1[0-2])$", required=False, error_messages={"invalid": "Use o formato AAAA-MM."})


class ProjectionQuerySerializer(serializers.Serializer):
    months = serializers.ChoiceField(choices=[3, 6, 12, 24], required=False, default=6)


class SimulationSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    installments = serializers.IntegerField(min_value=1, max_value=120, default=1)
    first_date = serializers.DateField()
    months = serializers.ChoiceField(choices=[3, 6, 12, 24], required=False, default=12)


class SummaryView(APIView):
    def get(self, request):
        q = MonthSerializer(data=request.query_params)
        q.is_valid(raise_exception=True)
        ym = q.validated_data.get("month")
        if ym:
            year, month = (int(x) for x in ym.split("-"))
        else:
            t = timezone.localdate()
            year, month = t.year, t.month
        return Response(services.summary(request.user, year, month))


class ProjectionView(APIView):
    def get(self, request):
        q = ProjectionQuerySerializer(data=request.query_params)
        q.is_valid(raise_exception=True)
        months = int(q.validated_data["months"])
        return Response({"months": months, "projection": services.projection(request.user, months)})


class SimulateView(APIView):
    """Simulação pura: não cria movimentações (plano §5.4)."""

    def post(self, request):
        s = SimulationSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        v = s.validated_data
        return Response(services.simulate(request.user, amount=v["amount"], installments=v["installments"], first_date=v["first_date"], months=int(v["months"])))
