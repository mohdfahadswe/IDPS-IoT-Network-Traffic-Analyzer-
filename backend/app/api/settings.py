from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database.connection import get_db
from backend.app.models.database_models import SystemSettings
from backend.app.schemas.api_schemas import SettingsUpdate
from backend.app.simulation.simulation_engine import simulation_engine
from backend.app.websocket.connection_manager import manager

router = APIRouter(prefix="/settings", tags=["System Settings & Policy Configuration"])

@router.get("")
def get_settings(db: Session = Depends(get_db)):
    db_settings = db.query(SystemSettings).all()
    settings_dict = {s.key: s.value for s in db_settings}

    return {
        "general": {
            "platform_name": settings_dict.get("platform_name", settings.PROJECT_NAME),
            "analyst_email": settings_dict.get("analyst_email", "security-ops@netpulse-iot.local"),
            "timezone": "UTC (Coordinated Universal Time)",
            "version": "2.4.0-Enterprise"
        },
        "detection": {
            "traffic_threshold_bytes": int(settings_dict.get("traffic_threshold_bytes", 25000)),
            "detection_sensitivity": settings_dict.get("detection_sensitivity", "High"),
            "rf_confidence_threshold": float(settings_dict.get("rf_confidence_threshold", 0.50))
        },
        "automatic_response": {
            "enabled": settings_dict.get("auto_response_enabled", str(settings.AUTO_RESPONSE_ENABLED)).lower() == "true",
            "high_risk_threshold": int(settings_dict.get("high_risk_threshold", settings.HIGH_RISK_THRESHOLD)),
            "critical_risk_threshold": int(settings_dict.get("critical_risk_threshold", settings.CRITICAL_RISK_THRESHOLD)),
            "default_temp_block_minutes": int(settings_dict.get("default_temp_block_minutes", settings.DEFAULT_TEMP_BLOCK_MINUTES))
        },
        "simulation": {
            "speed": simulation_engine.speed,
            "device_count": len(simulation_engine.devices),
            "is_running": simulation_engine.is_running
        }
    }

@router.post("")
@router.put("")
async def update_settings(update_data: SettingsUpdate, db: Session = Depends(get_db)):
    def upsert(k: str, v: str):
        item = db.query(SystemSettings).filter(SystemSettings.key == k).first()
        if item:
            item.value = str(v)
        else:
            db.add(SystemSettings(key=k, value=str(v)))

    if update_data.platform_name is not None:
        upsert("platform_name", update_data.platform_name)
    if update_data.analyst_email is not None:
        upsert("analyst_email", update_data.analyst_email)
    if update_data.traffic_threshold_bytes is not None:
        upsert("traffic_threshold_bytes", str(update_data.traffic_threshold_bytes))
    if update_data.detection_sensitivity is not None:
        upsert("detection_sensitivity", update_data.detection_sensitivity)
    if update_data.auto_response_enabled is not None:
        upsert("auto_response_enabled", str(update_data.auto_response_enabled))
        settings.AUTO_RESPONSE_ENABLED = update_data.auto_response_enabled
    if update_data.high_risk_threshold is not None:
        upsert("high_risk_threshold", str(update_data.high_risk_threshold))
        settings.HIGH_RISK_THRESHOLD = update_data.high_risk_threshold
    if update_data.critical_risk_threshold is not None:
        upsert("critical_risk_threshold", str(update_data.critical_risk_threshold))
        settings.CRITICAL_RISK_THRESHOLD = update_data.critical_risk_threshold
    if update_data.default_temp_block_minutes is not None:
        upsert("default_temp_block_minutes", str(update_data.default_temp_block_minutes))
        settings.DEFAULT_TEMP_BLOCK_MINUTES = update_data.default_temp_block_minutes
    if update_data.simulation_speed is not None:
        simulation_engine.speed = update_data.simulation_speed
        upsert("simulation_speed", update_data.simulation_speed)
        await manager.broadcast("SIMULATION_STATUS", {"is_running": simulation_engine.is_running, "speed": simulation_engine.speed})

    db.commit()
    return {"status": "success", "message": "System policies updated successfully"}

@router.post("/reset-defaults")
async def reset_settings_defaults(db: Session = Depends(get_db)):
    defaults = {
        "platform_name": "NetPulse IoT Security Platform",
        "analyst_email": "security-ops@netpulse-iot.local",
        "traffic_threshold_bytes": "25000",
        "detection_sensitivity": "High",
        "auto_response_enabled": "True",
        "high_risk_threshold": "61",
        "critical_risk_threshold": "81",
        "default_temp_block_minutes": "15",
        "simulation_speed": "normal"
    }

    for k, v in defaults.items():
        item = db.query(SystemSettings).filter(SystemSettings.key == k).first()
        if item:
            item.value = v
        else:
            db.add(SystemSettings(key=k, value=v))

    settings.AUTO_RESPONSE_ENABLED = True
    settings.HIGH_RISK_THRESHOLD = 61.0
    settings.CRITICAL_RISK_THRESHOLD = 81.0
    settings.DEFAULT_TEMP_BLOCK_MINUTES = 15
    simulation_engine.speed = "normal"

    db.commit()
    await manager.broadcast("SIMULATION_STATUS", {"is_running": simulation_engine.is_running, "speed": "normal"})
    return {"status": "success", "message": "Factory default security policies restored"}
