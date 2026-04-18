from fastapi import APIRouter

router = APIRouter()


@router.get('/health')
async def health():
    return {'ok': True, 'service': 'ai_market_worker'}
