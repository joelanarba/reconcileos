"""Private, IAM-invoked database initialization and synthetic verification."""
import contextlib
import io
import json
import os

from alembic import command
from alembic.config import Config
import psycopg
from psycopg import sql
from sqlalchemy.engine import make_url

from aws_runtime import ROOT, database_url, read_secret


def migrate(url):
    config = Config(str(ROOT / "alembic.ini"))
    config.attributes["database_url"] = url
    command.upgrade(config, "head")
    command.check(config)


def connection(url, **kwargs):
    parsed = make_url(url)
    return psycopg.connect(host=parsed.host, port=parsed.port, user=parsed.username, password=parsed.password,
        dbname=parsed.database, **dict(parsed.query), **kwargs)


def handler(event, context):
    if not isinstance(event, dict) or event.get("action") not in ("initialize", "verify_postgres", "connectivity"):
        raise ValueError("Choose an explicitly supported maintenance action.")
    if event["action"] == "connectivity":
        # Bounded, unauthenticated connectivity only. No financial evidence leaves AWS.
        import httpx
        response = httpx.get("https://api.openai.com/v1/models", timeout=8, follow_redirects=False)
        return {"openai_https_reachable": response.status_code == 401}
    admin = read_secret(os.environ["MASTER_DB_SECRET_ARN"])
    app = read_secret(os.environ["APP_DB_SECRET_ARN"])
    url = database_url(admin)
    if event["action"] == "initialize":
        migrate(url)
        with connection(url) as conn:
            if not conn.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (app["username"],)).fetchone():
                conn.execute(sql.SQL("CREATE ROLE {} LOGIN PASSWORD {}").format(sql.Identifier(app["username"]), sql.Literal(app["password"])))
            else:
                conn.execute(sql.SQL("ALTER ROLE {} PASSWORD {}").format(sql.Identifier(app["username"]), sql.Literal(app["password"])))
            role = sql.Identifier(app["username"])
            conn.execute(sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(sql.Identifier(os.environ["DB_NAME"]), role))
            conn.execute(sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(role))
            conn.execute(sql.SQL("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {}").format(role))
            conn.execute(sql.SQL("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {}").format(role))
        with connection(database_url(app)) as conn:
            ready = conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
        return {"initialized": True, "schema_version": ready}
    if event.get("confirm_dedicated_test_database") is not True:
        raise ValueError("Dedicated synthetic database confirmation is required.")
    test_name = "reconcileos_verification"
    with connection(database_url(admin, "postgres"), autocommit=True) as conn:
        if conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (test_name,)).fetchone():
            raise ValueError("The verification database already exists; it is never cleared automatically.")
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(test_name)))
    # The maintenance function has no public integration or financial-data routes.
    # Exercise the real services against a separate database using synthetic inputs.
    os.environ["POSTGRES_TEST_DATABASE_URL"] = database_url(admin, test_name)
    os.environ["DATABASE_URL"] = os.environ["POSTGRES_TEST_DATABASE_URL"]
    from verify_postgres import verify
    with contextlib.redirect_stdout(io.StringIO()):
        verify(os.environ["POSTGRES_TEST_DATABASE_URL"], ROOT / "sample-data")
    return {"verified": True, "database": test_name, "checks": ["migrations", "schema_parity", "synthetic_oracle", "review_audit", "csv_export", "allocation_uniqueness"]}
