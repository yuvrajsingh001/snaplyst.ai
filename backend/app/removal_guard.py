"""Authorize credit-consuming backend calls.

Guest balances live in Postgres (supabase/migrations). Callers present a
Supabase access token. This module checks that token, refuses another user's
storage path, and asks the database to decrement a guest credit. Signed-in
accounts are not metered. The browser cannot update the balance: the RPCs are
granted only to the service role.
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

GUEST_STARTING_CREDITS = 5
GUEST_IP_ACCOUNT_LIMIT = 3
GUEST_IP_WINDOW_HOURS = 24

OUT_OF_CREDITS_MESSAGE = (
    "You're out of guest credits. Create a free account to keep analyzing photos "
    "and removing backgrounds."
)

_SHA256_HEX = re.compile(r"^[0-9a-f]{64}$")
_CREDIT_ACTIONS = frozenset({"background_removal", "vision"})


@dataclass(frozen=True)
class Caller:
    id: str
    is_anonymous: bool
    email: str | None


@dataclass(frozen=True)
class CreditCharge:
    user_id: str
    is_guest: bool
    charged: bool
    credits_remaining: int | None
    action: str


def hash_client_ip(ip: str, salt: str) -> str:
    """Hash an IP with a server-side salt. The raw address is not stored."""
    normalized = (ip or "unknown").strip().lower()
    if not salt:
        raise RuntimeError("A salt is required to hash guest IP addresses")
    return hashlib.sha256(f"{salt}|{normalized}".encode("utf-8")).hexdigest()


def client_ip_from_forwarded(forwarded_for: str | None, fallback: str | None) -> str:
    if forwarded_for:
        first = forwarded_for.split(",")[0].strip()
        if first:
            return first
    if fallback and fallback.strip():
        return fallback.strip()
    return "unknown"


def guest_ip_salt(service_role_key: str, explicit_salt: str | None = None) -> str:
    if explicit_salt is None:
        explicit_salt = os.getenv("GUEST_IP_SALT", "")
    salt = explicit_salt.strip()
    if salt:
        return salt
    if service_role_key:
        return service_role_key
    raise RuntimeError("GUEST_IP_SALT or SUPABASE_SERVICE_ROLE_KEY is required to hash guest IPs")


def assert_user_owns_storage_path(storage_path: str, user_id: str) -> None:
    """Processed files must stay inside `{user_id}/...`."""
    if not storage_path or not user_id:
        raise HTTPException(status_code=400, detail="storage_path is required")
    if "\\" in storage_path or storage_path.startswith(("/", ".")):
        raise HTTPException(status_code=400, detail="Invalid storage path")
    parts = storage_path.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise HTTPException(status_code=400, detail="Invalid storage path")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="storage_path must live in the user's folder")
    if parts[0] != user_id:
        raise HTTPException(status_code=403, detail="Cannot access another user's images")


def assert_image_url_on_project(image_url: str, supabase_url: str) -> None:
    """The service downloads the URL with its own credentials. Keep that on our host."""
    image = urlparse(image_url)
    project = urlparse(supabase_url)
    if image.scheme != "https" or not image.netloc or image.netloc != project.netloc:
        raise HTTPException(
            status_code=400,
            detail="image_url must be an https URL on this project's Supabase host",
        )


def _admin_headers(service_key: str) -> dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }


def _migration_hint() -> HTTPException:
    return HTTPException(
        status_code=503,
        detail=(
            "Guest credits are not configured. Apply "
            "supabase/migrations/20261016120000_guest_credits.sql "
            "and enable Anonymous sign-ins in Supabase."
        ),
    )


def _out_of_credits(credits: int) -> HTTPException:
    return HTTPException(
        status_code=402,
        detail={
            "error": "insufficient_credits",
            "message": OUT_OF_CREDITS_MESSAGE,
            "credits_remaining": credits,
        },
    )


def _rpc_missing(response: httpx.Response) -> bool:
    if response.status_code == 404:
        return True
    try:
        body = response.json()
    except ValueError:
        return False
    if not isinstance(body, dict):
        return False
    return str(body.get("code") or "") in {"PGRST202", "42883"}


async def _request(
    method: str,
    url: str,
    *,
    headers: dict[str, str],
    json_body: dict | None = None,
    client: httpx.AsyncClient | None = None,
) -> httpx.Response:
    async def _send(http: httpx.AsyncClient) -> httpx.Response:
        return await http.request(method, url, headers=headers, json=json_body)

    if client is None:
        async with httpx.AsyncClient(timeout=20.0) as http:
            return await _send(http)
    return await _send(client)


async def resolve_caller(
    authorization: str | None,
    *,
    supabase_url: str,
    service_key: str,
    client: httpx.AsyncClient | None = None,
) -> Caller:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in required")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Sign in required")

    response = await _request(
        "GET",
        f"{supabase_url.rstrip('/')}/auth/v1/user",
        headers={"apikey": service_key, "Authorization": f"Bearer {token}"},
        client=client,
    )
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Sign in required")
    try:
        body = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Sign in required") from exc
    user_id = body.get("id") if isinstance(body, dict) else None
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=401, detail="Sign in required")
    email = body.get("email") if isinstance(body, dict) else None
    return Caller(
        id=user_id,
        is_anonymous=bool(body.get("is_anonymous")) if isinstance(body, dict) else False,
        email=email if isinstance(email, str) else None,
    )


async def _rpc(
    name: str,
    payload: dict,
    *,
    supabase_url: str,
    service_key: str,
    client: httpx.AsyncClient | None = None,
) -> httpx.Response:
    return await _request(
        "POST",
        f"{supabase_url.rstrip('/')}/rest/v1/rpc/{name}",
        headers=_admin_headers(service_key),
        json_body=payload,
        client=client,
    )


def _charge_from_body(caller: Caller, action: str, body: dict) -> CreditCharge:
    if body.get("ok") is True and body.get("unlimited") is True:
        return CreditCharge(
            user_id=caller.id,
            is_guest=False,
            charged=False,
            credits_remaining=None,
            action=action,
        )
    if body.get("ok") is True:
        remaining = body.get("credits_remaining")
        return CreditCharge(
            user_id=caller.id,
            is_guest=True,
            charged=True,
            credits_remaining=remaining if isinstance(remaining, int) else None,
            action=action,
        )
    if body.get("error") == "insufficient_credits":
        remaining = body.get("credits_remaining")
        raise _out_of_credits(remaining if isinstance(remaining, int) else 0)
    detail = body.get("error") if isinstance(body.get("error"), str) else "Guest credit check failed"
    raise HTTPException(status_code=403, detail=detail)


async def consume_for_action(
    caller: Caller,
    action: str,
    *,
    supabase_url: str,
    service_key: str,
    client: httpx.AsyncClient | None = None,
) -> CreditCharge:
    if action not in _CREDIT_ACTIONS:
        raise HTTPException(status_code=400, detail="Unknown credit action")
    response = await _rpc(
        "consume_guest_credit",
        {"p_user_id": caller.id, "p_action": action},
        supabase_url=supabase_url,
        service_key=service_key,
        client=client,
    )
    if _rpc_missing(response):
        if caller.is_anonymous:
            raise _migration_hint()
        # Signed-in accounts keep working if the migration is not applied yet.
        return CreditCharge(
            user_id=caller.id,
            is_guest=False,
            charged=False,
            credits_remaining=None,
            action=action,
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Could not check guest credits")
    try:
        body = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Could not check guest credits") from exc
    if not isinstance(body, dict):
        raise HTTPException(status_code=502, detail="Could not check guest credits")
    return _charge_from_body(caller, action, body)


async def refund_charge(
    charge: CreditCharge | None,
    *,
    supabase_url: str,
    service_key: str,
    client: httpx.AsyncClient | None = None,
) -> None:
    """Best-effort refund. A failed refund must not hide the original error."""
    if charge is None or not charge.charged:
        return
    try:
        await _rpc(
            "refund_guest_credit",
            {"p_user_id": charge.user_id, "p_action": charge.action},
            supabase_url=supabase_url,
            service_key=service_key,
            client=client,
        )
    except Exception:
        logger.warning("Guest credit refund failed for user %s", charge.user_id, exc_info=True)


async def grant_guest_session(
    caller: Caller,
    ip_hash: str,
    *,
    supabase_url: str,
    service_key: str,
    client: httpx.AsyncClient | None = None,
) -> dict:
    if not caller.is_anonymous:
        return {"ok": True, "is_guest": False, "unlimited": True, "credits_remaining": None}
    if not _SHA256_HEX.fullmatch(ip_hash):
        raise HTTPException(status_code=500, detail="Could not start a guest session")
    response = await _rpc(
        "grant_guest_credits",
        {"p_user_id": caller.id, "p_ip_hash": ip_hash},
        supabase_url=supabase_url,
        service_key=service_key,
        client=client,
    )
    if _rpc_missing(response):
        raise _migration_hint()
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Could not start a guest session")
    try:
        body = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Could not start a guest session") from exc
    if not isinstance(body, dict):
        raise HTTPException(status_code=502, detail="Could not start a guest session")
    body.pop("ip_hash", None)
    return body


async def authorize_background_removal(
    *,
    authorization: str | None,
    user_id: str,
    storage_path: str,
    image_url: str,
    supabase_url: str,
    service_key: str,
) -> CreditCharge:
    caller = await resolve_caller(
        authorization,
        supabase_url=supabase_url,
        service_key=service_key,
    )
    if user_id != caller.id:
        raise HTTPException(status_code=403, detail="user_id does not match the signed-in user")
    assert_user_owns_storage_path(storage_path, caller.id)
    assert_image_url_on_project(image_url, supabase_url)
    return await consume_for_action(
        caller,
        "background_removal",
        supabase_url=supabase_url,
        service_key=service_key,
    )


def supabase_settings() -> tuple[str, str]:
    supabase_url = os.getenv("SUPABASE_URL", "")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_key:
        raise HTTPException(
            status_code=500,
            detail="Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
        )
    return supabase_url, service_key
