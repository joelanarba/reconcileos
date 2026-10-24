from alembic import context

from app.core.config import Settings
from app.db.session import database_engine
from app.models.entities import Base


target_metadata = Base.metadata
configured_url = context.config.attributes.get("database_url") or Settings().database_url

if context.is_offline_mode():
    context.configure(url=configured_url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = database_engine(configured_url)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=engine.dialect.name == "sqlite", compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()
