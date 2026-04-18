import os
from pathlib import Path


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue

        key, value = line.split('=', 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue

        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]

        os.environ.setdefault(key, value)


_HERE = Path(__file__).resolve()
_WORKER_ROOT = _HERE.parents[1]
_REPO_ROOT = _HERE.parents[3]

# Prefer worker-local env files, then fall back to repo-level env files.
for _env_file in (
    _WORKER_ROOT / '.env',
    _WORKER_ROOT / '.env.local',
    _REPO_ROOT / '.env',
    _REPO_ROOT / '.env.local',
):
    _load_env_file(_env_file)


WORKER_SHARED_SECRET = os.getenv('WORKER_SHARED_SECRET', '')

if not WORKER_SHARED_SECRET:
    raise RuntimeError('WORKER_SHARED_SECRET is required')
