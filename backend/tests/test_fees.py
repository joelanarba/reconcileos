import pytest

from app.core.config import Settings
from app.core.errors import AppError
from app.core.fees import fee_configuration


def test_missing_fee_configuration_is_explicit():
    assert fee_configuration(Settings(_env_file=None))["rules"] == {}


@pytest.mark.parametrize("text", [
    '{"name":"test","rules":{"MTN":{"GHS":{"basis_points":1.5}}}}',
    '{"name":"test","rules":{"MTN":{"GHS":{"basis_points":10001}}}}',
    '{"name":"test","rules":{"MTN":{"ZZZ":{"basis_points":100}}}}',
    '{"name":"one","name":"two","rules":{}}',
])
def test_invalid_fee_file_fails_closed(tmp_path, text):
    path = tmp_path / "fees.json"
    path.write_text(text)
    with pytest.raises(AppError, match="no default fees"):
        fee_configuration(Settings(fee_rules_path=str(path), _env_file=None))
