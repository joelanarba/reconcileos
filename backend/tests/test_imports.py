from sqlalchemy import func, select
import pytest

from app.models.entities import AuditEvent, ImportBatch, Order, Payment, Workspace
from app.core.config import WORKSPACE_ID
from app.services.imports.service import confirm_batch
from conftest import SAMPLE_ROOT, import_fixture


def preview(client, text, filename="records.csv", source="orders"):
    return client.post(f"/api/imports/preview?source_type={source}", content=text.encode(), headers={"X-Filename": filename})


def test_valid_import_preview_confirmation_and_provenance(client):
    batch = import_fixture(client, "orders")
    assert batch["status"] == "confirmed"
    assert batch["total_rows"] == 4
    assert batch["preview"]["items"][0]["parsed"]["expected_minor"] == "12550"
    with client.app.state.sessions() as session:
        order = session.scalar(select(Order).where(Order.order_ref == "SYN-ORD-1001"))
        assert order.expected_minor == 12550
        assert order.raw["amount"] == "125.50"
        assert order.source_row == 2
        assert session.scalar(select(func.count()).select_from(AuditEvent)) == 1
        assert session.get(Workspace, WORKSPACE_ID).input_revision == 1


def test_invalid_financial_row_cannot_be_confirmed(client):
    response = client.post("/api/imports/preview?source_type=orders", content=(SAMPLE_ROOT / "invalid-orders.csv").read_bytes())
    assert response.status_code == 200
    batch = response.json()
    assert batch["status"] == "invalid"
    assert batch["invalid_rows"] == 1
    assert batch["preview"]["items"][0]["errors"][0]["field"] == "amount"
    assert client.post(f"/api/imports/{batch['id']}/confirm").status_code == 409
    with client.app.state.sessions() as session:
        assert session.scalar(select(func.count()).select_from(Order)) == 0


def test_duplicate_file_and_confirmation_are_idempotent(client):
    first = import_fixture(client, "orders")
    second = import_fixture(client, "orders")
    assert first["id"] == second["id"]
    with client.app.state.sessions() as session:
        assert session.scalar(select(func.count()).select_from(Order)) == 4
        assert session.scalar(select(func.count()).select_from(ImportBatch)) == 1
        assert session.scalar(select(func.count()).select_from(AuditEvent)) == 1


def test_duplicate_rows_are_preserved_with_warning(client):
    batch = import_fixture(client, "payments")
    assert batch["preview"]["items"][3]["warnings"]
    with client.app.state.sessions() as session:
        assert session.scalar(select(func.count()).select_from(Payment)) == 5


@pytest.mark.parametrize("text,code", [("", "empty_file"), ('order_ref,amount,currency,ordered_at,status\n"unfinished', "invalid_csv")])
def test_structurally_invalid_csv_is_rejected(client, text, code):
    response = preview(client, text)
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == code


def test_upload_limit_and_filename_safety(client):
    limit = client.app.state.settings.max_upload_bytes
    assert client.post("/api/imports/preview?source_type=orders", content=b"x" * (limit + 1)).status_code == 413
    response = client.post("/api/imports/preview?source_type=orders", content=(SAMPLE_ROOT / "orders.csv").read_bytes(), headers={"X-Filename": "..%2F..%5Cprivate%2Forders.csv"})
    assert response.json()["filename"] == "orders.csv"
    assert preview(client, "anything", "records.exe").status_code == 400
    assert client.post("/api/imports/preview?source_type=orders", content=b"\xff\x00").json()["detail"]["code"] == "invalid_file"


def test_confirmation_rolls_back_every_record_on_failure(client, monkeypatch):
    batch = client.post("/api/imports/preview?source_type=orders", content=(SAMPLE_ROOT / "orders.csv").read_bytes()).json()
    factory = client.app.state.sessions
    with factory() as session:
        original_flush = session.flush

        def fail_on_insert(*args, **kwargs):
            if any(isinstance(record, Order) for record in session.new):
                original_flush(*args, **kwargs)
                raise RuntimeError("Simulated transaction failure")
            return original_flush(*args, **kwargs)

        monkeypatch.setattr(session, "flush", fail_on_insert)
        with pytest.raises(RuntimeError, match="Simulated"):
            confirm_batch(session, batch["id"], "Test operator")
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(Order)) == 0
        assert session.get(ImportBatch, batch["id"]).status == "previewed"
        assert session.scalar(select(func.count()).select_from(AuditEvent)) == 0


def test_all_validation_rows_are_available_through_pagination(client):
    text = "order_ref,amount,currency,ordered_at,status\n" + "".join(f"SYN-{index},bad,GHS,2026-10-20T00:00:00Z,open\n" for index in range(30))
    batch = preview(client, text).json()
    assert batch["invalid_rows"] == 30
    next_page = client.get(f"/api/imports/{batch['id']}?page=2&invalid_only=true").json()
    assert len(next_page["preview"]["items"]) == 5
    assert next_page["preview"]["items"][-1]["source_row"] == 31
