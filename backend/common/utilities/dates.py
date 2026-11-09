from calendar import monthrange
from datetime import date


def clamp_day(year: int, month: int, day: int) -> date:
    """Data no mês informado; dias inexistentes (31 em fevereiro) viram o último dia."""
    return date(year, month, min(day, monthrange(year, month)[1]))


def add_months(d: date, n: int, anchor_day: int | None = None) -> date:
    """Soma n meses mantendo o dia-âncora (31/jan -> 28/fev -> 31/mar, sem 'derivar')."""
    total = d.year * 12 + (d.month - 1) + n
    return clamp_day(total // 12, total % 12 + 1, anchor_day or d.day)


def month_bounds(year: int, month: int) -> tuple[date, date]:
    return date(year, month, 1), date(year, month, monthrange(year, month)[1])


def month_index(d: date, base: date) -> int:
    """Quantos meses d está após o mês de `base` (negativo se antes)."""
    return (d.year - base.year) * 12 + (d.month - base.month)
