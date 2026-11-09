from decimal import Decimal

import pytest

from common.utilities.money import split_installments, to_money


def test_to_money_rejects_float():
    with pytest.raises(TypeError):
        to_money(10.1)


def test_split_sum_equals_total_and_remainder_on_last():
    parts = split_installments("100.00", 3)
    assert parts == [Decimal("33.33"), Decimal("33.33"), Decimal("33.34")]
    assert sum(parts) == Decimal("100.00")


def test_split_single_and_many():
    assert split_installments("10.00", 1) == [Decimal("10.00")]
    for total, n in [("4320.00", 12), ("999.99", 7), ("0.10", 3)]:
        assert sum(split_installments(total, n)) == Decimal(total)
