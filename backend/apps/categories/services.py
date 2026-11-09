from .models import Category

# (nome, ícone Lucide, cor) — categorias iniciais do plano §4.6
DEFAULT_EXPENSE = [
    ("Moradia", "house", "#6D91B5"),
    ("Alimentação", "utensils", "#D5B77A"),
    ("Transporte", "bus", "#8FA7C4"),
    ("Veículo", "car", "#7F8FA6"),
    ("Educação", "graduation-cap", "#A5B9A9"),
    ("Saúde", "heart-pulse", "#C98282"),
    ("Lazer", "party-popper", "#9B8FC0"),
    ("Assinaturas", "repeat", "#6FA3A8"),
    ("Compras", "shopping-bag", "#C9A28A"),
    ("Serviços", "wrench", "#9BAABD"),
    ("Financiamentos", "landmark", "#B08A8A"),
    ("Outros", "tag", "#9BAABD"),
]
DEFAULT_INCOME = [
    ("Salário", "wallet", "#A5B9A9"),
    ("Renda extra", "sparkles", "#8FB59A"),
    ("Reembolso", "undo-2", "#6D91B5"),
    ("Investimentos", "trending-up", "#7FA89A"),
    ("Outros", "tag", "#9BAABD"),
]


def seed_default_categories(user) -> None:
    """Cria as categorias padrão do usuário (idempotente)."""
    for kind, items in ((Category.Kind.EXPENSE, DEFAULT_EXPENSE), (Category.Kind.INCOME, DEFAULT_INCOME)):
        for name, icon, color in items:
            Category.objects.get_or_create(
                owner=user, kind=kind, name=name, defaults={"icon": icon, "color": color}
            )
