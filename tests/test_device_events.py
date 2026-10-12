import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_esp32_device_event_ingestion():
    payload = {
        "device_id": "esp32-unit-test-01",
        "device_name": "ESP32 Test Node",
        "device_type": "ESP32",
        "status": "online",
        "ip_address": "192.168.1.77",
        "mac_address": "24:6F:28:99:88:77",
        "sensor_data": {
            "temperature": 28.5,
            "humidity": 45.0
        },
        "traffic_volume": 420,
        "packet_count": 4,
        "request_frequency": 0.1,
        "connection_frequency": 2.0,
        "failed_connections": 0,
        "protocol": "TCP",
        "destination_port": 80
    }

    response = client.post("/api/device-events", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["device_id"] == "esp32-unit-test-01"
    assert data["classification"] in ["Normal", "Suspicious"]
    assert 0.0 <= data["risk_score"] <= 100.0
    assert data["risk_level"] in ["Low", "Medium", "High", "Critical"]

def test_esp32_auto_registration_and_update():
    # Verify the device was registered in the database
    response = client.get("/api/devices?search=esp32-unit-test-01")
    assert response.status_code == 200
    devices = response.json()["devices"]
    assert len(devices) >= 1
    target = next((d for d in devices if d["device_id"] == "esp32-unit-test-01"), None)
    assert target is not None
    assert target["name"] == "ESP32 Test Node"
    assert target["type"] == "ESP32"
    assert target["source"] == "real"
    assert target["latest_sensor_data"]["temperature"] == 28.5
