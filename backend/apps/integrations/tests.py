from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import FinancialAccount
from apps.accounts.services import balances_for_owner
from apps.categories.models import Category
from apps.categories.services import seed_default_categories
from apps.credit_cards.models import CreditCard
from apps.transactions.models import Transaction
from common.crypto import CredentialDecryptionError, decrypt_credential, encrypt_credential

from .categorizer import TransactionCategorizer
from .models import PluggyCredential
from .services import sync_user_pluggy

User = get_user_model()

SAMPLE_CLIENT_ID = "00000000-1111-4222-8333-444444444444"
SAMPLE_CLIENT_SECRET = "super-secret-pluggy-key-12345"
SAMPLE_ITEM_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
SAMPLE_BANK_ACC_ID = "11111111-2222-3333-4444-555555555555"
SAMPLE_CARD_ACC_ID = "66666666-7777-8888-9999-000000000000"


class CryptoSecurityTests(TestCase):
    def test_aes256_gcm_roundtrip_and_aad_protection(self):
        token = encrypt_credential(SAMPLE_CLIENT_SECRET, owner_id=42, field_name="client_secret")
        self.assertTrue(token.startswith("v1:"))
        self.assertNotIn(SAMPLE_CLIENT_SECRET, token)

        recovered = decrypt_credential(token, owner_id=42, field_name="client_secret")
        self.assertEqual(recovered, SAMPLE_CLIENT_SECRET)

        # Ataque de transplante entre usuários (owner_id diferente deve falhar na tag GCM)
        with self.assertRaises(CredentialDecryptionError):
            decrypt_credential(token, owner_id=99, field_name="client_secret")

        # Ataque de troca de coluna (field_name diferente deve falhar na tag GCM)
        with self.assertRaises(CredentialDecryptionError):
            decrypt_credential(token, owner_id=42, field_name="client_id")


class CategorizerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="kayron_cat", password="StrongPassword!123")
        seed_default_categories(self.user)
        self.acc = FinancialAccount.objects.create(owner=self.user, name="Principal")

    def test_three_layer_categorization(self):
        categorizer = TransactionCategorizer(self.user)

        # Camada 2: Palavras-chave brasileiras
        c_food = categorizer.guess(kind=Category.Kind.EXPENSE, description="IFD*IFOOD RESTAURANTE 12/11")
        self.assertEqual(c_food.name, "Alimentação")

        c_uber = categorizer.guess(kind=Category.Kind.EXPENSE, description="UBER *TRIP HELP.UBER.COM")
        self.assertEqual(c_uber.name, "Transporte")

        c_sub = categorizer.guess(kind=Category.Kind.EXPENSE, description="NETFLIX.COM ASSINATURA")
        self.assertEqual(c_sub.name, "Assinaturas")

        c_sal = categorizer.guess(kind=Category.Kind.INCOME, description="PAGAMENTO FOLha SALARIO")
        self.assertEqual(c_sal.name, "Salário")

        # Camada 3: Fallback para categoria da Pluggy
        c_pluggy = categorizer.guess(
            kind=Category.Kind.EXPENSE,
            description="ESTABELECIMENTO DESCONHECIDO LTDA",
            pluggy_category="Pharmacies",
        )
        self.assertEqual(c_pluggy.name, "Saúde")

        # Camada 1: Aprendizado do histórico do próprio usuário sobrepõe o padrão
        lazer_cat = Category.objects.get(owner=self.user, kind=Category.Kind.EXPENSE, name="Lazer")
        Transaction.objects.create(
            owner=self.user,
            type=Transaction.Type.EXPENSE,
            description="PADARIA DO SEU ZE 01/10",
            amount=Decimal("25.00"),
            category=lazer_cat,
            account=self.acc,
            date="2026-10-01",
            status=Transaction.Status.REALIZED,
        )
        categorizer_reloaded = TransactionCategorizer(self.user)
        c_learned = categorizer_reloaded.guess(kind=Category.Kind.EXPENSE, description="PADARIA DO SEU ZE 15/11")
        self.assertEqual(c_learned.name, "Lazer")


class PluggySyncAndEndpointsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="kayron_sync", password="StrongPassword!123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _build_mock_pluggy_client(self):
        mock_api = MagicMock()
        mock_api.authenticate.return_value = "jwt-temp-token"
        mock_api.list_accounts.return_value = [
            {
                "id": SAMPLE_BANK_ACC_ID,
                "type": "BANK",
                "subtype": "CHECKING_ACCOUNT",
                "name": "Conta Corrente Pluggy",
                "balance": 43701.43,
            },
            {
                "id": SAMPLE_CARD_ACC_ID,
                "type": "CREDIT",
                "subtype": "CREDIT_CARD",
                "name": "Mastercard Black",
                "balance": -1006.20,
                "creditData": {
                    "brand": "MASTERCARD",
                    "creditLimit": 15000,
                    "balanceCloseDate": "2026-11-10",
                    "balanceDueDate": "2026-11-17",
                },
            },
        ]

        def fake_list_tx(account_id, **kwargs):
            if account_id == SAMPLE_BANK_ACC_ID:
                return [
                    {
                        "id": "tx-bank-1",
                        "description": "PAGAMENTO SALARIO EMPRESA",
                        "amount": 5000.00,
                        "type": "CREDIT",
                        "date": "2026-11-05T10:00:00Z",
                        "status": "POSTED",
                    },
                    {
                        "id": "tx-bank-2",
                        "description": "SUPERMERCADO CARREFOUR",
                        "amount": -350.50,
                        "type": "DEBIT",
                        "date": "2026-11-06T14:20:00Z",
                        "status": "POSTED",
                    },
                ]
            return [
                {
                    "id": "tx-card-1",
                    "description": "UBER *TRIP SAO PAULO",
                    "amount": 42.90,
                    "type": "DEBIT",
                    "date": "2026-11-07T18:00:00Z",
                    "status": "POSTED",
                },
                {
                    "id": "tx-card-payment-ignored",
                    "description": "Pagamento de fatura",
                    "amount": -1000.00,
                    "type": "CREDIT",
                    "date": "2026-11-08T12:00:00Z",
                    "status": "POSTED",
                },
            ]

        mock_api.list_transactions.side_effect = fake_list_tx
        return mock_api

    @patch("apps.integrations.views.PluggyClient")
    def test_put_get_sync_and_idempotency(self, mock_client_cls):
        mock_api = self._build_mock_pluggy_client()
        mock_client_cls.return_value = mock_api

        resp = self.client.put(
            "/api/v1/integrations/pluggy/",
            {
                "client_id": SAMPLE_CLIENT_ID,
                "client_secret": SAMPLE_CLIENT_SECRET,
                "item_ids": SAMPLE_ITEM_ID,
                "sync_now": True,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["is_connected"])
        self.assertEqual(data["client_id_masked"], "••••••••6b75")
        self.assertNotIn("client_secret", data)
        self.assertNotIn(SAMPLE_CLIENT_SECRET, str(data))
        self.assertEqual(data["last_synced_count"], 3)

        # Verifica conta criada e saldo reconciliado exatamente com os R$ 43.701,43 do banco
        bank_acc = FinancialAccount.objects.get(owner=self.user, external_id=f"pluggy:{SAMPLE_BANK_ACC_ID}")
        derived_balance = balances_for_owner(self.user)[bank_acc.pk]
        self.assertEqual(derived_balance, Decimal("43701.43"))

        # Verifica cartão criado e compra vinculada à fatura (e que o pagamento da fatura foi ignorado)
        card = CreditCard.objects.get(owner=self.user, external_id=f"pluggy:{SAMPLE_CARD_ACC_ID}")
        self.assertEqual(card.purchases.count(), 1)
        card_tx = card.purchases.first()
        self.assertEqual(card_tx.amount, Decimal("42.90"))
        self.assertEqual(card_tx.category.name, "Transporte")

        # Segunda sincronização deve ser 100% idempotente (0 duplicatas)
        cred = PluggyCredential.objects.get(owner=self.user)
        second_sync = sync_user_pluggy(cred, client=mock_api)
        self.assertEqual(second_sync["created_transactions"], 0)
        self.assertEqual(second_sync["skipped_transactions"], 4)
        self.assertEqual(Transaction.objects.filter(owner=self.user).count(), 3)

