# backend/app/main.py
from fastapi import FastAPI
from .auth import router as auth_router

app = FastAPI()

app.include_router(auth_router)

@app.get("/health")
async def health():
    return {"status": "ok"}
