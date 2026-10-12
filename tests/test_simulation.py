import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_simulation_status_and_triggers():
    # Check status
    status_resp = client.get("/api/simulation/status")
    assert status_resp.status_code == 200
    data = status_resp.json()
    assert "is_running" in data
    assert data["device_count"] >= 5

    # Trigger normal scenario
    client.post("/api/blocking/unblock", json={"entity_id": "sim-temp-01"})
    normal_resp = client.post("/api/simulation/trigger-scenario", json={"scenario": "normal"})
    assert normal_resp.status_code == 200
    res = normal_resp.json()["result"]
    assert res["status"] in ["success", "blocked"]

    # Trigger high traffic scenario
    high_resp = client.post("/api/simulation/trigger-scenario", json={"scenario": "high_traffic"})
    assert high_resp.status_code == 200
    res_high = high_resp.json()["result"]
    assert res_high["status"] in ["success", "blocked"]

    # Trigger suspicious activity scenario
    susp_resp = client.post("/api/simulation/trigger-scenario", json={"scenario": "suspicious_activity"})
    assert susp_resp.status_code == 200
    res_susp = susp_resp.json()["result"]
    assert res_susp["status"] in ["success", "blocked"]
    assert res_susp["classification"] == "Suspicious"
    assert res_susp["risk_score"] >= 30.0

    # Trigger unknown device scenario
    unk_resp = client.post("/api/simulation/trigger-scenario", json={"scenario": "unknown_device"})
    assert unk_resp.status_code == 200
    res_unk = unk_resp.json()["result"]
    assert "unknown-iot-node" in res_unk["device_id"]
