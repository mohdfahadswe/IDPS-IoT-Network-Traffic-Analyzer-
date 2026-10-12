from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database.connection import get_db
from backend.app.schemas.api_schemas import DeviceEventCreate, DeviceEventResponse
from backend.app.services.device_service import device_service

router = APIRouter(tags=["Device Events & Health"])

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint for ESP32 and system monitoring.
    ESP32 verifies backend availability before event dispatch.
    """
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.post("/device-events", response_model=DeviceEventResponse)
async def receive_device_events(
    event_in: DeviceEventCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Mandatory ingestion endpoint for ESP32 and IoT devices.
    Receives JSON telemetry, executes feature extraction,
    Random Forest classification, risk scoring, automated response,
    alert creation, and real-time WebSocket broadcast.
    """
    client_ip = request.client.host if request.client else "192.168.1.150"
    result = await device_service.process_device_event(
        db=db,
        event_in=event_in,
        client_ip=client_ip
    )
    return result
