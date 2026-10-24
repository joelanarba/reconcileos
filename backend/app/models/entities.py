from datetime import datetime
from uuid import uuid4

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, ForeignKeyConstraint, Integer, JSON, MetaData, String, Text, UniqueConstraint, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.time import UTCDateTime, utcnow


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention={
        "pk": "pk_%(table_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "uq": "uq_%(table_name)s_%(column_0_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
        "ix": "ix_%(table_name)s_%(column_0_name)s",
    })


class Identity:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))


class Workspace(Identity, Base):
    __tablename__ = "workspaces"
    name: Mapped[str] = mapped_column(String(120), default="Local workspace")
    base_currency: Mapped[str] = mapped_column(String(3), default="GHS")
    input_revision: Mapped[int] = mapped_column(Integer, default=0)
    write_revision: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class WorkspaceEntity(Identity):
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"))


class ImportBatch(WorkspaceEntity, Base):
    __tablename__ = "import_batches"
    __table_args__ = (
        UniqueConstraint("workspace_id", "id"),
        UniqueConstraint("workspace_id", "source_type", "checksum", name="uq_import_batch_checksum"),
        CheckConstraint("status IN ('previewed','invalid','confirmed')", name="status"),
        CheckConstraint("source_type IN ('orders','payments','settlements')", name="source_type"),
    )
    source_type: Mapped[str] = mapped_column(String(20))
    filename: Mapped[str] = mapped_column(String(160))
    checksum: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20))
    total_rows: Mapped[int] = mapped_column(Integer)
    valid_rows: Mapped[int] = mapped_column(Integer)
    invalid_rows: Mapped[int] = mapped_column(Integer)
    preview: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    confirmed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())


class SourceRecord(WorkspaceEntity):
    import_batch_id: Mapped[str] = mapped_column(String(36))
    source_row: Mapped[int] = mapped_column(Integer)
    row_hash: Mapped[str] = mapped_column(String(64))
    raw: Mapped[dict] = mapped_column(JSON)
    currency: Mapped[str] = mapped_column(String(3))
    description: Mapped[str] = mapped_column(String(500), default="")


def source_constraints(*constraints):
    return (
        UniqueConstraint("workspace_id", "id"),
        UniqueConstraint("import_batch_id", "source_row"),
        ForeignKeyConstraint(["workspace_id", "import_batch_id"], ["import_batches.workspace_id", "import_batches.id"]),
        *constraints,
    )


class Order(SourceRecord, Base):
    __tablename__ = "orders"
    __table_args__ = source_constraints(
        CheckConstraint("expected_minor > 0 AND expected_minor <= 1000000000000", name="amount"),
        CheckConstraint("status IN ('open','completed','cancelled')", name="status"),
    )
    order_ref: Mapped[str] = mapped_column(String(128), index=True)
    expected_minor: Mapped[int] = mapped_column(BigInteger)
    ordered_at: Mapped[datetime] = mapped_column(UTCDateTime())
    status: Mapped[str] = mapped_column(String(20))


class Payment(SourceRecord, Base):
    __tablename__ = "payments"
    __table_args__ = source_constraints(
        CheckConstraint("amount_minor > 0 AND amount_minor <= 1000000000000", name="amount"),
        CheckConstraint("provider_status IN ('successful','pending','failed','reversed')", name="status"),
    )
    provider: Mapped[str] = mapped_column(String(30))
    transaction_ref: Mapped[str] = mapped_column(String(128), index=True)
    order_ref: Mapped[str | None] = mapped_column(String(128), index=True)
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    paid_at: Mapped[datetime] = mapped_column(UTCDateTime())
    provider_status: Mapped[str] = mapped_column(String(20))


class Settlement(SourceRecord, Base):
    __tablename__ = "settlements"
    __table_args__ = source_constraints(
        CheckConstraint("gross_minor > 0 AND gross_minor <= 1000000000000", name="gross"),
        CheckConstraint("fee_minor >= 0 AND fee_minor <= 1000000000000", name="fee"),
        CheckConstraint("net_minor >= 0 AND net_minor <= 1000000000000", name="net"),
    )
    provider: Mapped[str] = mapped_column(String(30))
    settlement_ref: Mapped[str] = mapped_column(String(128), index=True)
    payment_ref: Mapped[str | None] = mapped_column(String(128), index=True)
    gross_minor: Mapped[int] = mapped_column(BigInteger)
    fee_minor: Mapped[int] = mapped_column(BigInteger)
    net_minor: Mapped[int] = mapped_column(BigInteger)
    settled_at: Mapped[datetime] = mapped_column(UTCDateTime())


class ReconciliationRun(WorkspaceEntity, Base):
    __tablename__ = "reconciliation_runs"
    __table_args__ = (
        UniqueConstraint("workspace_id", "id"),
        CheckConstraint("status IN ('running','completed','failed')", name="status"),
    )
    status: Mapped[str] = mapped_column(String(20), default="running")
    input_revision: Mapped[int] = mapped_column(Integer)
    snapshot_hash: Mapped[str] = mapped_column(String(64))
    snapshot: Mapped[dict] = mapped_column(JSON)
    rule_version: Mapped[str] = mapped_column(String(40))
    original_summary: Mapped[dict] = mapped_column(JSON, default=dict)
    started_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    failure_code: Mapped[str | None] = mapped_column(String(60))


