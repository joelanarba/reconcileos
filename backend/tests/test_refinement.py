from app.api import routes
from test_reviews_reports import act, prepared_case


def test_run_page_only_computes_visible_summaries(imported_client, monkeypatch):
    created = [imported_client.post('/api/runs').json()['id'] for _ in range(3)]
    calculated = []
    original = routes.current_summary

    def track(session, run):
        calculated.append(run.id)
        return original(session, run)

    monkeypatch.setattr(routes, 'current_summary', track)
    page = imported_client.get('/api/runs?page=2&page_size=1').json()
    assert page['total'] == 3
    assert [run['id'] for run in page['items']] == [created[1]]
    assert calculated == [created[1]]
    calculated.clear()
    assert imported_client.get('/api/runs?page=4&page_size=1').json()['items'] == []
    assert calculated == []


def test_unresolved_filter_tracks_resolve_and_reopen_and_preserves_all_cases(client):
    run, case, _ = prepared_case(client)
    endpoint = f"/api/discrepancies?run_id={run['id']}"
    original = client.get(endpoint).json()
    assert original['items'][0]['severity'] == 'high'
    resolved = act(client, case, 'resolve').json()
    unresolved = client.get(endpoint + '&status=unresolved').json()
    assert unresolved['total'] == original['total'] - 1
    assert case['id'] not in {item['id'] for item in unresolved['items']}
    assert client.get(endpoint).json()['total'] == original['total']
    assert client.get(endpoint + '&status=resolved').json()['items'][0]['id'] == case['id']
    assert act(client, resolved, 'reopen').status_code == 200
    assert client.get(endpoint + '&status=unresolved').json()['total'] == original['total']


def test_import_history_pages_preserve_total_and_omit_preview(imported_client):
    first = imported_client.get('/api/imports?page_size=1').json()
    second = imported_client.get('/api/imports?page=2&page_size=1').json()
    assert first['total'] == second['total'] == 2
    assert first['items'][0]['id'] != second['items'][0]['id']
    assert 'preview' not in first['items'][0]
    assert imported_client.get('/api/imports?page=3&page_size=1').json()['items'] == []
