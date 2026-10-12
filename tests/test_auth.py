import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "NetPulse" in data["service"]

def test_login_demo_admin():
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "Admin@123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "admin@example.com"
    assert data["user"]["role"] == "admin"

def test_login_invalid_password():
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "WrongPassword"}
    )
    assert response.status_code == 401

def test_register_and_me():
    import uuid
    rand_email = f"analyst_{uuid.uuid4().hex[:6]}@example.com"
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": rand_email, "password": "SecurePassword123!", "full_name": "Test Analyst"}
    )
    assert reg_resp.status_code == 200
    token = reg_resp.json()["access_token"]

    # Test protected /me endpoint
    me_resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == rand_email
