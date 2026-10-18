"""Guest session grant and metered Google Vision calls.

Background removal lives in background_removal.py and uses the same credit
guard. Vision is the other paid call: signed-in users still call Google from
the browser, and guests must come through here so a credit is spent first.
"""

from __future__ import annotations

import base64
import logging
import os
from typing import Annotated

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

from .removal_guard import (
    Caller,
    client_ip_from_forwarded,
    consume_for_action,
    grant_guest_session,
    guest_ip_salt,
    hash_client_ip,
    refund_charge,
    resolve_caller,
    supabase_settings,
)

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_IMAGE_BYTES = 7_000_000

_VISION_FEATURES = [
    {"type": "LABEL_DETECTION", "maxResults": 20},
    {"type": "OBJECT_LOCALIZATION", "maxResults": 20},
    {"type": "IMAGE_PROPERTIES", "maxResults": 1},
]


class AnalyzeImageRequest(BaseModel):
    image_base64: str


def _client_address(request: Request) -> str:
    fallback = request.client.host if request.client else None
    return client_ip_from_forwarded(request.headers.get("x-forwarded-for"), fallback)


@router.post("/api/guest/session")
async def start_guest_session(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
):
    """Record a guest balance. Idempotent for an existing anonymous user."""
    supabase_url, service_key = supabase_settings()
    caller = await resolve_caller(
        authorization,
        supabase_url=supabase_url,
        service_key=service_key,
    )
    ip_hash = hash_client_ip(_client_address(request), guest_ip_salt(service_key))
    body = await grant_guest_session(
        caller,
        ip_hash,
        supabase_url=supabase_url,
        service_key=service_key,
    )
    # The hash is an abuse-control key, not something the browser needs.
    if isinstance(body, dict):
        body.pop("ip_hash", None)
    return body


async def _annotate(image_base64: str, api_key: str) -> dict:
    payload = {
        "requests": [
            {
                "image": {"content": image_base64},
                "features": _VISION_FEATURES,
            }
        ]
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://vision.googleapis.com/v1/images:annotate",
            params={"key": api_key},
            json=payload,
        )
    if response.status_code >= 400:
        logger.warning("Google Vision HTTP %s", response.status_code)
        raise HTTPException(status_code=502, detail="Google Vision request failed")
    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Google Vision request failed") from exc
    responses = data.get("responses") if isinstance(data, dict) else None
    if not responses:
        raise HTTPException(status_code=502, detail="Google Vision returned no annotations")
    annotation = responses[0]
    if isinstance(annotation, dict) and annotation.get("error"):
        raise HTTPException(status_code=502, detail="Google Vision could not read that image")
    if not isinstance(annotation, dict):
        raise HTTPException(status_code=502, detail="Google Vision returned no annotations")
    return annotation


@router.post("/api/vision/analyze")
async def analyze_image(
    body: AnalyzeImageRequest,
    authorization: Annotated[str | None, Header()] = None,
):
    """Spend one guest credit, then ask Google Vision for labels and objects."""
    supabase_url, service_key = supabase_settings()
    api_key = os.getenv("GOOGLE_VISION_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="GOOGLE_VISION_API_KEY is not configured on the background service",
        )

    try:
        decoded = base64.b64decode(body.image_base64, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="image_base64 must be valid base64") from exc
    if not decoded:
        raise HTTPException(status_code=400, detail="image_base64 is empty")
    if len(decoded) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large for guest analysis")

    caller: Caller = await resolve_caller(
        authorization,
        supabase_url=supabase_url,
        service_key=service_key,
    )
    if not caller.is_anonymous:
        raise HTTPException(
            status_code=403,
            detail="This endpoint is for guest photo analysis. Signed-in accounts use the app directly.",
        )

    charge = await consume_for_action(
        caller,
        "vision",
        supabase_url=supabase_url,
        service_key=service_key,
    )
    try:
        annotations = await _annotate(body.image_base64, api_key)
    except Exception:
        await refund_charge(charge, supabase_url=supabase_url, service_key=service_key)
        raise

    return {
        "annotations": annotations,
        "credits_remaining": charge.credits_remaining,
        "is_guest": True,
    }
