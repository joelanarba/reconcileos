from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.core.config import BACKEND_ROOT


def database_engine(database_url: str):
    url = make_url(database_url)
    is_sqlite = url.get_backend_name() == "sqlite"
    if is_sqlite and url.database and url.database != ":memory:":
        database_path = Path(url.database)
        if not database_path.is_absolute():
            database_path = BACKEND_ROOT / database_path
        database_path.parent.mkdir(parents=True, exist_ok=True)
        url = url.set(database=str(database_path.resolve()))
    options = {"check_same_thread": False, "timeout": 5} if is_sqlite else {}
    pool_options = {} if is_sqlite else {"pool_size": 2, "max_overflow": 0, "pool_timeout": 5}
    engine = create_engine(url, connect_args=options, hide_parameters=True, pool_pre_ping=not is_sqlite, **pool_options)
    if is_sqlite:
        @event.listens_for(engine, "connect")
        def configure_sqlite(connection, connection_record):
            connection.isolation_level = None
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.close()

        @event.listens_for(engine, "begin")
        def begin_sqlite(connection):
            connection.exec_driver_sql("BEGIN")
    return engine


def session_factory(engine):
    return sessionmaker(bind=engine, expire_on_commit=False)
