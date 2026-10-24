from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
import pytest

from app.core.config import BACKEND_ROOT
from app.db.session import database_engine


def test_real_migration_schema_and_foreign_keys(database_url):
    engine = database_engine(database_url)
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "0001_initial"
        assert connection.scalar(text("PRAGMA foreign_keys")) == 1
        assert connection.execute(text("PRAGMA foreign_key_check")).all() == []
        with pytest.raises(IntegrityError):
            connection.execute(text("INSERT INTO workspaces (id,name,base_currency,input_revision,write_revision,created_at) VALUES ('invalid','Invalid','GHS',NULL,0,'2026-01-01')"))
    with engine.connect() as connection:
        with pytest.raises(IntegrityError):
            connection.execute(text("INSERT INTO audit_events (id,workspace_id,entity_type,entity_id,action,actor,reason,previous_state,new_state,timestamp) VALUES (:id,:workspace,:entity_type,:entity_id,:action,:actor,:reason,:previous,:new,:timestamp)"),
                               {"id": "bad-event", "workspace": "missing-workspace", "entity_type": "test", "entity_id": "test", "action": "test", "actor": "Test operator", "reason": "Foreign key verification", "previous": "{}", "new": "{}", "timestamp": "2026-10-20T00:00:00"})
    engine.dispose()
    configuration = Config(str(BACKEND_ROOT / "alembic.ini"))
    configuration.attributes["database_url"] = database_url
    command.check(configuration)
