import os

WORKER_SHARED_SECRET = os.getenv('WORKER_SHARED_SECRET', '')

if not WORKER_SHARED_SECRET:
    raise RuntimeError('WORKER_SHARED_SECRET is required')
