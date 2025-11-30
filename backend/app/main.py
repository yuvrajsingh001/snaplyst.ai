from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware
# Allow origins from environment variable or default to localhost
allowed_origins_str = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
)
# Split by comma and strip whitespace
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]

logger.info(f"CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Try to import background removal router, but don't fail if it's not available
try:
    from .background_removal import router as background_removal_router
    app.include_router(background_removal_router)
    logger.info("Background removal router loaded successfully")
except Exception as e:
    logger.error(f"Failed to load background removal router: {e}")
    # Create a dummy router to prevent 404s
    from fastapi import APIRouter
    dummy_router = APIRouter(prefix="/api/background-removal")
    
    @dummy_router.post("/remove")
    def dummy_remove():
        return {"error": "Background removal not available", "detail": str(e)}
    
    app.include_router(dummy_router)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "cors_origins": allowed_origins,
        "background_removal": "available" if "background_removal_router" in locals() else "unavailable"
    }

