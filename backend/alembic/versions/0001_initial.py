from datetime import UTC, datetime

from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def identity():
    return sa.Column("id", sa.String(36), primary_key=True)


def workspace_column():
    return sa.Column("workspace_id", sa.String(36), sa.ForeignKey("workspaces.id"), nullable=False)


def timestamp(name):
    return sa.Column(name, sa.DateTime(timezone=True), nullable=False)


def source_columns():
    return [identity(), workspace_column(),
            sa.Column("import_batch_id", sa.String(36), nullable=False),
            sa.Column("source_row", sa.Integer, nullable=False),
            sa.Column("row_hash", sa.String(64), nullable=False),
            sa.Column("raw", sa.JSON, nullable=False),
            sa.Column("currency", sa.String(3), nullable=False),
            sa.Column("description", sa.String(500), nullable=False),
            sa.UniqueConstraint("workspace_id", "id"),
            sa.UniqueConstraint("import_batch_id", "source_row"),
            sa.ForeignKeyConstraint(["workspace_id", "import_batch_id"], ["import_batches.workspace_id", "import_batches.id"])]


def evidence_columns():
    return [identity(), workspace_column(),
            sa.Column("run_id", sa.String(36), nullable=False),
            sa.Column("order_id", sa.String(36)),
            sa.Column("payment_id", sa.String(36)),
            sa.Column("settlement_id", sa.String(36)),
            sa.Column("evidence", sa.JSON, nullable=False),
            timestamp("created_at"),
            sa.UniqueConstraint("workspace_id", "id"),
            sa.ForeignKeyConstraint(["workspace_id", "run_id"], ["reconciliation_runs.workspace_id", "reconciliation_runs.id"]),
            sa.ForeignKeyConstraint(["workspace_id", "order_id"], ["orders.workspace_id", "orders.id"]),
            sa.ForeignKeyConstraint(["workspace_id", "payment_id"], ["payments.workspace_id", "payments.id"]),
            sa.ForeignKeyConstraint(["workspace_id", "settlement_id"], ["settlements.workspace_id", "settlements.id"])]


