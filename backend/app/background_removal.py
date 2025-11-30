"""
Background removal endpoint for images
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from PIL import Image
from io import BytesIO
import os
import base64

# Set environment variable to prevent OMP library conflict
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

try:
    from rembg import remove
    from rembg.session_factory import new_session
    REMBG_AVAILABLE = True
    import_error = None
except ImportError as e:
    REMBG_AVAILABLE = False
    remove = None
    new_session = None
    import_error = str(e)
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


@router.post("/remove", response_model=RemoveBackgroundResponse)
async def remove_background(request: RemoveBackgroundRequest):
    """
    Remove background from an image
    
    Downloads image from Supabase Storage, processes it, and uploads directly back to Supabase Storage.
    Returns the new storage path (no base64 transfer needed).
    """
    if not REMBG_AVAILABLE:
        error_msg = f"Background removal library not installed. Please install: pip install rembg[cpu]"
        if 'import_error' in locals():
            error_msg += f" (Import error: {import_error})"
        raise HTTPException(
            status_code=500,
            detail=error_msg
        )
    
    try:
        # Initialize Supabase client with service role key
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_service_key:
            raise HTTPException(
                status_code=500,
                detail="Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
            )
        
        from supabase import create_client, Client
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
        # Supabase Python client accepts bytes directly
        upload_result = supabase.storage.from("product-images").upload(
            new_path,
            processed_image_bytes,
            file_options={
                "content-type": "image/png",
                "upsert": "true"
            }
        )
        
        if upload_result.error:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload processed image: {upload_result.error.message}"
            )
        
        return {
            "processed_storage_path": new_path,
            "original_storage_path": request.storage_path
        }
        
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to download image: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")


@router.post("/remove-batch")
async def remove_background_batch(image_urls: list[str]):
    """
    Remove background from multiple images
    Returns base64 encoded images
    """
    if not REMBG_AVAILABLE:
        error_msg = f"Background removal library not installed. Please install: pip install rembg[cpu]"
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

