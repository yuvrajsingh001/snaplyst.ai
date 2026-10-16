"""Background-removal API tests.

rembg/ONNX and the Supabase client are mocked. These tests cover request
validation, storage-path naming, and the download → process → upload flow.
"""

from unittest.mock import MagicMock

import httpx
import pytest

from app import background_removal
from tests.images import png_bytes

REMOVE_URL = "/api/background-removal/remove"
BATCH_URL = "/api/background-removal/remove-batch"


def _payload(**overrides):
    body = {
        "image_url": "https://cdn.example/user/photo.jpg",
        "storage_path": "user-1/photo.jpg",
        "user_id": "user-1",
    }
    body.update(overrides)
    return body


class _DownloadClient:
    """Stand-in for httpx.AsyncClient that returns scripted GET responses."""

    def __init__(self, responses):
        self._responses = list(responses)
        self.urls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, timeout=None):
        self.urls.append(url)
        result = self._responses.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


class _Response:
    def __init__(self, content: bytes, status_code: int = 200):
        self.content = content
        self.status_code = status_code
        self.request = httpx.Request("GET", "https://cdn.example/image")

    def raise_for_status(self):
        if self.status_code >= 400:
            response = httpx.Response(self.status_code, request=self.request)
            raise httpx.HTTPStatusError("download failed", request=self.request, response=response)


def _install_downloader(monkeypatch, responses):
    client = _DownloadClient(responses)

    def _factory(*args, **kwargs):
        return client

    monkeypatch.setattr(background_removal.httpx, "AsyncClient", _factory)
    return client


def _install_supabase(monkeypatch, upload_error=None):
    bucket = MagicMock()
    if upload_error is not None:
        bucket.upload.side_effect = upload_error
    storage = MagicMock()
    storage.from_.return_value = bucket
    supabase_client = MagicMock()
    supabase_client.storage = storage

    fake_module = MagicMock()
    fake_module.create_client.return_value = supabase_client
    monkeypatch.setitem(__import__("sys").modules, "supabase", fake_module)
    return fake_module, bucket


def _install_rembg(monkeypatch, output=None, error=None):
    def _remove(image_data, session=None):
        if error is not None:
            raise error
        return output if output is not None else png_bytes()

    session = MagicMock(name="u2net-session")
    monkeypatch.setattr(background_removal, "remove", _remove)
    monkeypatch.setattr(background_removal, "new_session", lambda model: session)
    return session


