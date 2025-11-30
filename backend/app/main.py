from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .background_removal import router as background_removal_router

app = FastAPI()

# Add CORS middleware
# Allow origins from environment variable or default to localhost
import os
allowed_origins_str = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
)
# Split by comma and strip whitespace
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(background_removal_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}

