"""Guest credit enforcement.

These tests mock Supabase Auth, the credit RPCs, rembg, and Google Vision.
They do not need a live project. The SQL migration is checked for the
server-side rules the Python service relies on.
"""

import base64
from pathlib import Path
from unittest.mock import MagicMock

import httpx
import pytest
from fastapi import HTTPException

from app import background_removal, guest_routes, removal_guard

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20261016120000_guest_credits.sql"
REMOVE_URL = "/api/background-removal/remove"
BATCH_URL = "/api/background-removal/remove-batch"
SESSION_URL = "/api/guest/session"
VISION_URL = "/api/vision/analyze"
PROJECT = "https://example.supabase.co"
TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def _payload(**overrides):
    body = {
        "image_url": f"{PROJECT}/storage/v1/object/public/product-images/user-1/photo.jpg",
        "storage_path": "user-1/photo.jpg",
        "user_id": "user-1",
    }
    body.update(overrides)
    return body


def _configure(monkeypatch, **extra):
    monkeypatch.setenv("SUPABASE_URL", PROJECT)
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role")
    monkeypatch.setenv("GUEST_IP_SALT", "test-salt")
    for key, value in extra.items():
        monkeypatch.setenv(key, value)


class _Response:
    def __init__(self, status_code, payload=None, content=b""):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.content = content
        self.request = httpx.Request("GET", PROJECT)

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            response = httpx.Response(self.status_code, request=self.request)
            raise httpx.HTTPStatusError("download failed", request=self.request, response=response)


class _Router:
    """One fake AsyncClient shared by auth, credit RPCs, downloads, and Vision."""

    def __init__(self):
        self.calls = []
        self.user = {"id": "user-1", "is_anonymous": False, "email": "a@example.com"}
        self.consume = {"ok": True, "is_guest": False, "unlimited": True, "credits_remaining": None}
        self.grant = {
            "ok": True,
            "is_guest": True,
            "unlimited": False,
            "credits_remaining": 5,
            "created": True,
        }
        self.refund_status = 200
        self.vision_status = 200
        self.vision_body = {
            "responses": [
                {"labelAnnotations": [{"description": "Jacket", "score": 0.9}]}
            ]
        }
        self.download_status = 200

    def __call__(self, *args, **kwargs):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def request(self, method, url, headers=None, json=None):
        self.calls.append((method, url, json))
        if url.endswith("/auth/v1/user"):
            if self.user is None:
                return _Response(401, {"message": "bad jwt"})
            return _Response(200, self.user)
        if url.endswith("/rpc/consume_guest_credit"):
            return _Response(200, self.consume)
        if url.endswith("/rpc/grant_guest_credits"):
            return _Response(200, self.grant)
        if url.endswith("/rpc/refund_guest_credit"):
            return _Response(self.refund_status, {"ok": True, "credits_remaining": 5})
        return _Response(404, {"code": "PGRST202", "message": "missing"})

    async def get(self, url, timeout=None, headers=None):
        self.calls.append(("GET", url, None))
        return _Response(self.download_status, content=TINY_PNG)

    async def post(self, url, params=None, json=None, timeout=None):
        self.calls.append(("POST", url, {"params": params, "json": json}))
        return _Response(self.vision_status, self.vision_body)


def _install_router(monkeypatch):
    router = _Router()
    monkeypatch.setattr(removal_guard.httpx, "AsyncClient", router)
    monkeypatch.setattr(background_removal.httpx, "AsyncClient", router)
    monkeypatch.setattr(guest_routes.httpx, "AsyncClient", router)
    return router


def _install_model(monkeypatch):
    def _remove(image_data, session=None):
        return TINY_PNG

    monkeypatch.setattr(background_removal, "remove", _remove)
    monkeypatch.setattr(background_removal, "new_session", lambda model: "session")


def _install_storage(monkeypatch):
    bucket = MagicMock()
    storage = MagicMock()
    storage.from_.return_value = bucket
    supabase_client = MagicMock()
    supabase_client.storage = storage
    fake_module = MagicMock()
    fake_module.create_client.return_value = supabase_client
    monkeypatch.setitem(__import__("sys").modules, "supabase", fake_module)
    return bucket