def upgrade():
    workspace = op.create_table("workspaces", identity(),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("base_currency", sa.String(3), nullable=False),
        sa.Column("input_revision", sa.Integer, nullable=False),
        sa.Column("write_revision", sa.Integer, nullable=False), timestamp("created_at"))
    op.bulk_insert(workspace, [{"id": "00000000-0000-4000-8000-000000000001", "name": "Local workspace", "base_currency": "GHS", "input_revision": 0, "write_revision": 0, "created_at": datetime.now(UTC)}])
    op.create_table("import_batches", identity(), workspace_column(),
        sa.Column("source_type", sa.String(20), nullable=False),
        sa.Column("filename", sa.String(160), nullable=False),
        sa.Column("checksum", sa.String(64), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("total_rows", sa.Integer, nullable=False),
        sa.Column("valid_rows", sa.Integer, nullable=False),
        sa.Column("invalid_rows", sa.Integer, nullable=False),
        sa.Column("preview", sa.JSON, nullable=False), timestamp("created_at"),
        sa.Column("confirmed_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("workspace_id", "id"),
        sa.UniqueConstraint("workspace_id", "source_type", "checksum", name="uq_import_batch_checksum"),
        sa.CheckConstraint("status IN ('previewed','invalid','confirmed')", name="status"),
        sa.CheckConstraint("source_type IN ('orders','payments','settlements')", name="source_type"))
    op.create_table("orders", *source_columns(),
        sa.Column("order_ref", sa.String(128), nullable=False),
        sa.Column("expected_minor", sa.BigInteger, nullable=False), timestamp("ordered_at"),
        sa.Column("status", sa.String(20), nullable=False),
        sa.CheckConstraint("expected_minor > 0 AND expected_minor <= 1000000000000", name="amount"),
        sa.CheckConstraint("status IN ('open','completed','cancelled')", name="status"))
    op.create_index("ix_orders_order_ref", "orders", ["order_ref"])
    op.create_table("payments", *source_columns(),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("transaction_ref", sa.String(128), nullable=False),
        sa.Column("order_ref", sa.String(128)),
        sa.Column("amount_minor", sa.BigInteger, nullable=False), timestamp("paid_at"),
        sa.Column("provider_status", sa.String(20), nullable=False),
        sa.CheckConstraint("amount_minor > 0 AND amount_minor <= 1000000000000", name="amount"),
        sa.CheckConstraint("provider_status IN ('successful','pending','failed','reversed')", name="status"))
    op.create_index("ix_payments_transaction_ref", "payments", ["transaction_ref"])
    op.create_index("ix_payments_order_ref", "payments", ["order_ref"])
    op.create_table("settlements", *source_columns(),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("settlement_ref", sa.String(128), nullable=False),
        sa.Column("payment_ref", sa.String(128)),
        sa.Column("gross_minor", sa.BigInteger, nullable=False),
        sa.Column("fee_minor", sa.BigInteger, nullable=False),
        sa.Column("net_minor", sa.BigInteger, nullable=False), timestamp("settled_at"),
        sa.CheckConstraint("gross_minor > 0 AND gross_minor <= 1000000000000", name="gross"),
        sa.CheckConstraint("fee_minor >= 0 AND fee_minor <= 1000000000000", name="fee"),
        sa.CheckConstraint("net_minor >= 0 AND net_minor <= 1000000000000", name="net"))
    op.create_index("ix_settlements_settlement_ref", "settlements", ["settlement_ref"])
    op.create_index("ix_settlements_payment_ref", "settlements", ["payment_ref"])
    op.create_table("reconciliation_runs", identity(), workspace_column(),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("input_revision", sa.Integer, nullable=False),
        sa.Column("snapshot_hash", sa.String(64), nullable=False),
        sa.Column("snapshot", sa.JSON, nullable=False),
        sa.Column("rule_version", sa.String(40), nullable=False),
        sa.Column("original_summary", sa.JSON, nullable=False), timestamp("started_at"),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("failure_code", sa.String(60)),
        sa.UniqueConstraint("workspace_id", "id"),
        sa.CheckConstraint("status IN ('running','completed','failed')", name="status"))
    match_columns = evidence_columns()
    next(column for column in match_columns if isinstance(column, sa.Column) and column.name == "payment_id").nullable = False
    op.create_table("reconciliation_matches", *match_columns,
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("origin", sa.String(20), nullable=False),
        sa.UniqueConstraint("run_id", "id"),
        sa.CheckConstraint("origin IN ('automatic','manual')", name="origin"),
        sa.CheckConstraint("(kind = 'order_payment' AND order_id IS NOT NULL AND settlement_id IS NULL) OR (kind = 'payment_settlement' AND order_id IS NULL AND settlement_id IS NOT NULL)", name="relationship"))
    op.create_table("match_allocations", identity(),
        sa.Column("match_id", sa.String(36), nullable=False),
        sa.Column("run_id", sa.String(36), sa.ForeignKey("reconciliation_runs.id"), nullable=False),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("record_key", sa.String(300), nullable=False),
        sa.UniqueConstraint("run_id", "kind", "record_key", name="uq_active_allocation"),
        sa.ForeignKeyConstraint(["run_id", "match_id"], ["reconciliation_matches.run_id", "reconciliation_matches.id"]))
    op.create_table("discrepancies", *evidence_columns(),
        sa.Column("case_key", sa.String(64), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("severity", sa.String(10), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.UniqueConstraint("run_id", "case_key", name="uq_run_case"),
        sa.CheckConstraint("status IN ('open','in_review','resolved','reopened')", name="status"),
        sa.CheckConstraint("severity IN ('low','medium','high')", name="severity"))
    op.create_table("investigations", identity(),
        sa.Column("discrepancy_id", sa.String(36), sa.ForeignKey("discrepancies.id"), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("actor", sa.String(80), nullable=False),
        sa.Column("explanation", sa.Text, nullable=False),
        sa.Column("evidence", sa.JSON, nullable=False),
        sa.Column("suggested_action", sa.Text), sa.Column("ai_metadata", sa.JSON), timestamp("created_at"))
    op.create_table("review_decisions", identity(),
        sa.Column("discrepancy_id", sa.String(36), sa.ForeignKey("discrepancies.id"), nullable=False),
        sa.Column("match_id", sa.String(36), sa.ForeignKey("reconciliation_matches.id")),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("actor", sa.String(80), nullable=False), sa.Column("reason", sa.Text, nullable=False),
        sa.Column("previous_state", sa.JSON, nullable=False), sa.Column("new_state", sa.JSON, nullable=False), timestamp("created_at"))
    op.create_table("audit_events", identity(), workspace_column(),
        sa.Column("entity_type", sa.String(40), nullable=False),
        sa.Column("entity_id", sa.String(36), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("actor", sa.String(80), nullable=False), sa.Column("reason", sa.Text, nullable=False),
        sa.Column("previous_state", sa.JSON, nullable=False), sa.Column("new_state", sa.JSON, nullable=False), timestamp("timestamp"))


def downgrade():
    for table_name in ("audit_events", "review_decisions", "investigations", "discrepancies", "match_allocations", "reconciliation_matches", "reconciliation_runs", "settlements", "payments", "orders", "import_batches", "workspaces"):
        op.drop_table(table_name)
