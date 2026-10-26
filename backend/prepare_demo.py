"""Initialize a separate local synthetic demo without changing the operator store."""
import argparse
from pathlib import Path

from alembic import command
from alembic.config import Config

from app.core.config import BACKEND_ROOT
from app.services.demo import seed_demo


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-path', type=Path, default=BACKEND_ROOT / 'data' / 'public-demo.db')
    path = parser.parse_args().database_path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    url = 'sqlite:///' + path.as_posix()
    config = Config(str(BACKEND_ROOT / 'alembic.ini'))
    config.attributes['database_url'] = url
    command.upgrade(config, 'head')
    result = seed_demo(url, BACKEND_ROOT.parent / 'sample-data')
    print('Separate synthetic demo is ready. Existing demo records are preserved.')
