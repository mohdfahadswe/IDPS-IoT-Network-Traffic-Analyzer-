from typing import Tuple, Optional
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.models.database_models import Device, Alert
from backend.app.services.blocking_service import blocking_service

class AutoResponseEngine:
    @staticmethod
    def process_policy(
        db: Session,
        device: Device,
        risk_score: float,
        risk_level: str,
        reasons: list,
        source_ip: str
    ) -> Tuple[str, Optional[Alert]]:
        """
        Evaluates automated mitigation response policy according to risk score thresholds.
        Returns:
            action_taken (str): Blocked, Temporarily Blocked, Monitored, Normal
            alert (Alert): Created alert if threshold exceeded
        """
        if not settings.AUTO_RESPONSE_ENABLED:
            action_taken = "Monitoring (Auto-Response Disabled)"
            return action_taken, None

        action_taken = "Normal Monitoring"
        alert_obj = None

        critical_thresh = settings.CRITICAL_RISK_THRESHOLD # >= 81
        high_thresh = settings.HIGH_RISK_THRESHOLD         # >= 61
        medium_thresh = 31.0

        if risk_score >= critical_thresh:
            action_taken = "Automatically Blocked"
            blocking_service.block_entity(
                db=db,
                entity_type="device",
                entity_id=device.device_id,
                reason="; ".join(reasons) or "Risk score exceeded critical threshold",
                is_temporary=False,
                triggered_by="automatic",
                ip_address=source_ip
            )
            device.status = "blocked"
            device.risk_level = "Critical"
            device.risk_score = risk_score
            db.commit()

        elif risk_score >= high_thresh:
            action_taken = "Automatically Temporarily Blocked"
            blocking_service.block_entity(
                db=db,
                entity_type="device",
                entity_id=device.device_id,
                reason="; ".join(reasons) or "Risk score exceeded high threshold",
                is_temporary=True,
                duration_minutes=settings.DEFAULT_TEMP_BLOCK_MINUTES,
                triggered_by="automatic",
                ip_address=source_ip
            )
            device.status = "temporarily_blocked"
            device.risk_level = "High"
            device.risk_score = risk_score
            db.commit()

        elif risk_score >= medium_thresh:
            action_taken = "Alert Generated & Monitored"
            device.status = "suspicious"
            device.risk_level = "Medium"
            device.risk_score = risk_score
            db.commit()
        else:
            if device.status not in ["blocked", "temporarily_blocked"]:
                device.status = "online"
                device.risk_level = "Low"
                device.risk_score = risk_score
                db.commit()

        return action_taken, alert_obj

auto_response_engine = AutoResponseEngine()
