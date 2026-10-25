"""AWS-only secret bootstrap and API Gateway adapter. No local credentials ship."""
import json
import os
from pathlib import Path

import boto3
from botocore.config import Config
from sqlalchemy import URL


ROOT = Path(__file__).resolve().parent


def read_secret(secret_id):
    client = boto3.client("secretsmanager", config=Config(connect_timeout=3, read_timeout=5, retries={"max_attempts": 1}))
    response = client.get_secret_value(SecretId=secret_id)
    result = json.loads(response["SecretString"])
    if not isinstance(result, dict):
        raise RuntimeError("The configured secret has an invalid structure.")
    return result


def database_url(credentials, database=None):
    return URL.create("postgresql+psycopg", username=credentials["username"], password=credentials["password"],
        host=os.environ["DB_HOST"], port=5432, database=database or os.environ["DB_NAME"],
        query={"sslmode": "verify-full", "sslrootcert": str(ROOT / "certs" / "rds.pem"), "connect_timeout": "5"},
    ).render_as_string(hide_password=False)


_adapter = None


def handler(event, context):
    global _adapter
    if _adapter is None:
        # Refuse accidental deployment of the unauthenticated local mode.
        if os.environ.get("APP_MODE") != "aws":
            raise RuntimeError("The AWS handler requires hosted mode.")
        os.environ["DATABASE_URL"] = database_url(read_secret(os.environ["APP_DB_SECRET_ARN"]))
        ai = read_secret(os.environ["AI_SECRET_ARN"])
        if ai.get("api_key"):
            os.environ["LLM_API_KEY"] = ai["api_key"]
            os.environ["LLM_BASE_URL"] = "https://api.openai.com/v1"
            os.environ["LLM_MODEL"] = ai["model"]
            os.environ["LLM_RESPONSE_FORMAT"] = "json_schema"
        from mangum import Mangum
        from app.main import app
        _adapter = Mangum(app)
    return _adapter(event, context)