def _configure_env(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role")


def test_remove_rejects_incomplete_payload(client):
    missing_user = client.post(
        REMOVE_URL,
        json={"image_url": "https://cdn.example/a.jpg", "storage_path": "user/a.jpg"},
    )
    assert missing_user.status_code == 422

    empty = client.post(REMOVE_URL, json={})
    assert empty.status_code == 422


def test_remove_reports_unavailable_library(client, monkeypatch):
    background_removal.REMBG_AVAILABLE = False
    _configure_env(monkeypatch)

    response = client.post(REMOVE_URL, json=_payload())

    assert response.status_code == 500
    assert "rembg" in response.json()["detail"]


def test_remove_requires_supabase_configuration(client, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    _install_rembg(monkeypatch)

    response = client.post(REMOVE_URL, json=_payload())

    assert response.status_code == 500
    assert "SUPABASE_URL" in response.json()["detail"]
    assert "SUPABASE_SERVICE_ROLE_KEY" in response.json()["detail"]


@pytest.mark.parametrize(
    ("storage_path", "expected"),
    [
        ("user-1/photo.jpg", "user-1/photo_bg_removed.png"),
        ("user-1/folder/look.1.jpeg", "user-1/folder/look.1_bg_removed.png"),
        ("user-1/noext", "user-1/noext_bg_removed.png"),
        # Current path join keeps a leading slash when there is no folder.
        ("photo.jpg", "/photo_bg_removed.png"),
    ],
)
def test_remove_names_processed_object_and_uploads_png(
    client, monkeypatch, storage_path, expected
):
    _configure_env(monkeypatch)
    _install_downloader(monkeypatch, [_Response(png_bytes())])
    _install_rembg(monkeypatch, output=png_bytes((0, 255, 0, 128)))
    fake_module, bucket = _install_supabase(monkeypatch)

    response = client.post(REMOVE_URL, json=_payload(storage_path=storage_path))

    assert response.status_code == 200
    body = response.json()
    assert body["processed_storage_path"] == expected
    assert body["original_storage_path"] == storage_path

    fake_module.create_client.assert_called_once_with(
        "https://example.supabase.co",
        "test-service-role",
    )
    fake_module.create_client.return_value.storage.from_.assert_called_with(
        "product-images"
    )
    from_args, _ = bucket.upload.call_args
    assert from_args[0] == expected
    uploaded = from_args[1]
    assert uploaded.startswith(b"\x89PNG")
    assert bucket.upload.call_args.kwargs["file_options"] == {
        "content-type": "image/png",
        "upsert": "true",
    }


def test_remove_uses_u2net_session(client, monkeypatch):
    _configure_env(monkeypatch)
    _install_downloader(monkeypatch, [_Response(png_bytes())])
    seen = {}

    def _new_session(model):
        seen["model"] = model
        return "session"

    def _remove(image_data, session=None):
        seen["session"] = session
        seen["size"] = len(image_data)
        return png_bytes()

    monkeypatch.setattr(background_removal, "new_session", _new_session)
    monkeypatch.setattr(background_removal, "remove", _remove)
    _install_supabase(monkeypatch)

    response = client.post(REMOVE_URL, json=_payload())

    assert response.status_code == 200
    assert seen == {"model": "u2net", "session": "session", "size": len(png_bytes())}


def test_remove_returns_400_when_download_fails(client, monkeypatch):
    _configure_env(monkeypatch)
    _install_rembg(monkeypatch)
    _install_supabase(monkeypatch)
    request = httpx.Request("GET", "https://cdn.example/missing.jpg")
    _install_downloader(
        monkeypatch,
        [httpx.HTTPStatusError("nope", request=request, response=httpx.Response(404, request=request))],
    )

    response = client.post(REMOVE_URL, json=_payload())

    assert response.status_code == 400
    assert "Failed to download image" in response.json()["detail"]


def test_remove_returns_500_when_model_fails(client, monkeypatch):
    _configure_env(monkeypatch)
    _install_downloader(monkeypatch, [_Response(png_bytes())])
    _install_rembg(monkeypatch, error=RuntimeError("model exploded"))
    _install_supabase(monkeypatch)

    response = client.post(REMOVE_URL, json=_payload())

    assert response.status_code == 500
    assert "model exploded" in response.json()["detail"]


def test_remove_returns_500_when_upload_fails(client, monkeypatch):
    _configure_env(monkeypatch)
    _install_downloader(monkeypatch, [_Response(png_bytes())])
    _install_rembg(monkeypatch)
    _install_supabase(monkeypatch, upload_error=RuntimeError("bucket full"))

    response = client.post(REMOVE_URL, json=_payload())

    assert response.status_code == 500
    assert "bucket full" in response.json()["detail"]


def test_batch_rejects_when_rembg_unavailable(client):
    background_removal.REMBG_AVAILABLE = False

    response = client.post(BATCH_URL, json=["https://cdn.example/a.jpg"])

    assert response.status_code == 500
    assert "rembg" in response.json()["detail"]


def test_batch_returns_per_image_success_and_failure(client, monkeypatch):
    source = png_bytes()
    request = httpx.Request("GET", "https://cdn.example/bad.jpg")
    downloader = _install_downloader(
        monkeypatch,
        [
            _Response(source),
            httpx.ConnectError("connection refused", request=request),
        ],
    )
    _install_rembg(monkeypatch, output=png_bytes((0, 0, 255, 255)))

    response = client.post(
        BATCH_URL,
        json=["https://cdn.example/ok.jpg", "https://cdn.example/bad.jpg"],
    )

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 2
    assert results[0]["success"] is True
    assert results[0]["original_url"] == "https://cdn.example/ok.jpg"
    assert results[0]["processed_image_base64"].startswith("data:image/png;base64,")
    assert results[1]["success"] is False
    assert results[1]["original_url"] == "https://cdn.example/bad.jpg"
    assert "connection refused" in results[1]["error"]
    assert downloader.urls == [
        "https://cdn.example/ok.jpg",
        "https://cdn.example/bad.jpg",
    ]


def test_batch_empty_list_returns_no_results(client, monkeypatch):
    _install_rembg(monkeypatch)

    response = client.post(BATCH_URL, json=[])

    assert response.status_code == 200
    assert response.json() == {"results": []}
