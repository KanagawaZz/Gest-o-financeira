"""Popula um usuário de demonstração com dados realistas. Somente em desenvolvimento (DEBUG=True)."""
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.models import FinancialAccount
from apps.categories.models import Category
from apps.credit_cards import services as cards
from apps.credit_cards.models import CreditCard
from apps.goals.models import Goal
from apps.goals.services import contribute
from apps.installments.services import create_plan
from apps.recurring.models import RecurringRule
from apps.recurring.services import ensure_generated
from apps.transactions.models import Transaction as T
from common.utilities.dates import add_months


class Command(BaseCommand):
    help = "Cria (ou recria) um usuário de demonstração com contas, lançamentos, cartão, parcelas, recorrências e metas."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="demo")
        parser.add_argument("--password", required=True, help="Senha do usuário de demonstração.")

    def handle(self, *args, **opts):
        if not settings.DEBUG:
            raise CommandError("seed_demo só roda com DEBUG=True (nunca em produção).")
        User = get_user_model()
        User.objects.filter(username=opts["username"]).delete()
        user = User.objects.create_user(opts["username"], email="demo@exemplo.com", password=opts["password"], first_name="Kayron")

        cat = lambda kind, name: Category.objects.get(owner=user, kind=kind, name=name)  # noqa: E731
        today = timezone.localdate()
        first = today.replace(day=1)

        corrente = FinancialAccount.objects.create(owner=user, name="Conta corrente", initial_balance=Decimal("1500.00"), color="#5A96D2")
        reserva = FinancialAccount.objects.create(owner=user, name="Reserva", type="savings", initial_balance=Decimal("0.00"), color="#3FA77E")
        FinancialAccount.objects.create(owner=user, name="Carteira", type="wallet", initial_balance=Decimal("120.00"), color="#B88D20")

        # Seis meses de histórico realizado.
        for back in range(5, -1, -1):
            m = add_months(first, -back)
            T.objects.create(owner=user, type="income", description="Salário", amount=Decimal("3200.00"), category=cat("income", "Salário"), account=corrente, date=m.replace(day=5), settled_date=m.replace(day=5))
            for day, desc, name, amount in ((8, "Supermercado", "Alimentação", "487.52"), (12, "Combustível", "Transporte", "250.00"), (15, "Academia", "Saúde", "150.00"), (20, "Cinema e jantar", "Lazer", "180.00")):
                d = m.replace(day=day)
                if d <= today:
                    T.objects.create(owner=user, type="expense", description=desc, amount=Decimal(amount), category=cat("expense", name), account=corrente, date=d, settled_date=d)

        # Recorrências (geram pendentes futuros) e uma conta atrasada.
        for desc, name, amount, day, variable in (("Aluguel", "Moradia", "1200.00", 10, False), ("Internet", "Serviços", "100.00", 15, False), ("Conta de luz", "Moradia", "180.00", 18, True), ("Faculdade", "Educação", "435.00", 22, False)):
            RecurringRule.objects.create(owner=user, description=desc, type="expense", amount=Decimal(amount), category=cat("expense", name), account=corrente, frequency="monthly", start_date=first.replace(day=day), variable=variable)
        RecurringRule.objects.create(owner=user, description="Freelance", type="income", amount=Decimal("800.00"), category=cat("income", "Renda extra"), account=corrente, frequency="monthly", start_date=first.replace(day=25), variable=True)
        T.objects.create(owner=user, type="expense", description="IPVA (atrasado)", amount=Decimal("640.00"), category=cat("expense", "Veículo"), account=corrente, date=today - timedelta(days=6), status="pending")
        ensure_generated(user, add_months(today, 24))

        # Cartão com compras e uma compra parcelada; parcelamento em conta.
        visa = CreditCard.objects.create(owner=user, name="Visa", institution="Banco Exemplo", credit_limit=Decimal("5000.00"), closing_day=10, due_day=20, color="#CF7752")
        cards.add_purchase(visa, description="Televisão", amount=Decimal("1800.00"), category=cat("expense", "Compras"), date=today - timedelta(days=3))
        cards.add_purchase(visa, description="Restaurante", amount=Decimal("210.00"), category=cat("expense", "Alimentação"), date=today)
        create_plan(user, description="Notebook", total_amount=Decimal("4200.00"), count=10, first_date=today, category=cat("expense", "Compras"), card=visa)
        plan = create_plan(user, description="Celular", total_amount=Decimal("2400.00"), count=12, first_date=add_months(first, -3), category=cat("expense", "Compras"), account=corrente)
        for row in plan.installments.filter(date__lte=today):
            T.objects.filter(pk=row.pk).update(status="realized", settled_date=row.date)

        # Meta com aporte real.
        meta = Goal.objects.create(owner=user, name="Viagem", target_amount=Decimal("4000.00"), target_date=add_months(today, 8), priority="high")
        contribute(meta, amount=Decimal("500.00"), date=today, account=corrente, destination=reserva)
        Goal.objects.create(owner=user, name="Reserva de emergência", target_amount=Decimal("15000.00"), priority="medium")

        self.stdout.write(self.style.SUCCESS(f"Usuário '{user.username}' criado com dados de demonstração."))
        _ = date  # (import mantido para facilitar edições de datas no seed)
