"""
Background removal endpoint for images
"""
import base64
import os
from io import BytesIO

import httpx
from fastapi import APIRouter, HTTPException, Request
from PIL import Image
from pydantic import BaseModel

from .removal_guard import (
    assert_image_url_on_project,
    authorize_background_removal,
    consume_for_action,
    refund_charge,
    resolve_caller,
    supabase_settings,
)

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
    # Null for signed-in accounts. Guests get the balance left after this call.
    credits_remaining: int | None = None


@router.post("/remove", response_model=RemoveBackgroundResponse)
async def remove_background(request: RemoveBackgroundRequest, raw_request: Request):
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
    
    supabase_url, supabase_service_key = supabase_settings()
    # Auth, folder ownership, and the guest credit decrement happen before any
    # model work. A 402 here means the credit was not spent.
    charge = await authorize_background_removal(
        authorization=raw_request.headers.get("authorization"),
        user_id=request.user_id,
        storage_path=request.storage_path,
        image_url=request.image_url,
        supabase_url=supabase_url,
        service_key=supabase_service_key,
    )

    try:
        from supabase import Client, create_client
        supabase: Client = create_client(supabase_url, supabase_service_key)
        
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
        
        # Generate new storage path
        path_parts = request.storage_path.split("/")
        filename = path_parts[-1]
        name_without_ext = filename.rsplit(".", 1)[0] if "." in filename else filename
        new_path = f"{'/'.join(path_parts[:-1])}/{name_without_ext}_bg_removed.png"
        
        # Upload processed image directly to Supabase Storage
        # Use from_() method (with underscore) to avoid Python keyword conflict
        # Supabase raises exceptions on error, so wrap in try-except
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
            )
        
        return {
            "processed_storage_path": new_path,
            "original_storage_path": request.storage_path,
            "credits_remaining": charge.credits_remaining,
        }
        
    except httpx.HTTPError as e:
        await refund_charge(charge, supabase_url=supabase_url, service_key=supabase_service_key)
        raise HTTPException(status_code=400, detail=f"Failed to download image: {str(e)}")
    except HTTPException:
        await refund_charge(charge, supabase_url=supabase_url, service_key=supabase_service_key)
        raise
    except Exception as e:
        await refund_charge(charge, supabase_url=supabase_url, service_key=supabase_service_key)
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")


@router.post("/remove-batch")
async def remove_background_batch(image_urls: list[str], raw_request: Request):
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

    supabase_url, supabase_service_key = supabase_settings()
    caller = await resolve_caller(
        raw_request.headers.get("authorization"),
        supabase_url=supabase_url,
        service_key=supabase_service_key,
    )

    results = []
    for image_url in image_urls:
        charge = None
        try:
            assert_image_url_on_project(image_url, supabase_url)
            charge = await consume_for_action(
                caller,
                "background_removal",
                supabase_url=supabase_url,
                service_key=supabase_service_key,
            )
        except HTTPException as credit_error:
            detail = credit_error.detail
            message = detail if isinstance(detail, str) else str(detail)
            results.append({
                "original_url": image_url,
                "error": message,
                "success": False,
                "status_code": credit_error.status_code,
            })
            # A guest who is out of credits should not keep the model busy.
            if credit_error.status_code == 402:
                break
            continue
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
                "success": True,
                "credits_remaining": charge.credits_remaining if charge else None,
            })
        except Exception as e:
            await refund_charge(charge, supabase_url=supabase_url, service_key=supabase_service_key)
            results.append({
                "original_url": image_url,
                "error": str(e),
                "success": False
            })
    
    return {"results": results}