def test_migration_keeps_credits_on_the_server():
    sql = MIGRATION.read_text()
    assert "security definer" in sql
    assert "v_initial integer := 5" in sql
    assert "v_limit integer := 3" in sql
    assert "v_window_hours integer := 24" in sql
    assert "credits_remaining > 0" in sql
    assert "is_anonymous" in sql
    assert "guest_quota_exceeded" in sql
    assert "auth.uid() = user_id" in sql
    for name in (
        "public.grant_guest_credits(uuid, text)",
        "public.consume_guest_credit(uuid, text)",
        "public.refund_guest_credit(uuid, text)",
    ):
        assert f"revoke all on function {name} from public" in sql
        assert f"revoke all on function {name} from anon" in sql
        assert f"revoke all on function {name} from authenticated" in sql
        assert f"grant execute on function {name} to service_role" in sql
    assert "enable row level security" in sql


def test_ip_hash_does_not_keep_the_raw_address():
    digest = removal_guard.hash_client_ip("203.0.113.9", "salt")
    assert digest != removal_guard.hash_client_ip("203.0.113.9", "other")
    assert digest == removal_guard.hash_client_ip(" 203.0.113.9 ", "salt")
    assert "203.0.113.9" not in digest
    assert len(digest) == 64
    assert removal_guard.client_ip_from_forwarded("203.0.113.9, 10.0.0.4", "127.0.0.1") == "203.0.113.9"
    assert removal_guard.client_ip_from_forwarded(None, None) == "unknown"


@pytest.mark.parametrize(
    ("path", "user_id"),
    [
        ("other-user/photo.jpg", "user-1"),
        ("user-1/../../other/photo.jpg", "user-1"),
        ("/user-1/photo.jpg", "user-1"),
        ("photo.jpg", "user-1"),
        ("", "user-1"),
        (r"user-1\photo.jpg", "user-1"),
    ],
)
def test_storage_paths_cannot_leave_the_caller_folder(path, user_id):
    with pytest.raises(HTTPException) as caught:
        removal_guard.assert_user_owns_storage_path(path, user_id)
    assert caught.value.status_code in {400, 403}


def test_storage_path_allows_the_callers_own_folder():
    removal_guard.assert_user_owns_storage_path("user-1/folder/photo.jpg", "user-1")


def test_image_url_must_stay_on_the_project_host():
    removal_guard.assert_image_url_on_project(
        f"{PROJECT}/storage/v1/object/public/product-images/user-1/photo.jpg",
        PROJECT,
    )
    with pytest.raises(HTTPException) as caught:
        removal_guard.assert_image_url_on_project("https://cdn.example/photo.jpg", PROJECT)
    assert caught.value.status_code == 400
    with pytest.raises(HTTPException):
        removal_guard.assert_image_url_on_project("http://example.supabase.co/photo.jpg", PROJECT)


def test_remove_rejects_missing_token(client, monkeypatch):
    _configure(monkeypatch)
    called = {"model": False}

    def _remove(*args, **kwargs):
        called["model"] = True
        return TINY_PNG

    monkeypatch.setattr(background_removal, "remove", _remove)
    response = client.post(REMOVE_URL, json=_payload())
    assert response.status_code == 401
    assert called["model"] is False


def test_remove_rejects_another_users_folder(client, monkeypatch):
    _configure(monkeypatch)
    router = _install_router(monkeypatch)
    router.user = {"id": "user-1", "is_anonymous": True, "email": None}
    response = client.post(
        REMOVE_URL,
        headers={"Authorization": "Bearer guest-token"},
        json=_payload(storage_path="someone-else/photo.jpg", user_id="user-1"),
    )
    assert response.status_code == 403
    assert not any(call[1].endswith("/rpc/consume_guest_credit") for call in router.calls)


def test_remove_rejects_a_body_user_id_that_does_not_match_the_token(client, monkeypatch):
    _configure(monkeypatch)
    _install_router(monkeypatch)
    response = client.post(
        REMOVE_URL,
        headers={"Authorization": "Bearer token"},
        json=_payload(user_id="someone-else"),
    )
    assert response.status_code == 403


def test_guest_without_credits_does_not_run_the_model(client, monkeypatch):
    _configure(monkeypatch)
    router = _install_router(monkeypatch)
    router.user = {"id": "user-1", "is_anonymous": True, "email": None}
    router.consume = {
        "ok": False,
        "error": "insufficient_credits",
        "is_guest": True,
        "credits_remaining": 0,
    }
    called = {"model": False}

    def _remove(*args, **kwargs):
        called["model"] = True
        return TINY_PNG

    monkeypatch.setattr(background_removal, "remove", _remove)
    response = client.post(
        REMOVE_URL,
        headers={"Authorization": "Bearer guest-token"},
        json=_payload(),
    )
    assert response.status_code == 402
    detail = response.json()["detail"]
    assert detail["error"] == "insufficient_credits"
    assert detail["credits_remaining"] == 0
    assert called["model"] is False


