from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database.connection import get_db
from backend.app.models.database_models import (
    Device, DeviceEvent, Alert, BlockedEntity, RiskScoreRecord, DomainActivity, Domain
)
from backend.app.schemas.api_schemas import DeviceOut, DeviceActionRequest
from backend.app.services.blocking_service import blocking_service
from backend.app.websocket.connection_manager import manager

router = APIRouter(prefix="/devices", tags=["Connected Devices"])

@router.get("", response_model=dict)
def list_devices(
    search: Optional[str] = Query(None, description="Search by name, ID, or IP"),
    status: Optional[str] = Query(None, description="Filter by status"),
    source: Optional[str] = Query(None, description="Filter by source (real / simulated)"),
    device_type: Optional[str] = Query(None, description="Filter by device type"),
    sort_by: Optional[str] = Query("last_seen", description="Sort field"),
    order: Optional[str] = Query("desc", description="asc or desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    from backend.app.simulation.simulation_engine import simulation_engine
    now_dt = datetime.now(timezone.utc)

    # 1. Sync simulated device statuses with simulation_engine.is_running
    if not simulation_engine.is_running:
        db.query(Device).filter(
            Device.source == "simulated",
            Device.status.notin_(["blocked", "temporarily_blocked"]),
            Device.status != "offline"
        ).update({"status": "offline"}, synchronize_session=False)
    else:
        db.query(Device).filter(
            Device.source == "simulated",
            Device.status.notin_(["blocked", "temporarily_blocked"]),
            Device.status == "offline"
        ).update({"status": "online"}, synchronize_session=False)

    # 2. Sync real device timeouts (>45s inactivity)
    real_devices = db.query(Device).filter(
        Device.source == "real",
        Device.status.notin_(["blocked", "temporarily_blocked"]),
        Device.status != "offline"
    ).all()
    for rd in real_devices:
        if not rd.last_seen:
            rd.status = "offline"
        else:
            rd_dt = rd.last_seen.replace(tzinfo=timezone.utc) if rd.last_seen.tzinfo is None else rd.last_seen
            if (now_dt - rd_dt).total_seconds() > 45:
                rd.status = "offline"
    db.commit()

    query = db.query(Device)

    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (Device.name.ilike(search_fmt)) |
            (Device.device_id.ilike(search_fmt)) |
            (Device.ip_address.ilike(search_fmt)) |
            (Device.mac_address.ilike(search_fmt)) |
            (Device.type.ilike(search_fmt))
        )

    if status and status != "all":
        norm_status = status.lower().strip()
        if norm_status == "active":
            query = query.filter(Device.status.in_(["online", "suspicious"]))
        else:
            query = query.filter(Device.status == norm_status)

    if source and source != "all":
        query = query.filter(Device.source == source)

    if device_type and device_type != "all":
        query = query.filter(Device.type == device_type)

    total = query.count()

    # Sorting
    sort_attr = getattr(Device, sort_by, Device.last_seen)
    if order == "desc":
        query = query.order_by(desc(sort_attr))
    else:
        query = query.order_by(sort_attr)

    devices = query.offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "devices": [DeviceOut.model_validate(d) for d in devices]
    }