def evidence_constraints(*constraints):
    return (
        UniqueConstraint("workspace_id", "id"),
        ForeignKeyConstraint(["workspace_id", "run_id"], ["reconciliation_runs.workspace_id", "reconciliation_runs.id"]),
        ForeignKeyConstraint(["workspace_id", "order_id"], ["orders.workspace_id", "orders.id"]),
        ForeignKeyConstraint(["workspace_id", "payment_id"], ["payments.workspace_id", "payments.id"]),
        ForeignKeyConstraint(["workspace_id", "settlement_id"], ["settlements.workspace_id", "settlements.id"]),
        *constraints,
    )


class ReconciliationMatch(WorkspaceEntity, Base):
    __tablename__ = "reconciliation_matches"
    __table_args__ = evidence_constraints(
        UniqueConstraint("run_id", "id"),
        CheckConstraint("origin IN ('automatic','manual')", name="origin"),
        CheckConstraint("(kind = 'order_payment' AND order_id IS NOT NULL AND settlement_id IS NULL) OR (kind = 'payment_settlement' AND order_id IS NULL AND settlement_id IS NOT NULL)", name="relationship"),
    )
    run_id: Mapped[str] = mapped_column(String(36))
    kind: Mapped[str] = mapped_column(String(30))
    order_id: Mapped[str | None] = mapped_column(String(36))
    payment_id: Mapped[str] = mapped_column(String(36))
    settlement_id: Mapped[str | None] = mapped_column(String(36))
    origin: Mapped[str] = mapped_column(String(20), default="automatic")
    evidence: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class MatchAllocation(Identity, Base):
    __tablename__ = "match_allocations"
    __table_args__ = (
        UniqueConstraint("run_id", "kind", "record_key", name="uq_active_allocation"),
        ForeignKeyConstraint(["run_id", "match_id"], ["reconciliation_matches.run_id", "reconciliation_matches.id"]),
    )
    match_id: Mapped[str] = mapped_column(String(36))
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("reconciliation_runs.id"))
    kind: Mapped[str] = mapped_column(String(30))
    record_key: Mapped[str] = mapped_column(String(300))


class Discrepancy(WorkspaceEntity, Base):
    __tablename__ = "discrepancies"
    __table_args__ = evidence_constraints(
        UniqueConstraint("run_id", "case_key", name="uq_run_case"),
        CheckConstraint("status IN ('open','in_review','resolved','reopened')", name="status"),
        CheckConstraint("severity IN ('low','medium','high')", name="severity"),
    )
    run_id: Mapped[str] = mapped_column(String(36))
    case_key: Mapped[str] = mapped_column(String(64))
    type: Mapped[str] = mapped_column(String(50))
    severity: Mapped[str] = mapped_column(String(10))
    order_id: Mapped[str | None] = mapped_column(String(36))
    payment_id: Mapped[str | None] = mapped_column(String(36))
    settlement_id: Mapped[str | None] = mapped_column(String(36))
    description: Mapped[str] = mapped_column(Text)
    evidence: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="open")
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class Investigation(Identity, Base):
    __tablename__ = "investigations"
    discrepancy_id: Mapped[str] = mapped_column(String(36), ForeignKey("discrepancies.id"))
    kind: Mapped[str] = mapped_column(String(10))
    actor: Mapped[str] = mapped_column(String(80))
    explanation: Mapped[str] = mapped_column(Text)
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    suggested_action: Mapped[str | None] = mapped_column(Text)
    ai_metadata: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class ReviewDecision(Identity, Base):
    __tablename__ = "review_decisions"
    discrepancy_id: Mapped[str] = mapped_column(String(36), ForeignKey("discrepancies.id"))
    match_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("reconciliation_matches.id"))
    action: Mapped[str] = mapped_column(String(30))
    actor: Mapped[str] = mapped_column(String(80))
    reason: Mapped[str] = mapped_column(Text)
    previous_state: Mapped[dict] = mapped_column(JSON)
    new_state: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class AuditEvent(WorkspaceEntity, Base):
    __tablename__ = "audit_events"
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String(50))
    actor: Mapped[str] = mapped_column(String(80))
    reason: Mapped[str] = mapped_column(Text)
    previous_state: Mapped[dict] = mapped_column(JSON)
    new_state: Mapped[dict] = mapped_column(JSON)
    timestamp: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


def prevent_history_mutation(mapper, connection, target):
    raise ValueError("Application history entries are append-only.")


for history_model in (AuditEvent, ReviewDecision, Investigation):
    event.listen(history_model, "before_update", prevent_history_mutation)
    event.listen(history_model, "before_delete", prevent_history_mutation)
