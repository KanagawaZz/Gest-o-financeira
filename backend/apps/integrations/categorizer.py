"""Motor de categorização inteligente em 3 camadas para transações do Open Finance.

Camada 1: Aprendizado com o histórico do próprio usuário (descrições normalizadas já categorizadas).
Camada 2: Dicionário de palavras-chave / expressões comuns no Brasil (bancos, apps, comércio).
Camada 3: Mapeamento da categoria nativa enviada pela API da Pluggy -> Categoria NEXO (ou 'Outros').
"""
import re
import unicodedata

from apps.categories.models import Category
from apps.transactions.models import Transaction

# Palavras-chave para DESPESAS (avaliadas sobre texto minúsculo sem acentos)
EXPENSE_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    (
        "Transporte",
        (
            "uber",
            "99app",
            "99 pop",
            "99*",
            "cabify",
            "indrive",
            "sem parar",
            "veloe",
            "conectcar",
            "taggy",
            "pedagio",
            "metro",
            "cptm",
            "bilhete unico",
            "onibus",
            "passagem",
            "latam",
            "gol linhas",
            "azul linhas",
        ),
    ),
    (
        "Veículo",
        (
            "posto ",
            "auto posto",
            "ipiranga",
            "shell",
            "petrobras",
            "br mania",
            "ale combustiveis",
            "combustivel",
            "gasolina",
            "etanol",
            "estacionamento",
            "indigo",
            "estapar",
            "oficina",
            "pneus",
            "autocenter",
            "ipva",
            "detran",
        ),
    ),
    (
        "Alimentação",
        (
            "ifood",
            "ifd*",
            "rappi",
            "ze delivery",
            "aiqfome",
            "supermercado",
            "mercado",
            "atacadao",
            "assai",
            "carrefour",
            "pao de acucar",
            "extra hiper",
            "big ",
            "fort atacadista",
            "comper",
            "padaria",
            "panificadora",
            "confeitaria",
            "restaurante",
            "lanchonete",
            "churrascaria",
            "pizzaria",
            "pizza",
            "burger",
            "mcdonalds",
            "mc donalds",
            "bk ",
            "burger king",
            "outback",
            "starbucks",
            "cafeteria",
            "acougue",
            "hortifruti",
        ),
    ),
    (
        "Assinaturas",
        (
            "netflix",
            "spotify",
            "amazon prime",
            "prime video",
            "disney",
            "hbo",
            "max.com",
            "globoplay",
            "youtube",
            "google one",
            "google *",
            "apple.com/bill",
            "icloud",
            "microsoft",
            "chatgpt",
            "openai",
            "anthropic",
            "claude",
            "canva",
            "adobe",
            "github",
        ),
    ),
    (
        "Saúde",
        (
            "drogaria",
            "droga raia",
            "drogasil",
            "pague menos",
            "panvel",
            "farmacia",
            "unimed",
            "bradesco saude",
            "amil",
            "sulamerica",
            "hapvida",
            "hospital",
            "clinica",
            "laboratorio",
            "sabins",
            "fleury",
            "odonto",
            "dentista",
            "psicolog",
            "consulta",
        ),
    ),
    (
        "Moradia",
        (
            "aluguel",
            "condominio",
            "iptu",
            "energisa",
            "enel",
            "cpfl",
            "cemig",
            "copel",
            "celesc",
            "equatorial",
            "light",
            "neoenergia",
            "sabesp",
            "aguas ",
            "sanepar",
            "copasa",
            "comgas",
            "ultragaz",
            "claro",
            "vivo",
            "tim ",
            "oi ",
            "algar",
            "internet",
            "fibra",
        ),
    ),
    (
        "Educação",
        (
            "faculdade",
            "universidade",
            "escola",
            "colegio",
            "curso",
            "alura",
            "udemy",
            "rocketseat",
            "coursera",
            "livraria",
            "mensalidade escolar",
        ),
    ),
    (
        "Lazer",
        (
            "cinema",
            "cinemark",
            "ingresso",
            "sympla",
            "eventim",
            "steam",
            "playstation",
            "xbox",
            "nintendo",
            "bar ",
            "pub ",
            "balada",
            "hotel",
            "airbnb",
            "booking.com",
            "decolar",
        ),
    ),
    (
        "Compras",
        (
            "mercado livre",
            "mercadolivre",
            "shopee",
            "amazon",
            "magalu",
            "magazine luiza",
            "casas bahia",
            "americanas",
            "aliexpress",
            "shein",
            "renner",
            "riachuelo",
            "cea ",
            "zara",
            "centauro",
            "netshoes",
            "leroy merlin",
            "kalunga",
        ),
    ),
    (
        "Financiamentos",
        (
            "financiamento",
            "emprestimo",
            "parcela emprestimo",
            "consignado",
            "crediario",
            "juros",
            "iof",
        ),
    ),
    (
        "Serviços",
        (
            "tarifa bancaria",
            "pacote de servicos",
            "anuidade",
            "seguro",
            " Porto seguro",
            "tokio marine",
            "azul seguros",
            "lavanderia",
            "barbearia",
            "salao",
            "pet shop",
            "cobasi",
            "petz",
            "cartorio",
            "contabilidade",
        ),
    ),
]