@router.get("/{device_id}")
def get_device_detail(device_id: str, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if device.status not in ["blocked", "temporarily_blocked"]:
        changed = False
        if device.source == "simulated":
            from backend.app.simulation.simulation_engine import simulation_engine
            if simulation_engine.is_running:
                if device.status == "offline":
                    device.status = "online"
                    changed = True
            else:
                if device.status != "offline":
                    device.status = "offline"
                    changed = True
        elif device.source == "real":
            if not device.last_seen:
                if device.status != "offline":
                    device.status = "offline"
                    changed = True
            else:
                last_seen_dt = device.last_seen.replace(tzinfo=timezone.utc) if device.last_seen.tzinfo is None else device.last_seen
                if (datetime.now(timezone.utc) - last_seen_dt).total_seconds() > 45:
                    if device.status != "offline":
                        device.status = "offline"
                        changed = True
        if changed:
            db.commit()

    # Recent Events
    recent_events = (
        db.query(DeviceEvent)
        .filter(DeviceEvent.device_id == device_id)
        .order_by(desc(DeviceEvent.timestamp))
        .limit(20)
        .all()
    )

    # Recent Alerts
    recent_alerts = (
        db.query(Alert)
        .filter(Alert.device_id == device_id)
        .order_by(desc(Alert.timestamp))
        .limit(10)
        .all()
    )

    # Risk Score History
    risk_history = (
        db.query(RiskScoreRecord)
        .filter(RiskScoreRecord.device_id == device_id)
        .order_by(desc(RiskScoreRecord.timestamp))
        .limit(20)
        .all()
    )

    # Contacted Domains
    connected_domain_activities = (
        db.query(DomainActivity, Domain)
        .join(Domain, DomainActivity.domain_id == Domain.id)
        .filter(DomainActivity.device_id == device_id)
        .order_by(desc(DomainActivity.timestamp))
        .limit(10)
        .all()
    )

    domains_list = []
    seen_domains = set()
    for act, dom in connected_domain_activities:
        if dom.domain_name not in seen_domains:
            seen_domains.add(dom.domain_name)
            domains_list.append({
                "domain_name": dom.domain_name,
                "overall_risk_score": dom.overall_risk_score,
                "risk_level": dom.risk_level,
                "category": dom.category,
                "last_accessed": act.timestamp.isoformat()
            })

    # Block History
    block_history = (
        db.query(BlockedEntity)
        .filter(
            (BlockedEntity.entity_id == device_id) |
            (BlockedEntity.ip_address == device.ip_address)
        )
        .order_by(desc(BlockedEntity.block_start))
        .all()
    )

    return {
        "device": DeviceOut.model_validate(device),
        "recent_events": [
            {
                "id": e.id,
                "timestamp": e.timestamp.isoformat(),
                "traffic_volume": e.traffic_volume,
                "packet_count": e.packet_count,
                "request_frequency": e.request_frequency,
                "protocol": e.protocol,
                "port": e.port,
                "is_suspicious": e.is_suspicious,
                "risk_score": e.risk_score,
                "reasons": e.reasons
            }
            for e in recent_events
        ],
        "recent_alerts": [
            {
                "id": a.id,
                "alert_id": a.alert_id,
                "alert_type": a.alert_type,
                "severity": a.severity,
                "description": a.description,
                "risk_score": a.risk_score,
                "status": a.status,
                "action_taken": a.action_taken,
                "timestamp": a.timestamp.isoformat()
            }
            for a in recent_alerts
        ],
        "risk_history": [
            {
                "score": r.score,
                "level": r.level,
                "reasons": r.reasons_json,
                "timestamp": r.timestamp.isoformat()
            }
            for r in risk_history
        ],
        "connected_domains": domains_list,
        "block_history": [
            {
                "id": b.id,
                "entity_type": b.entity_type,
                "is_temporary": b.is_temporary,
                "reason": b.reason,
                "block_start": b.block_start.isoformat(),
                "expiry_time": b.expiry_time.isoformat() if b.expiry_time else None,
                "is_active": b.is_active
            }
            for b in block_history
        ]
    }

@router.post("/{device_id}/action")
async def execute_device_action(
    device_id: str,
    action_in: DeviceActionRequest,
    db: Session = Depends(get_db)
):
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    action = action_in.action.lower()
    if action == "block":
        blocking_service.block_entity(
            db=db,
            entity_type="device",
            entity_id=device_id,
            reason=action_in.reason or "Operator manually blocked device",
            is_temporary=False,
            triggered_by="manual",
            ip_address=device.ip_address
        )
        device.status = "blocked"
        db.commit()

    elif action == "temp_block":
        blocking_service.block_entity(
            db=db,
            entity_type="device",
            entity_id=device_id,
            reason=action_in.reason or f"Operator temporarily blocked device for {action_in.duration_minutes}m",
            is_temporary=True,
            duration_minutes=action_in.duration_minutes or 15,
            triggered_by="manual",
            ip_address=device.ip_address
        )
        device.status = "temporarily_blocked"
        db.commit()

    elif action == "unblock":
        blocking_service.unblock_entity(
            db=db,
            entity_id=device_id,
            reason=action_in.reason or "Operator manually unblocked device",
            triggered_by="manual"
        )
        device.status = "online"
        db.commit()

    elif action == "monitor":
        device.status = "online"
        db.commit()

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported action: {action}")

    await manager.broadcast("DEVICE_STATUS_CHANGE", {
        "device_id": device_id,
        "status": device.status,
        "action": action
    })

    return {
        "status": "success",
        "device_id": device_id,
        "new_status": device.status,
        "action_applied": action
    }
