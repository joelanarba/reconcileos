"""Controlled Gateway-context checks; live JWT verification belongs to API Gateway."""
import copy
import time

from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest

from app.core.config import Settings


SUBJECT = "00000000-0000-4000-8000-000000000002"
HOSTED = dict(
    app_mode="aws", aws_account_id="123456789012", aws_api_id="abc123def4",
    cognito_client_id="exampleclient", cognito_issuer="https://cognito-idp.us-east-1.amazonaws.com/us-east-1_example",
)


def gateway_event():
    return {"requestContext": {"accountId": HOSTED["aws_account_id"], "apiId": HOSTED["aws_api_id"],
        "authorizer": {"jwt": {"claims": {
            "iss": HOSTED["cognito_issuer"], "client_id": HOSTED["cognito_client_id"],
            "token_use": "access", "sub": SUBJECT, "exp": str(time.time() + 300),
            "scope": "openid aws.cognito.signin.user.admin", "cognito:groups": "[reconcileos-operators]",
        }}}}}


class GatewayContext:
    def __init__(self, app, event):
        self.app, self.event = app, event

    async def __call__(self, scope, receive, send):
        scope = {**scope, "aws.event": copy.deepcopy(self.event), "aws.context": object()}
        await self.app(scope, receive, send)


def hosted_client(client, event=None):
    # Only authentication is under test. Reuse the migrated SQLite fixture, without
    # pretending it satisfies the real hosted PostgreSQL/TLS startup requirements.
    client.app.state.settings = client.app.state.settings.model_copy(update=HOSTED)
    return TestClient(GatewayContext(client.app, event or gateway_event()))


def test_hosted_rejects_http_headers_without_gateway_context(client):
    client.app.state.settings = client.app.state.settings.model_copy(update=HOSTED)
    response = client.get("/api/workspace", headers={"Authorization": "Bearer invented-token", "X-Actor": "admin", "X-Cognito-Groups": "reconcileos-operators"})
    assert response.status_code == 401
    assert client.get("/api/health").status_code == 200


@pytest.mark.parametrize("field,value,status", [
    ("iss", "https://other.example", 401), ("client_id", "otherclient", 401),
    ("token_use", "id", 401), ("sub", None, 401),
    ("exp", "0", 401), ("exp", "NaN", 401), ("exp", "Infinity", 401),
    ("scope", "openid", 403), ("cognito:groups", "[different-group]", 403),
])
def test_hosted_rejects_wrong_or_expired_identity(client, field, value, status):
    event = gateway_event()
    event["requestContext"]["authorizer"]["jwt"]["claims"][field] = value
    assert hosted_client(client, event).get("/api/workspace").status_code == status


@pytest.mark.parametrize("field", ["accountId", "apiId"])
def test_context_must_come_from_the_configured_account_and_api(client, field):
    event = gateway_event()
    event["requestContext"][field] = "different"
    assert hosted_client(client, event).get("/api/workspace").status_code == 401


@pytest.mark.parametrize("groups", [["reconcileos-operators"], '["reconcileos-operators"]', "[reconcileos-operators]", "reconcileos-operators"])
def test_approved_operator_can_access_workspace(client, groups):
    event = gateway_event()
    event["requestContext"]["authorizer"]["jwt"]["claims"]["cognito:groups"] = groups
    response = hosted_client(client, event).get("/api/workspace")
    assert response.status_code == 200
    assert response.json()["mode"] == "aws"
    assert response.json()["operator"] == "cognito:" + SUBJECT


@pytest.mark.parametrize("subject", ["opaque-cognito-subject", "opaque-subject-" + "x" * 200])
def test_cognito_subject_is_opaque_and_fits_the_audit_actor(client, subject):
    event = gateway_event()
    event["requestContext"]["authorizer"]["jwt"]["claims"]["sub"] = subject
    hosted = hosted_client(client, event)
    response = hosted.get("/api/workspace")
    assert response.status_code == 200
    actor = response.json()["operator"]
    assert actor.startswith("cognito:") and len(actor) <= 80
    assert hosted.get("/api/workspace").json()["operator"] == actor
    if len(subject) <= 64:
        assert actor == "cognito:" + subject


def test_hosted_review_records_authenticated_actor(imported_client):
    run = imported_client.post("/api/runs").json()
    case = imported_client.get(f"/api/discrepancies?run_id={run['id']}").json()["items"][0]
    response = hosted_client(imported_client).post(f"/api/investigations/{case['id']}/review", json={
        "action": "note", "expected_version": case["version"], "reason": "Checked the supplied source evidence.",
    })
    assert response.status_code == 200
    assert response.json()["audit_history"][-1]["actor"] == "cognito:" + SUBJECT


def hosted_settings(**changes):
    values = dict(HOSTED,
        database_url="postgresql+psycopg://example:example@database.internal/reconcileos?sslmode=verify-full&sslrootcert=/var/task/certs/rds.pem",
        allowed_hosts=["abc123def4.execute-api.us-east-1.amazonaws.com"], cors_origins=["https://example.cloudfront.net"],
    )
    values.update(changes)
    return Settings(**values, _env_file=None)


def test_aws_settings_require_postgres_tls_and_explicit_origins():
    assert hosted_settings().app_mode == "aws"
    for changes in (
        {"database_url": "sqlite:///test.db"}, {"database_url": "postgresql+psycopg://example:example@database.internal/reconcileos"},
        {"allowed_hosts": ["*"]}, {"allowed_hosts": ["localhost"]}, {"cognito_client_id": None},
        {"cors_origins": ["http://example.cloudfront.net"]}, {"cors_origins": ["https://user:password@example.cloudfront.net"]},
    ):
        with pytest.raises(ValidationError):
            hosted_settings(**changes)
