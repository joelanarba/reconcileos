"""Controlled AWS boundary tests. These do not contact AWS or run PostgreSQL."""
import json
from types import SimpleNamespace

import pytest
from sqlalchemy.engine import make_url

pytest.importorskip("boto3", reason="Install requirements-aws.txt for optional AWS adapter checks.")
Mangum = pytest.importorskip("mangum", reason="Install requirements-aws.txt for optional AWS adapter checks.").Mangum

import aws_runtime
import aws_maintenance
from tests.test_hosted_security import gateway_event, HOSTED, SUBJECT


def test_database_secret_uses_tls_and_preserves_credential_characters(monkeypatch):
    monkeypatch.setenv("DB_HOST", "example.internal")
    monkeypatch.setenv("DB_NAME", "reconcileos")
    url = make_url(aws_runtime.database_url({"username": "reconcile_app", "password": "example:@/?#"}))
    assert url.password == "example:@/?#"
    assert url.host == "example.internal" and url.database == "reconcileos"
    assert url.query["sslmode"] == "verify-full" and url.query["sslrootcert"].endswith("rds.pem")


def test_lambda_refuses_local_mode_before_loading_secrets(monkeypatch):
    monkeypatch.setattr(aws_runtime, "_adapter", None)
    monkeypatch.setenv("APP_MODE", "local")
    monkeypatch.setattr(aws_runtime, "read_secret", lambda *_: pytest.fail("No secret should be read in local mode."))
    with pytest.raises(RuntimeError, match="requires hosted mode"):
        aws_runtime.handler({}, object())


def test_mangum_transports_gateway_identity_and_rejects_unverified_claims(client, monkeypatch):
    client.app.state.settings = client.app.state.settings.model_copy(update=HOSTED)
    monkeypatch.setattr(aws_runtime, "_adapter", Mangum(client.app))
    event = gateway_event() | {"version": "2.0", "routeKey": "ANY /api/{proxy+}", "rawPath": "/api/workspace", "rawQueryString": "", "headers": {"host": "testserver"}, "isBase64Encoded": False}
    event["requestContext"].update({"stage": "$default", "http": {"method": "GET", "path": "/api/workspace", "sourceIp": "127.0.0.1", "protocol": "HTTP/1.1"}})
    response = aws_runtime.handler(event, SimpleNamespace())
    assert response["statusCode"] == 200
    assert json.loads(response["body"])["operator"] == "cognito:" + SUBJECT
    event["requestContext"].pop("authorizer")
    assert aws_runtime.handler(event, SimpleNamespace())["statusCode"] == 401


def test_maintenance_rejects_unknown_actions_without_any_secrets(monkeypatch):
    monkeypatch.setattr(aws_maintenance, "read_secret", lambda *_: pytest.fail("Unsupported actions must fail before accessing secrets."))
    with pytest.raises(ValueError, match="supported maintenance action"):
        aws_maintenance.handler({"action": "execute_sql", "sql": "arbitrary"}, object())


def test_synthetic_verification_requires_explicit_confirmation(monkeypatch):
    monkeypatch.setenv("MASTER_DB_SECRET_ARN", "synthetic-master-secret")
    monkeypatch.setenv("APP_DB_SECRET_ARN", "synthetic-app-secret")
    monkeypatch.setenv("DB_HOST", "example.internal")
    monkeypatch.setenv("DB_NAME", "reconcileos")
    monkeypatch.setattr(aws_maintenance, "read_secret", lambda *_: {"username": "test", "password": "synthetic"})
    monkeypatch.setattr(aws_maintenance, "connection", lambda *_args, **_kwargs: pytest.fail("No database should be created without confirmation."))
    with pytest.raises(ValueError, match="confirmation is required"):
        aws_maintenance.handler({"action": "verify_postgres"}, object())