# Palavras-chave para RECEITAS
INCOME_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    (
        "Salário",
        (
            "salario",
            "pagamento folha",
            "folha de pagamento",
            "pro-labore",
            "prolabore",
            "adiantamento salarial",
            "13 salario",
            "ferias",
            "remuneracao",
        ),
    ),
    (
        "Investimentos",
        (
            "dividendo",
            "jcp",
            "juros sobre capital",
            "rendimento",
            "resgate",
            "tesouro direto",
            "cdb",
            "lci",
            "lca",
            "fii",
        ),
    ),
    (
        "Reembolso",
        (
            "reembolso",
            "estorno",
            "cashback",
            "devolucao",
        ),
    ),
    (
        "Renda extra",
        (
            "freelance",
            "servico prestado",
            "honorarios",
            "comissao",
            "venda",
        ),
    ),
]

# De-Para das categorias nativas da Pluggy (em inglês e português)
PLUGGY_CATEGORY_MAP_EXPENSE: dict[str, str] = {
    "food and groceries": "Alimentação",
    "groceries": "Alimentação",
    "eating out": "Alimentação",
    "restaurants": "Alimentação",
    "food delivery": "Alimentação",
    "supermarkets": "Alimentação",
    "alimentacao": "Alimentação",
    "supermercado": "Alimentação",
    "restaurantes": "Alimentação",
    "transportation": "Transporte",
    "public transit": "Transporte",
    "taxi and ride-sharing": "Transporte",
    "transporte": "Transporte",
    "automotive": "Veículo",
    "gas stations": "Veículo",
    "parking": "Veículo",
    "tolls": "Veículo",
    "housing": "Moradia",
    "rent": "Moradia",
    "utilities": "Moradia",
    "electricity": "Moradia",
    "water": "Moradia",
    "telecommunications": "Moradia",
    "internet": "Moradia",
    "moradia": "Moradia",
    "healthcare": "Saúde",
    "pharmacy": "Saúde",
    "pharmacies": "Saúde",
    "medical": "Saúde",
    "dentist": "Saúde",
    "saude": "Saúde",
    "education": "Educação",
    "educacao": "Educação",
    "entertainment": "Lazer",
    "leisure": "Lazer",
    "travel": "Lazer",
    "hotels": "Lazer",
    "lazer": "Lazer",
    "digital services": "Assinaturas",
    "subscriptions": "Assinaturas",
    "streaming": "Assinaturas",
    "shopping": "Compras",
    "clothing": "Compras",
    "electronics": "Compras",
    "compras": "Compras",
    "loans and financing": "Financiamentos",
    "loans": "Financiamentos",
    "interest": "Financiamentos",
    "taxes": "Serviços",
    "bank fees": "Serviços",
    "services": "Serviços",
    "insurance": "Serviços",
}

