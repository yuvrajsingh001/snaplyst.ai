def test_health_reports_ok_and_production_cors(client):
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["background_removal"] == "available"
    assert "http://localhost:3000" in body["cors_origins"]
    assert "http://127.0.0.1:3000" in body["cors_origins"]
    # Production origin is always appended, even when ALLOWED_ORIGINS omits it.
    assert "https://snaplyst-ai.vercel.app" in body["cors_origins"]


def test_health_reports_unavailable_rembg(client):
    from app import background_removal

    background_removal.REMBG_AVAILABLE = False
    background_removal.import_error = "ImportError: rembg missing"

    body = client.get("/health").json()

    assert body["status"] == "ok"
    assert "unavailable" in body["background_removal"]
    assert "rembg missing" in body["background_removal"]


def test_cors_allows_configured_and_production_origins(client):
    for origin in (
        "http://localhost:3000",
        "https://snaplyst-ai.vercel.app",
    ):
        response = client.options(
            "/health",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.headers["access-control-allow-origin"] == origin


def test_cors_does_not_reflect_unknown_origins(client):
    response = client.options(
        "/health",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.headers.get("access-control-allow-origin") != "https://evil.example"
