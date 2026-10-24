from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
import pytest

from app.core.config import BACKEND_ROOT, Settings
from app.main import create_app


SAMPLE_ROOT = BACKEND_ROOT.parent / "sample-data" / "slice1"


@pytest.fixture
def database_url(tmp_path):
    url = "sqlite:///" + (tmp_path / "test.db").as_posix()
    configuration = Config(str(BACKEND_ROOT / "alembic.ini"))
    configuration.attributes["database_url"] = url
    command.upgrade(configuration, "head")
    return url


@pytest.fixture
def client(database_url):
    application = create_app(Settings(database_url=database_url, _env_file=None))
    with TestClient(application) as connection:
        yield connection


def import_fixture(client, source_type, filename=None):
    path = SAMPLE_ROOT / (filename or f"{source_type}.csv")
    response = client.post(f"/api/imports/preview?source_type={source_type}", content=path.read_bytes(), headers={"X-Filename": path.name, "Content-Type": "text/csv"})
    assert response.status_code == 200, response.text
    batch = response.json()
    confirmed = client.post(f"/api/imports/{batch['id']}/confirm")
    assert confirmed.status_code == 200, confirmed.text
    return confirmed.json()


@pytest.fixture
def imported_client(client):
    import_fixture(client, "orders")
    import_fixture(client, "payments")
    return client
