from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database.connection import get_db
from backend.app.models.database_models import BlockedEntity, SecurityAction
from backend.app.schemas.api_schemas import BlockEntityRequest, BlockedEntityOut
from backend.app.services.blocking_service import blocking_service
from backend.app.websocket.connection_manager import manager

router = APIRouter(prefix="/blocking", tags=["Blocking & Mitigation System"])

@router.get("", response_model=List[BlockedEntityOut])
def list_blocked_entities(include_expired: bool = False, db: Session = Depends(get_db)):
    query = db.query(BlockedEntity)
    if not include_expired:
        query = query.filter(BlockedEntity.is_active == True)

    entities = query.order_by(desc(BlockedEntity.block_start)).all()
    now = datetime.now(timezone.utc)

    results = []
    for e in entities:
        # Calculate time remaining in seconds for temporary blocks
        remaining_secs = None
        if e.is_temporary and e.expiry_time and e.is_active:
            # Ensure timezone awareness
            exp = e.expiry_time if e.expiry_time.tzinfo else e.expiry_time.replace(tzinfo=timezone.utc)
            delta = (exp - now).total_seconds()
            remaining_secs = max(0, int(delta))
            if remaining_secs == 0 and e.is_active:
                e.is_active = False
                db.commit()

        out_item = BlockedEntityOut(
            id=e.id,
            entity_type=e.entity_type,
            entity_id=e.entity_id,
            ip_address=e.ip_address,
            reason=e.reason,
            is_temporary=e.is_temporary,
            block_start=e.block_start,
            expiry_time=e.expiry_time,
            is_active=e.is_active,
            time_remaining_seconds=remaining_secs
        )
        results.append(out_item)

    return results

@router.post("/block")
async def block_entity(block_in: BlockEntityRequest, db: Session = Depends(get_db)):
    block_record = blocking_service.block_entity(
        db=db,
        entity_type=block_in.entity_type,
        entity_id=block_in.entity_id,
        reason=block_in.reason,
        is_temporary=block_in.is_temporary,
        duration_minutes=block_in.duration_minutes,
        triggered_by="manual",
        ip_address=block_in.ip_address
    )

    await manager.broadcast("BLOCK_UPDATE", {
        "action": "BLOCK",
        "entity_id": block_in.entity_id,
        "is_temporary": block_in.is_temporary,
        "expiry_time": block_record.expiry_time.isoformat() if block_record.expiry_time else None
    })

    return {
        "status": "success",
        "message": f"Entity {block_in.entity_id} has been successfully blocked",
        "block_id": block_record.id,
        "is_temporary": block_record.is_temporary,
        "expiry_time": block_record.expiry_time.isoformat() if block_record.expiry_time else None
    }

@router.post("/unblock/{entity_id}")
async def unblock_entity(entity_id: str, db: Session = Depends(get_db)):
    success = blocking_service.unblock_entity(
        db=db,
        entity_id=entity_id,
        reason="Operator manually requested unblock",
        triggered_by="manual"
    )
    if not success:
        raise HTTPException(status_code=404, detail="Entity not found in active blocks")

    await manager.broadcast("BLOCK_UPDATE", {
        "action": "UNBLOCK",
        "entity_id": entity_id
    })

    return {
        "status": "success",
        "message": f"Entity {entity_id} has been unblocked"
    }

@router.get("/audit-log")
def get_security_audit_log(limit: int = 50, db: Session = Depends(get_db)):
    actions = (
        db.query(SecurityAction)
        .order_by(desc(SecurityAction.timestamp))
        .limit(limit)
        .all()
    )
    return [
        {
            "id": a.id,
            "timestamp": a.timestamp.isoformat(),
            "action_type": a.action_type,
            "target_entity": a.target_entity,
            "reason": a.reason,
            "triggered_by": a.triggered_by,
            "details": a.details
        }
        for a in actions
    ]
