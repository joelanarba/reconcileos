"""Deployment account and budget guards use controlled clients, without AWS writes."""
from decimal import Decimal
import importlib.util
from types import SimpleNamespace

import pytest

from app.core.config import BACKEND_ROOT

pytest.importorskip("boto3", reason="Install requirements-aws.txt for optional deployment checks.")
spec = importlib.util.spec_from_file_location("deployment_management", BACKEND_ROOT.parent / "deploy" / "manage.py")
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)


def test_wrong_account_is_rejected_before_resource_operations(monkeypatch):
    class Client:
        def get_caller_identity(self):
            return {"Account": "111111111111"}

        def create_stack(self, **kwargs):
            pytest.fail("No resources may be created in a different account.")

    monkeypatch.setattr(deployment.boto3, "Session", lambda **kwargs: SimpleNamespace(client=lambda *_args, **_kwargs: Client()))
    with pytest.raises(RuntimeError, match="differs from"):
        deployment.Deployment(SimpleNamespace(profile="synthetic", account_id="222222222222", region="us-east-1"))


@pytest.mark.parametrize("budget", [None, Decimal("0"), Decimal("19.99"), Decimal("NaN"), Decimal("Infinity")])
def test_provisioning_refuses_missing_or_unreviewed_budget_before_artifact_or_resource_access(budget):
    instance = object.__new__(deployment.Deployment)
    instance.args = SimpleNamespace(monthly_budget=budget)
    with pytest.raises(RuntimeError, match="reviewed monthly budget"):
        instance.provision()
