"""API tests for the GIS service (no external network required)."""
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app

client = TestClient(app)
API_KEY = get_settings().api_key

SQUARE_REQUEST = {
    "geometry": {
        "type": "Polygon",
        "coordinates": [
            [
                [73.05, 31.40],
                [73.06, 31.40],
                [73.06, 31.41],
                [73.05, 31.41],
                [73.05, 31.40],
            ]
        ],
    },
    "window_days": 30,
}


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert "gee_enabled" in body


def test_ndvi_requires_api_key():
    res = client.post("/analyze/ndvi", json=SQUARE_REQUEST)
    assert res.status_code == 401

    res = client.post(
        "/analyze/ndvi", json=SQUARE_REQUEST, headers={"X-API-Key": "wrong-key"}
    )
    assert res.status_code == 401


def test_ndvi_analysis_synthetic():
    res = client.post(
        "/analyze/ndvi", json=SQUARE_REQUEST, headers={"X-API-Key": API_KEY}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["provider"] in ("synthetic", "gee")
    assert -1 <= body["statistics"]["mean"] <= 1
    assert body["png_base64"]


def test_ndvi_rejects_invalid_geometry():
    res = client.post(
        "/analyze/ndvi",
        json={"geometry": {"type": "Point", "coordinates": [1, 2]}},
        headers={"X-API-Key": API_KEY},
    )
    assert res.status_code == 422


def test_weather_rejects_invalid_coordinates():
    res = client.get(
        "/weather", params={"lat": 999, "lng": 0}, headers={"X-API-Key": API_KEY}
    )
    assert res.status_code == 400
