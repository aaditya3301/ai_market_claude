import hashlib
import hmac
import time

from fastapi import Header, HTTPException, Request

from app.config import WORKER_SHARED_SECRET


async def verify_internal_call(
    request: Request,
    x_timestamp: str = Header(...),
    x_signature: str = Header(...),
):
    try:
        ts = int(x_timestamp)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail='invalid timestamp') from exc

    if abs(int(time.time()) - ts) > 300:
        raise HTTPException(status_code=401, detail='expired timestamp')

    body = await request.body()
    digest = hashlib.sha256(body).hexdigest()
    payload = f"{x_timestamp}.{request.method}.{request.url.path}.{digest}".encode('utf-8')
    expected = hmac.new(WORKER_SHARED_SECRET.encode('utf-8'), payload, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected, x_signature):
        raise HTTPException(status_code=401, detail='bad signature')
