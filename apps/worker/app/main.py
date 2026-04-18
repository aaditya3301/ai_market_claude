from fastapi import Depends, FastAPI

from app.auth import verify_internal_call
from app.routes.health import router as health_router

app = FastAPI(title='ai_market_worker', version='0.1.0')

app.include_router(health_router)


@app.post('/internal/echo', dependencies=[Depends(verify_internal_call)])
async def internal_echo(payload: dict):
    return {'ok': True, 'echo': payload}
