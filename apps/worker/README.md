# ai_market Worker

FastAPI worker for heavy and asynchronous Python workloads.

## Endpoints
- GET /health
- POST /internal/echo (HMAC signed)

## Local Run
1. Create .env with WORKER_SHARED_SECRET
2. Install deps: pip install -r requirements.txt
3. Run: uvicorn app.main:app --reload --port 8000
