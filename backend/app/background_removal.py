"""
Background removal endpoint for images
"""
import base64
import os
from io import BytesIO

import httpx
from fastapi import APIRouter, Header, HTTPException
from PIL import Image
from pydantic import BaseModel

# Set environment variable to prevent OMP library conflict
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

try:
    # Imported first so a missing ONNX runtime fails here with a clear error.
    import onnxruntime  # noqa: F401
    from rembg import remove
    from rembg.session_factory import new_session
    REMBG_AVAILABLE = True
    import_error = None
except ImportError as e:
    REMBG_AVAILABLE = False
    remove = None
    new_session = None
    import_error = f"ImportError: {str(e)}"
except Exception as e:
    REMBG_AVAILABLE = False
    remove = None
    new_session = None
    import_error = f"Unexpected error: {str(e)}"

router = APIRouter(prefix="/api/background-removal")


class RemoveBackgroundRequest(BaseModel):
    image_url: str
    storage_path: str  # Original storage path in Supabase
    user_id: str  # User ID for verification


class RemoveBackgroundResponse(BaseModel):
    processed_storage_path: str  # New storage path in Supabase
    original_storage_path: str


def bearer_token(authorization: str | None) -> str:
    """Return the token from an Authorization header, or raise 401."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return token.strip()


def caller_id(user_response) -> str | None:
    user = getattr(user_response, "user", None)
    if user is None and isinstance(user_response, dict):
        user = user_response.get("user")
    if user is None:
        return None
    found = getattr(user, "id", None)
    if found is None and isinstance(user, dict):
        found = user.get("id")
    return found or None


def verify_caller(supabase, token: str, user_id: str) -> None:
    """Confirm the Supabase JWT belongs to user_id before using the service role."""
    try:
        result = supabase.auth.get_user(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired session") from exc
    authenticated_as = caller_id(result)
    if not authenticated_as:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    if authenticated_as != user_id:
        raise HTTPException(
            status_code=403,
            detail="user_id does not match the authenticated user",
        )


def storage_parts(storage_path: str) -> list[str]:
    cleaned = storage_path.strip().lstrip("/")
    if not cleaned:
        raise HTTPException(status_code=400, detail="Invalid storage path")
    parts: list[str] = []
    for part in cleaned.split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            raise HTTPException(status_code=400, detail="Invalid storage path")
        parts.append(part)
    if not parts:
        raise HTTPException(status_code=400, detail="Invalid storage path")
    return parts


def build_processed_storage_path(storage_path: str) -> str:
    """Name the PNG next to the original, without a leading slash when there is no folder."""
    parts = storage_parts(storage_path)
    filename = parts[-1]
    stem = filename.rsplit(".", 1)[0] if "." in filename else filename
    processed_name = f"{stem}_bg_removed.png"
    parent = parts[:-1]
    if not parent:
        return processed_name
    return "/".join([*parent, processed_name])


def processed_path_for_user(storage_path: str, user_id: str) -> str:
    parts = storage_parts(storage_path)
    if len(parts) < 2 or parts[0] != user_id:
        raise HTTPException(
            status_code=403,
            detail="storage_path is outside this user's folder",
        )
    return build_processed_storage_path(storage_path)


@router.post("/remove", response_model=RemoveBackgroundResponse)
async def remove_background(
    request: RemoveBackgroundRequest,
    authorization: str | None = Header(default=None),
):
    """
    Remove background from an image
    
    Downloads image from Supabase Storage, processes it, and uploads directly back to Supabase Storage.
    Returns the new storage path (no base64 transfer needed).
    """
    if not REMBG_AVAILABLE:
        error_msg = "Background removal library not installed. Please install: pip install rembg[cpu]"
        if 'import_error' in locals():
            error_msg += f" (Import error: {import_error})"
        raise HTTPException(
            status_code=500,
            detail=error_msg
        )
    
    token = bearer_token(authorization)

    try:
        # Initialize Supabase client with service role key
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_service_key:
            raise HTTPException(
                status_code=500,
                detail="Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
            )
        
        from supabase import Client, create_client
        supabase: Client = create_client(supabase_url, supabase_service_key)
        verify_caller(supabase, token, request.user_id)
        new_path = processed_path_for_user(request.storage_path, request.user_id)
        
        # Download image from Supabase Storage
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(request.image_url, timeout=60.0)
            response.raise_for_status()
            image_data = response.content
        
        # Remove background using rembg
        output_bytes = remove(image_data, session=new_session('u2net'))
        result_img_pil = Image.open(BytesIO(output_bytes)).convert("RGBA")
        
        # Convert to PNG bytes
        output_buffer = BytesIO()
        result_img_pil.save(output_buffer, format='PNG')
        output_buffer.seek(0)
        processed_image_bytes = output_buffer.read()
        
        # Upload processed image directly to Supabase Storage.
        # Use from_() (with underscore) to avoid the Python keyword.
        # Supabase raises exceptions on error, so wrap in try-except.
        try:
            supabase.storage.from_("product-images").upload(
                new_path,
                processed_image_bytes,
                file_options={
                    "content-type": "image/png",
                    "upsert": "true"
                }
            )
        except Exception as upload_error:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload processed image: {str(upload_error)}"
            ) from upload_error
        
        return {
            "processed_storage_path": new_path,
            "original_storage_path": request.storage_path
        }
        
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to download image: {str(e)}") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}") from e


@router.post("/remove-batch")
async def remove_background_batch(image_urls: list[str]):
    """
    Remove background from multiple images
    Returns base64 encoded images
    """
    if not REMBG_AVAILABLE:
        error_msg = "Background removal library not installed. Please install: pip install rembg[cpu]"
        if 'import_error' in locals():
            error_msg += f" (Import error: {import_error})"
        raise HTTPException(
            status_code=500,
            detail=error_msg
        )
    
    results = []
    for image_url in image_urls:
        try:
            # Download image
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(image_url, timeout=60.0)
                response.raise_for_status()
                image_data = response.content
            
            # Remove background using rembg
            # rembg works directly with image bytes
            output_bytes = remove(image_data, session=new_session('u2net'))
            result_img_pil = Image.open(BytesIO(output_bytes)).convert("RGBA")
            
            # Convert to base64
            output_buffer = BytesIO()
            result_img_pil.save(output_buffer, format='PNG')
            output_buffer.seek(0)
            base64_data = base64.b64encode(output_buffer.read()).decode('utf-8')
            
            results.append({
                "original_url": image_url,
                "processed_image_base64": f"data:image/png;base64,{base64_data}",
                "success": True
            })
        except Exception as e:
            results.append({
                "original_url": image_url,
                "error": str(e),
                "success": False
            })
    
    return {"results": results}

