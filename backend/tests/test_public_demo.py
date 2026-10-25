"""Public demo data isolation and write protection use real migrated stores."""
import json

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
import pytest

from app.core.config import BACKEND_ROOT, Settings
from app.main import create_app
from app.public_demo import PublicDemo
from app.services.demo import seed_demo
from tests.conftest import import_fixture
from tests.test_hosted_security import HOSTED


@pytest.fixture
def demo_client(client, tmp_path):
    url = 'sqlite:///' + (tmp_path / 'synthetic.db').as_posix()
    config = Config(str(BACKEND_ROOT / 'alembic.ini'))
    config.attributes['database_url'] = url
    command.upgrade(config, 'head')
    result = seed_demo(url, BACKEND_ROOT.parent / 'sample-data')
    assert result['seeded']
    assert not seed_demo(url, BACKEND_ROOT.parent / 'sample-data')['seeded']
    demo = create_app(Settings(database_url=url, _env_file=None))
    with TestClient(PublicDemo(client.app, demo)) as connection:
        yield connection


def test_demo_matches_manifest_and_primary_stays_empty(demo_client):
    result = demo_client.get('/api/demo/dashboard')
    assert result.status_code == 200
    expected = json.loads((BACKEND_ROOT.parent / 'sample-data/demo/expected-results.json').read_text())
    assert result.json()['latest_run']['original_summary'] == expected['summary']
    assert demo_client.get('/api/demo/workspace').json()['mode'] == 'demo'
    assert demo_client.get('/api/dashboard').json()['latest_run'] is None


@pytest.mark.parametrize('path', ['/runs', '/imports/preview?source_type=orders', '/imports/fake/confirm', '/investigations/fake/review', '/investigations/fake/ai'])
def test_all_demo_mutations_denied_without_changing_data(demo_client, path):
    before = demo_client.get('/api/demo/dashboard').json()
    for method in ('POST', 'PUT', 'PATCH', 'DELETE'):
        response = demo_client.request(method, '/api/demo' + path, json={})
        assert response.status_code == 403
        assert response.json()['detail']['code'] == 'read_only_demo'
    assert demo_client.get('/api/demo/dashboard').json() == before


def test_operator_records_cannot_be_read_through_demo(demo_client, client):
    batch = import_fixture(client, 'orders')
    assert demo_client.get('/api/demo/imports/' + batch['id']).status_code == 404
    client.app.state.settings = client.app.state.settings.model_copy(update=HOSTED)
    assert demo_client.get('/api/workspace').status_code == 401
    assert demo_client.get('/api/demo/workspace').status_code == 200


def test_demo_report_and_source_evidence_are_accessible(demo_client):
    run = demo_client.get('/api/demo/runs').json()['items'][0]
    cases = demo_client.get('/api/demo/discrepancies?run_id=' + run['id']).json()['items']
    detail = demo_client.get('/api/demo/investigations/' + cases[0]['id']).json()
    assert detail['source_records'] and detail['evidence']['rule']
    report = demo_client.get('/api/demo/reports/' + run['id'] + '/export?kind=discrepancies')
    assert report.status_code == 200 and 'text/csv' in report.headers['content-type']


def test_same_database_is_rejected(client):
    with pytest.raises(ValueError, match='separate database'):
        PublicDemo(client.app, create_app(client.app.state.settings))
