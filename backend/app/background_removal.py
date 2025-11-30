"""
Background removal endpoint for images
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import numpy as np
from PIL import Image
from io import BytesIO
import os
import base64

# Set environment variable to prevent OMP library conflict
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

try:
    from backgroundremover.bg import remove
except ImportError:
    remove = None

router = APIRouter(prefix="/api/background-removal")


class RemoveBackgroundRequest(BaseModel):
    image_url: str


class RemoveBackgroundResponse(BaseModel):
    processed_image_base64: str
    original_image_url: str


@router.post("/remove", response_model=RemoveBackgroundResponse)
async def remove_background(request: RemoveBackgroundRequest):
    """
    Remove background from an image
    
    Downloads image from URL, processes it, and returns base64 encoded PNG
    """
    if remove is None:
        raise HTTPException(
            status_code=500,
            detail="Background removal library not installed. Please install: pip install backgroundremover"
        )
    
    try:
        # Download image from URL
        async with httpx.AsyncClient() as client:
            response = await client.get(request.image_url, timeout=30.0)
            response.raise_for_status()
            image_data = response.content
        
        # Load image
        img = Image.open(BytesIO(image_data)).convert("RGB")
        img_np = np.asarray(img)
        img_np = img_np.copy()
        
        # Remove background
        result = remove(
            data=img_np,
            model_name='u2net',
            alpha_matting=True
        )
        
        # Convert result to PIL Image
        if isinstance(result, (memoryview, bytes)):
            if isinstance(result, memoryview):
                result_bytes = bytes(result)
            else:
                result_bytes = result
            result_img_pil = Image.open(BytesIO(result_bytes))
        elif isinstance(result, np.ndarray):
            result_img_pil = Image.fromarray(result)
        elif isinstance(result, Image.Image):
            result_img_pil = result
        else:
            raise TypeError(f"Unexpected result type: {type(result)}")
        
        # Convert to PNG bytes (supports transparency)
        output_buffer = BytesIO()
        result_img_pil.save(output_buffer, format='PNG')
        output_buffer.seek(0)
        
        # Encode as base64
        base64_data = base64.b64encode(output_buffer.read()).decode('utf-8')
        
        return {
            "processed_image_base64": base64_data,
            "original_image_url": request.image_url
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
    if remove is None:
        raise HTTPException(
            status_code=500,
            detail="Background removal library not installed"
        )
    
    results = []
    for image_url in image_urls:
        try:
            # Download image
            async with httpx.AsyncClient() as client:
                response = await client.get(image_url, timeout=30.0)
                response.raise_for_status()
                image_data = response.content
            
            # Process image
            img = Image.open(BytesIO(image_data)).convert("RGB")
            img_np = np.asarray(img)
            img_np = img_np.copy()
            
            result = remove(
                data=img_np,
                model_name='u2net',
                alpha_matting=True
            )
            
            # Convert to PIL Image
            if isinstance(result, (memoryview, bytes)):
                if isinstance(result, memoryview):
                    result_bytes = bytes(result)
                else:
                    result_bytes = result
                result_img_pil = Image.open(BytesIO(result_bytes))
            elif isinstance(result, np.ndarray):
                result_img_pil = Image.fromarray(result)
            elif isinstance(result, Image.Image):
                result_img_pil = result
            else:
                raise TypeError(f"Unexpected result type: {type(result)}")
            
            # Convert to base64
            output_buffer = BytesIO()
            result_img_pil.save(output_buffer, format='PNG')
            output_buffer.seek(0)
            import base64
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

