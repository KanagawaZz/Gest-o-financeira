"""Aritmética monetária. Nunca usar float para valores em R$."""
from decimal import ROUND_HALF_EVEN, Decimal

CENT = Decimal("0.01")
ZERO = Decimal("0.00")


def to_money(value) -> Decimal:
    """Converte para Decimal com 2 casas (arredondamento bancário)."""
    if isinstance(value, float):
        raise TypeError("float não é permitido em cálculos monetários.")
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_EVEN)


def split_installments(total, count: int) -> list[Decimal]:
    """Divide `total` em `count` parcelas; a diferença de centavos vai na última."""
    if count < 1:
        raise ValueError("count deve ser >= 1.")
    total = to_money(total)
    base = (total / count).quantize(CENT, rounding=ROUND_HALF_EVEN)
    parts = [base] * count
    parts[-1] = total - base * (count - 1)
    return parts