def test_signed_in_removal_is_not_metered(client, monkeypatch):
    _configure(monkeypatch)
    router = _install_router(monkeypatch)
    _install_model(monkeypatch)
    bucket = _install_storage(monkeypatch)

    response = client.post(
        REMOVE_URL,
        headers={"Authorization": "Bearer user-token"},
        json=_payload(),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["processed_storage_path"] == "user-1/photo_bg_removed.png"
    assert body["original_storage_path"] == "user-1/photo.jpg"
    assert body["credits_remaining"] is None
    assert bucket.upload.call_args.args[0] == "user-1/photo_bg_removed.png"
    assert not any(call[1].endswith("/rpc/refund_guest_credit") for call in router.calls)


def test_failed_guest_removal_refunds_the_credit(client, monkeypatch):
    _configure(monkeypatch)
    router = _install_router(monkeypatch)
    router.user = {"id": "user-1", "is_anonymous": True, "email": None}
    router.consume = {
        "ok": True,
        "is_guest": True,
        "unlimited": False,
        "credits_remaining": 4,
    }
    router.download_status = 404
    _install_storage(monkeypatch)

    response = client.post(
        REMOVE_URL,
        headers={"Authorization": "Bearer guest-token"},
        json=_payload(),
    )

    assert response.status_code == 400, response.text
    assert any(call[1].endswith("/rpc/refund_guest_credit") for call in router.calls)
    refund = next(call for call in router.calls if call[1].endswith("/rpc/refund_guest_credit"))
    assert refund[2]["p_user_id"] == "user-1"
    assert refund[2]["p_action"] == "background_removal"


def test_signed_in_removal_still_works_before_the_migration(client, monkeypatch):
    _configure(monkeypatch)
    router = _install_router(monkeypatch)
    router.consume = None
    _install_model(monkeypatch)
    _install_storage(monkeypatch)

    real_request = router.request

    async def request(method, url, headers=None, json=None):
        if url.endswith("/rpc/consume_guest_credit"):
            router.calls.append((method, url, json))
            return _Response(404, {"code": "PGRST202"})
        return await real_request(method, url, headers=headers, json=json)

    router.request = request
    response = client.post(
        REMOVE_URL,
        headers={"Authorization": "Bearer user-token"},
        json=_payload(),
    )
    assert response.status_code == 200


def test_guest_removal_fails_closed_when_the_migration_is_missing(client, monkeypatch):
    _configure(monkeypatch)
    router = _install_router(monkeypatch)
    router.user = {"id": "user-1", "is_anonymous": True, "email": None}

    async def request(method, url, headers=None, json=None):
        router.calls.append((method, url, json))
        if url.endswith("/auth/v1/user"):
            return _Response(200, router.user)
        return _Response(404, {"code": "PGRST202"})

    router.request = request
    response = client.post(
        REMOVE_URL,
        headers={"Authorization": "Bearer guest-token"},
        json=_payload(),
    )
    assert response.status_code == 503
    assert "guest_credits.sql" in response.json()["detail"]


def test_batch_requires_auth_and_stops_when_credits_run_out(client, monkeypatch):
    _configure(monkeypatch)
    missing = client.post(BATCH_URL, json=[f"{PROJECT}/a.jpg"])
    assert missing.status_code == 401

    router = _install_router(monkeypatch)
    router.user = {"id": "user-1", "is_anonymous": True, "email": None}
    router.consume = {
        "ok": False,
        "error": "insufficient_credits",
        "credits_remaining": 0,
        "is_guest": True,
    }
    called = {"model": False}
    monkeypatch.setattr(
        background_removal,
        "remove",
        lambda *args, **kwargs: called.__setitem__("model", True),
    )

    response = client.post(
        BATCH_URL,
        headers={"Authorization": "Bearer guest-token"},
        json=[f"{PROJECT}/a.jpg", f"{PROJECT}/b.jpg"],
    )
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 1
    assert results[0]["success"] is False
    assert results[0]["status_code"] == 402
    assert called["model"] is False


def test_guest_session_stores_a_hash_and_hides_the_ip(client, monkeypatch):
    _configure(monkeypatch)
    router = _install_router(monkeypatch)
    router.user = {"id": "guest-1", "is_anonymous": True, "email": None}

    response = client.post(
        SESSION_URL,
        headers={"Authorization": "Bearer guest-token", "X-Forwarded-For": "203.0.113.9, 10.0.0.8"},
    )

    assert response.status_code == 200
    assert response.json()["credits_remaining"] == 5
    assert "203.0.113.9" not in response.text
    grant = next(call for call in router.calls if call[1].endswith("/rpc/grant_guest_credits"))
    assert grant[2]["p_user_id"] == "guest-1"
    assert grant[2]["p_ip_hash"] == removal_guard.hash_client_ip("203.0.113.9", "test-salt")


def test_guest_session_reports_the_network_quota(client, monkeypatch):
    _configure(monkeypatch)
    router = _install_router(monkeypatch)
    router.user = {"id": "guest-2", "is_anonymous": True, "email": None}
    router.grant = {
        "ok": False,
        "error": "guest_quota_exceeded",
        "is_guest": True,
        "credits_remaining": 0,
    }
    response = client.post(
        SESSION_URL,
        headers={"Authorization": "Bearer guest-token", "X-Forwarded-For": "198.51.100.4"},
    )
    assert response.status_code == 200
    assert response.json()["error"] == "guest_quota_exceeded"
    assert response.json()["credits_remaining"] == 0


def test_guest_vision_spends_a_credit_before_calling_google(client, monkeypatch):
    _configure(monkeypatch, GOOGLE_VISION_API_KEY="vision-key")
    router = _install_router(monkeypatch)
    router.user = {"id": "user-1", "is_anonymous": True, "email": None}
    router.consume = {
        "ok": True,
        "is_guest": True,
        "unlimited": False,
        "credits_remaining": 4,
    }

    response = client.post(
        VISION_URL,
        headers={"Authorization": "Bearer guest-token"},
        json={"image_base64": base64.b64encode(b"hello").decode()},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["credits_remaining"] == 4
    assert body["annotations"]["labelAnnotations"][0]["description"] == "Jacket"
    vision_calls = [call for call in router.calls if "vision.googleapis.com" in call[1]]
    assert len(vision_calls) == 1
    assert vision_calls[0][2]["params"]["key"] == "vision-key"
    assert "vision-key" not in response.text
    consume_at = next(i for i, call in enumerate(router.calls) if call[1].endswith("/rpc/consume_guest_credit"))
    vision_at = next(i for i, call in enumerate(router.calls) if "vision.googleapis.com" in call[1])
    assert consume_at < vision_at


def test_guest_vision_refunds_when_google_fails(client, monkeypatch):
    _configure(monkeypatch, GOOGLE_VISION_API_KEY="vision-key")
    router = _install_router(monkeypatch)
    router.user = {"id": "user-1", "is_anonymous": True, "email": None}
    router.consume = {
        "ok": True,
        "is_guest": True,
        "unlimited": False,
        "credits_remaining": 4,
    }
    router.vision_status = 503
    router.vision_body = {"error": {"message": "backend unavailable"}}

    response = client.post(
        VISION_URL,
        headers={"Authorization": "Bearer guest-token"},
        json={"image_base64": base64.b64encode(b"hello").decode()},
    )

    assert response.status_code == 502
    assert any(call[1].endswith("/rpc/refund_guest_credit") for call in router.calls)


def test_guest_vision_rejects_callers_who_are_not_guests(client, monkeypatch):
    _configure(monkeypatch, GOOGLE_VISION_API_KEY="vision-key")
    _install_router(monkeypatch)
    response = client.post(
        VISION_URL,
        headers={"Authorization": "Bearer user-token"},
        json={"image_base64": base64.b64encode(b"hello").decode()},
    )
    assert response.status_code == 403


def test_guest_vision_rejects_an_empty_or_huge_image(client, monkeypatch):
    _configure(monkeypatch, GOOGLE_VISION_API_KEY="vision-key")
    router = _install_router(monkeypatch)
    router.user = {"id": "user-1", "is_anonymous": True, "email": None}
    empty = client.post(
        VISION_URL,
        headers={"Authorization": "Bearer guest-token"},
        json={"image_base64": ""},
    )
    assert empty.status_code == 400
    assert not any(call[1].endswith("/rpc/consume_guest_credit") for call in router.calls)

    monkeypatch.setattr(guest_routes, "MAX_IMAGE_BYTES", 4)
    too_big = client.post(
        VISION_URL,
        headers={"Authorization": "Bearer guest-token"},
        json={"image_base64": base64.b64encode(b"hello").decode()},
    )
    assert too_big.status_code == 413
