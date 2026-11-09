from decimal import Decimal

from django.db.models import Count, DecimalField, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.transactions.models import Transaction as T
from apps.transactions.serializers import TransactionSerializer
from common.mixins import OwnedModelViewSet
from common.utilities.dates import add_months, month_bounds
from common.utilities.money import ZERO, split_installments, to_money

from . import services
from .models import InstallmentPlan
from .serializers import InstallmentPlanDetailSerializer, InstallmentPlanSerializer


class PayoffSerializer(serializers.Serializer):
    date = serializers.DateField(required=False)


class PreviewSerializer(serializers.Serializer):
    total_amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    count = serializers.IntegerField(min_value=2, max_value=120)
    first_date = serializers.DateField()


class InstallmentPlanViewSet(OwnedModelViewSet):
    queryset = InstallmentPlan.objects.select_related("category", "account", "credit_card")
    serializer_class = InstallmentPlanSerializer
    search_fields = ["description"]
    ordering_fields = ["created_at", "first_date", "total_amount"]
    http_method_names = ["get", "post", "patch", "head", "options"]  # sem DELETE: cancela-se

    def get_queryset(self):
        qs = super().get_queryset().annotate(
            paid_count=Count("installments", filter=Q(installments__status=T.Status.REALIZED)),
            pending_count=Count("installments", filter=Q(installments__status=T.Status.PENDING)),
            remaining_amount=Coalesce(
                Sum("installments__amount", filter=Q(installments__status=T.Status.PENDING)),
                Decimal("0"), output_field=DecimalField(),
            ),
        ).order_by("-created_at", "-id")  # fmt: skip
        wanted = self.request.query_params.get("status")
        if wanted == "cancelled":
            qs = qs.filter(cancelled_at__isnull=False)
        elif wanted == "finished":
            qs = qs.filter(cancelled_at__isnull=True, pending_count=0)
        elif wanted == "active":
            qs = qs.filter(cancelled_at__isnull=True, pending_count__gt=0)
        return qs

    def get_serializer_class(self):
        return InstallmentPlanDetailSerializer if self.action == "retrieve" else InstallmentPlanSerializer

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        v = ser.validated_data
        plan = services.create_plan(
            request.user, description=v["description"], total_amount=v["total_amount"], count=v["count"],
            first_date=v["first_date"], category=v["category"], account=v.get("account"),
            card=v.get("credit_card"), notes=v.get("notes", ""),
        )  # fmt: skip
        plan = self.get_queryset().get(pk=plan.pk)
        return Response(InstallmentPlanDetailSerializer(plan, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"])
    def preview(self, request):
        """Mostra como as parcelas ficariam (valores e datas) sem criar nada. O cálculo é o mesmo da criação."""
        s = PreviewSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        v = s.validated_data
        parts = split_installments(v["total_amount"], v["count"])
        rows = [{"number": k + 1, "amount": str(p), "date": add_months(v["first_date"], k).isoformat()} for k, p in enumerate(parts)]
        return Response({"installments": rows, "total": str(sum(parts, Decimal("0")))})

    @action(detail=True, methods=["post"])
    def payoff(self, request, pk=None):
        plan = self.get_object()
        d = PayoffSerializer(data=request.data)
        d.is_valid(raise_exception=True)
        services.payoff(plan, d.validated_data.get("date"))
        return Response(InstallmentPlanDetailSerializer(self.get_queryset().get(pk=plan.pk), context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        plan = self.get_object()
        services.cancel_plan(plan)
        return Response(InstallmentPlanDetailSerializer(self.get_queryset().get(pk=plan.pk), context=self.get_serializer_context()).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Total ainda comprometido, parcelas do mês e dos próximos meses."""
        rows = T.objects.filter(owner=request.user, installment_plan__isnull=False, status=T.Status.PENDING)
        today = timezone.localdate()
        months = []
        for i in range(6):
            first, last = month_bounds(*divmod_ym(add_months(today.replace(day=1), i)))
            total = rows.filter(date__range=(first, last)).aggregate(t=Sum("amount"))["t"] or ZERO
            months.append({"month": first.strftime("%Y-%m"), "amount": str(to_money(total))})
        committed = rows.aggregate(t=Sum("amount"))["t"] or ZERO
        active = InstallmentPlan.objects.filter(owner=request.user, cancelled_at__isnull=True).annotate(
            pend=Count("installments", filter=Q(installments__status=T.Status.PENDING))
        ).filter(pend__gt=0).count()  # fmt: skip
        total_all = InstallmentPlan.objects.filter(owner=request.user, cancelled_at__isnull=True).aggregate(t=Sum("total_amount"))["t"] or ZERO
        pct = round(100 * (1 - Decimal(committed) / Decimal(total_all))) if total_all else 0
        return Response({"committed_total": str(to_money(committed)), "active_plans": active, "this_month": months[0]["amount"], "next_months": months, "progress_percent": pct})


def divmod_ym(d):
    return d.year, d.month


class InstallmentViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /installments/: parcelas individuais (lançamentos ligados a planos)."""

    serializer_class = TransactionSerializer
    ordering = ["date", "id"]

    def get_queryset(self):
        qs = T.objects.filter(owner=self.request.user, installment_plan__isnull=False).select_related("category", "account", "credit_card")
        p = self.request.query_params
        if p.get("plan", "").isdigit():
            qs = qs.filter(installment_plan_id=int(p["plan"]))
        if p.get("status") in T.Status.values:
            qs = qs.filter(status=p["status"])
        if p.get("month"):
            try:
                y, m = (int(x) for x in p["month"].split("-"))
                qs = qs.filter(date__range=month_bounds(y, m))
            except ValueError:
                raise serializers.ValidationError({"month": "Use o formato AAAA-MM."})
        return qs.order_by("date", "id")
