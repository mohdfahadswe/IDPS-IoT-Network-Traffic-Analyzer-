from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from backend.app.models.database_models import BlockedEntity, Device, SecurityAction
from backend.app.websocket.connection_manager import manager

class BlockingService:
    @staticmethod
    def is_entity_blocked(db: Session, device_id: Optional[str] = None, ip_address: Optional[str] = None) -> bool:
        """
        Checks if device_id or IP address is currently blocked (active and not expired).
        """
        now = datetime.now(timezone.utc)
        query = db.query(BlockedEntity).filter(BlockedEntity.is_active == True)
        
        conditions = []
        if device_id:
            conditions.append((BlockedEntity.entity_type == "device") & (BlockedEntity.entity_id == device_id))
        if ip_address:
            conditions.append((BlockedEntity.ip_address == ip_address) | ((BlockedEntity.entity_type == "ip") & (BlockedEntity.entity_id == ip_address)))
            
        from sqlalchemy import or_
        if not conditions:
            return False
            
        active_block = query.filter(or_(*conditions)).first()
        if active_block:
            # Check if temporary block has expired
            if active_block.is_temporary and active_block.expiry_time:
                exp = active_block.expiry_time
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                if exp <= now:
                    active_block.is_active = False
                    db.commit()
                    return False
            return True
        return False

    @staticmethod
    def block_entity(
        db: Session,
        entity_type: str, # "device" or "ip"
        entity_id: str,
        reason: str,
        is_temporary: bool = False,
        duration_minutes: Optional[int] = 15,
        triggered_by: str = "manual",
        ip_address: Optional[str] = None
    ) -> BlockedEntity:
        now = datetime.now(timezone.utc)
        expiry_time = now + timedelta(minutes=duration_minutes) if is_temporary else None

        # Resolve IP if device
        if entity_type == "device" and not ip_address:
            dev = db.query(Device).filter(Device.device_id == entity_id).first()
            if dev:
                ip_address = dev.ip_address
                dev.status = "temporarily_blocked" if is_temporary else "blocked"
                db.commit()
        elif entity_type == "ip":
            ip_address = entity_id
            # Also update any devices matching this IP
            devices = db.query(Device).filter(Device.ip_address == ip_address).all()
            for dev in devices:
                dev.status = "temporarily_blocked" if is_temporary else "blocked"
            db.commit()

        # Check existing active block
        existing = db.query(BlockedEntity).filter(
            BlockedEntity.entity_id == entity_id,
            BlockedEntity.is_active == True
        ).first()

        if existing:
            existing.reason = reason
            existing.is_temporary = is_temporary
            existing.expiry_time = expiry_time
            existing.block_start = now
            block_record = existing
        else:
            block_record = BlockedEntity(
                entity_type=entity_type,
                entity_id=entity_id,
                ip_address=ip_address,
                reason=reason,
                is_temporary=is_temporary,
                block_start=now,
                expiry_time=expiry_time,
                is_active=True
            )
            db.add(block_record)

        # Log security action
        action = SecurityAction(
            timestamp=now,
            action_type="Temporary Block" if is_temporary else "Block",
            target_entity=entity_id,
            reason=reason,
            triggered_by=triggered_by,
            details={
                "is_temporary": is_temporary,
                "duration_minutes": duration_minutes,
                "ip_address": ip_address
            }
        )
        db.add(action)
        db.commit()
        db.refresh(block_record)

        return block_record

    @staticmethod
    def unblock_entity(
        db: Session,
        entity_id: str,
        reason: str = "Operator manually unblocked entity",
        triggered_by: str = "manual"
    ) -> bool:
        now = datetime.now(timezone.utc)
        blocks = db.query(BlockedEntity).filter(
            BlockedEntity.entity_id == entity_id,
            BlockedEntity.is_active == True
        ).all()

        if not blocks:
            # Check by IP
            blocks = db.query(BlockedEntity).filter(
                BlockedEntity.ip_address == entity_id,
                BlockedEntity.is_active == True
            ).all()

        if not blocks:
            return False

        for b in blocks:
            b.is_active = False

        # Restore device status if device exists
        dev = db.query(Device).filter(Device.device_id == entity_id).first()
        if dev:
            dev.status = "online"
        else:
            # Check devices by IP
            devs = db.query(Device).filter(Device.ip_address == entity_id).all()
            for d in devs:
                d.status = "online"

        action = SecurityAction(
            timestamp=now,
            action_type="Unblock",
            target_entity=entity_id,
            reason=reason,
            triggered_by=triggered_by,
            details={"unblocked_at": now.isoformat()}
        )
        db.add(action)
        db.commit()
        return True

    @staticmethod
    async def check_and_expire_temporary_blocks(db: Session) -> List[str]:
        """
        Background periodic worker to unblock expired temporary blocks.
        """
        now = datetime.now(timezone.utc)
        active_temporary = db.query(BlockedEntity).filter(
            BlockedEntity.is_active == True,
            BlockedEntity.is_temporary == True
        ).all()

        expired_blocks = []
        for b in active_temporary:
            if b.expiry_time:
                exp = b.expiry_time
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                if exp <= now:
                    expired_blocks.append(b)

        expired_ids = []
        for b in expired_blocks:
            b.is_active = False
            expired_ids.append(b.entity_id)
            # Restore associated device status
            if b.entity_type == "device":
                dev = db.query(Device).filter(Device.device_id == b.entity_id).first()
                if dev:
                    dev.status = "online"
            elif b.ip_address:
                devs = db.query(Device).filter(Device.ip_address == b.ip_address).all()
                for d in devs:
                    d.status = "online"

            action = SecurityAction(
                timestamp=now,
                action_type="Auto Unblock (Expired)",
                target_entity=b.entity_id,
                reason="Temporary block period elapsed",
                triggered_by="automatic",
                details={"expired_at": now.isoformat()}
            )
            db.add(action)

        if expired_blocks:
            db.commit()
            # Broadcast unblock update across WebSockets
            await manager.broadcast("BLOCK_EXPIRED", {
                "expired_entities": expired_ids,
                "timestamp": now.isoformat()
            })

        return expired_ids

blocking_service = BlockingService()
