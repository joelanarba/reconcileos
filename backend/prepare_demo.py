"""Initialize a separate local synthetic demo without changing the operator store."""
from alembic import command
from alembic.config import Config

from app.core.config import BACKEND_ROOT
from app.services.demo import seed_demo


if __name__ == '__main__':
    path = BACKEND_ROOT / 'data' / 'public-demo.db'
    path.parent.mkdir(exist_ok=True)
    url = 'sqlite:///' + path.as_posix()
    config = Config(str(BACKEND_ROOT / 'alembic.ini'))
    config.attributes['database_url'] = url
    command.upgrade(config, 'head')
    result = seed_demo(url, BACKEND_ROOT.parent / 'sample-data')
    print('Separate synthetic demo is ready. Existing demo records are preserved.')
