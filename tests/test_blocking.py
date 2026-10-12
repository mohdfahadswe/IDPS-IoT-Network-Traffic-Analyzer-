import pytest
import asyncio
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from backend.main import app
from backend.app.database.connection import SessionLocal
from backend.app.models.database_models import BlockedEntity
from backend.app.services.blocking_service import blocking_service

client = TestClient(app)

def test_manual_block_and_unblock_ip():
    target_ip = "192.168.1.240"
    
    # Block IP
    block_resp = client.post("/api/blocking/block", json={
        "entity_type": "ip",
        "entity_id": target_ip,
        "reason": "Suspicious Port Sweep",
        "is_temporary": False
    })
    assert block_resp.status_code == 200
    assert block_resp.json()["status"] == "success"

    # Verify IP shows in blocked entities list
    list_resp = client.get("/api/blocking")
    assert list_resp.status_code == 200
    blocked_entities = list_resp.json()
    assert any(b["entity_id"] == target_ip and b["is_active"] is True for b in blocked_entities)

    # Unblock IP
    unblock_resp = client.post(f"/api/blocking/unblock/{target_ip}")
    assert unblock_resp.status_code == 200
    assert unblock_resp.json()["status"] == "success"

    # Verify IP is no longer active
    list_resp2 = client.get("/api/blocking")
    assert not any(b["entity_id"] == target_ip and b["is_active"] is True for b in list_resp2.json())

def test_temporary_block_and_expiry():
    target_device = "sim-test-temp-dev"
    
    # 1. Place temporary block for 15 minutes
    block_resp = client.post("/api/blocking/block", json={
        "entity_type": "device",
        "entity_id": target_device,
        "reason": "Automated High Risk Containment",
        "is_temporary": True,
        "duration_minutes": 15
    })
    assert block_resp.status_code == 200
    assert block_resp.json()["is_temporary"] is True

    # 2. Verify in active blocks
    db = SessionLocal()
    try:
        block = db.query(BlockedEntity).filter(
            BlockedEntity.entity_id == target_device,
            BlockedEntity.is_active == True
        ).first()
        assert block is not None
        assert block.is_temporary is True
        assert block.expiry_time is not None

        # 3. Simulate elapsed time by backdating expiry_time
        block.expiry_time = datetime.now(timezone.utc) - timedelta(seconds=10)
        db.commit()

        # 4. Trigger expiration worker logic
        expired_ids = asyncio.run(blocking_service.check_and_expire_temporary_blocks(db))
        assert target_device in expired_ids

        # 5. Verify entity is no longer active
        refreshed_block = db.query(BlockedEntity).filter(BlockedEntity.id == block.id).first()
        assert refreshed_block.is_active is False
    finally:
        db.close()