PLUGGY_CATEGORY_MAP_INCOME: dict[str, str] = {
    "salary": "Salário",
    "payroll": "Salário",
    "salario": "Salário",
    "investments": "Investimentos",
    "dividends": "Investimentos",
    "interest income": "Investimentos",
    "refund": "Reembolso",
    "cashback": "Reembolso",
}


def normalize_text(text: str) -> str:
    """Remove acentos, converte para minúsculas e colapsa espaços extras."""
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFKD", text)
    ascii_text = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", ascii_text.lower()).strip()


def normalize_merchant_key(description: str) -> str:
    """Extrai a raiz alfabética da descrição (ignorando datas e códigos numéricos de fim de string)."""
    norm = normalize_text(description)
    # Remove datas tipo 12/11, números de parcela e códigos longos
    cleaned = re.sub(r"\b\d{1,2}/\d{1,2}(/\d{2,4})?\b", "", norm)
    cleaned = re.sub(r"\d+", "", cleaned)
    cleaned = re.sub(r"[^a-z\s]", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()[:40]


class TransactionCategorizer:
    """Classificador com cache por usuário para categorizar um lote de transações sem N+1 queries."""

    def __init__(self, user):
        self.user = user
        self._categories_by_kind_and_name: dict[tuple[str, str], Category] = {}
        self._history_map: dict[tuple[str, str], int] = {}
        self._load_context()

    def _load_context(self) -> None:
        categories = Category.objects.filter(owner=self.user, is_archived=False)
        for cat in categories:
            key = (cat.kind, normalize_text(cat.name))
            self._categories_by_kind_and_name[key] = cat

        # Carrega até as últimas 300 transações categorizadas pelo usuário para aprendizado local
        recent = (
            Transaction.objects.filter(owner=self.user, category__isnull=False)
            .values_list("type", "description", "category_id")
            .order_by("-date", "-id")[:300]
        )
        for tx_type, desc, cat_id in recent:
            kind = Category.Kind.INCOME if tx_type == Transaction.Type.INCOME else Category.Kind.EXPENSE
            mkey = normalize_merchant_key(desc)
            if len(mkey) >= 4 and (kind, mkey) not in self._history_map:
                self._history_map[(kind, mkey)] = cat_id

    def _find_category(self, kind: str, target_name: str) -> Category | None:
        return self._categories_by_kind_and_name.get((kind, normalize_text(target_name)))

    def guess(self, *, kind: str, description: str, pluggy_category: str | None = None) -> Category | None:
        """Retorna a melhor Category do usuário para a transação (ou 'Outros' como fallback)."""
        # 1. Histórico do próprio usuário
        mkey = normalize_merchant_key(description)
        if len(mkey) >= 4:
            hist_cat_id = self._history_map.get((kind, mkey))
            if hist_cat_id:
                for cat in self._categories_by_kind_and_name.values():
                    if cat.id == hist_cat_id:
                        return cat

        # 2. Dicionário de palavras-chave na descrição
        norm_desc = normalize_text(description)
        rules = INCOME_KEYWORDS if kind == Category.Kind.INCOME else EXPENSE_KEYWORDS
        for cat_name, keywords in rules:
            if any(kw in norm_desc for kw in keywords):
                matched = self._find_category(kind, cat_name)
                if matched:
                    return matched

        # 3. De-Para da categoria nativa da Pluggy
        if pluggy_category:
            norm_pluggy = normalize_text(pluggy_category)
            cmap = PLUGGY_CATEGORY_MAP_INCOME if kind == Category.Kind.INCOME else PLUGGY_CATEGORY_MAP_EXPENSE
            for p_key, target_cat_name in cmap.items():
                if p_key in norm_pluggy:
                    matched = self._find_category(kind, target_cat_name)
                    if matched:
                        return matched

        # 4. Fallback seguro: categoria "Outros"
        return self._find_category(kind, "Outros")

