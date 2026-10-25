import json
import hashlib
import math
import time

from fastapi import Request

from app.core.errors import AppError


REQUIRED_SCOPE = "aws.cognito.signin.user.admin"


def authorize_operator(request: Request):
    """Trust only claims injected by the configured API Gateway JWT authorizer."""
    settings = request.app.state.settings
    if settings.app_mode == "local":
        request.state.actor = settings.local_operator
        return
    if request.url.path == "/api/health":
        request.state.actor = "Health probe"
        return
    event = request.scope.get("aws.event", {})
    context = request.scope.get("aws.context")
    gateway = event.get("requestContext", {})
    jwt = gateway.get("authorizer", {}).get("jwt", {})
    claims = jwt.get("claims", {})
    if not context or gateway.get("accountId") != settings.aws_account_id or gateway.get("apiId") != settings.aws_api_id:
        raise AppError("authentication_required", "Sign in to access this workspace.", 401)
    if claims.get("iss") != settings.cognito_issuer or claims.get("client_id") != settings.cognito_client_id or claims.get("token_use") != "access":
        raise AppError("invalid_identity", "The sign-in identity is not valid for this workspace.", 401)
    subject = claims.get("sub")
    # Cognito subjects are opaque identifiers, not guaranteed RFC UUID values.
    if not isinstance(subject, str) or not 1 <= len(subject) <= 255 or any(ord(char) < 32 or ord(char) == 127 for char in subject):
        raise AppError("invalid_identity", "The sign-in identity is not valid for this workspace.", 401)
    try:
        expiry = float(claims.get("exp", 0))
        if not math.isfinite(expiry) or expiry <= time.time():
            raise ValueError("Expired")
    except (TypeError, ValueError):
        raise AppError("session_expired", "Your session expired. Sign in again.", 401) from None
    if REQUIRED_SCOPE not in str(claims.get("scope", "")).split():
        raise AppError("access_denied", "This identity does not have the required access scope.", 403)
    groups = claims.get("cognito:groups", [])
    if isinstance(groups, str):
        try:
            groups = json.loads(groups)
        except (ValueError, TypeError):
            groups = [group.strip() for group in groups.removeprefix("[").removesuffix("]").split(",")]
    if not isinstance(groups, list) or settings.cognito_operator_group not in groups:
        raise AppError("access_denied", "This account is not assigned to the workspace operator group.", 403)
    request.state.actor = "cognito:" + (subject if len(subject) <= 64 else "h:" + hashlib.sha256(subject.encode("utf-8")).hexdigest())
