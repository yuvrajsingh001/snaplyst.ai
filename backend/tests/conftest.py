"""Test setup that keeps the ONNX/rembg stack out of CI.

`background_removal` treats a successful `rembg` import as "model available".
Installing the real packages would download ONNX weights and make CI slow, so
the heavy modules are stubbed before the app is imported.
"""

import os
import sys
from unittest.mock import MagicMock

# Deterministic CORS config. main.py reads this at import time.
os.environ["ALLOWED_ORIGINS"] = "http://localhost:3000,http://127.0.0.1:3000"

rembg_mod = MagicMock()
session_factory = MagicMock()
rembg_mod.session_factory = session_factory
sys.modules["onnxruntime"] = MagicMock()
sys.modules["rembg"] = rembg_mod
sys.modules["rembg.session_factory"] = session_factory

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import background_removal  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def _rembg_available():
    """Default every test to a loaded (but mocked) rembg, then restore it."""
    background_removal.REMBG_AVAILABLE = True
    yield
    background_removal.REMBG_AVAILABLE = True
