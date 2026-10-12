from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc

from backend.app.database.connection import get_db
from backend.app.models.database_models import Alert, Device
from backend.app.schemas.api_schemas import AlertOut, AlertUpdate

router = APIRouter(prefix="/alerts", tags=["Alert Center"])

@router.get("", response_model=dict)
def list_alerts(
    search: Optional[str] = Query(None, description="Search by alert ID, type, IP, or device"),
    severity: Optional[str] = Query(None, description="Filter by severity: Low, Medium, High, Critical"),
    status: Optional[str] = Query(None, description="Filter by status: New, Acknowledged, Resolved"),
    page: int = Query(1, ge=1),
    limit: int = Query(15, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(Alert).outerjoin(Alert.device)

    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (Alert.alert_id.ilike(search_fmt)) |
            (Alert.alert_type.ilike(search_fmt)) |
            (Alert.source_ip.ilike(search_fmt)) |
            (Alert.device_id.ilike(search_fmt)) |
            (Alert.description.ilike(search_fmt)) |
            (Device.name.ilike(search_fmt))
        )

    if severity and severity != "all":
        query = query.filter(Alert.severity == severity)

    if status and status != "all":
        query = query.filter(Alert.status == status)

    total = query.count()
    alerts = query.options(joinedload(Alert.device)).order_by(desc(Alert.timestamp)).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "alerts": [AlertOut.model_validate(a) for a in alerts]
    }

@router.get("/{alert_id}", response_model=AlertOut)
def get_alert_detail(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(Alert).options(joinedload(Alert.device)).filter((Alert.alert_id == alert_id) | (Alert.id == int(alert_id) if alert_id.isdigit() else False)).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertOut.model_validate(alert)

@router.patch("/{alert_id}")
def update_alert_status(alert_id: str, update_in: AlertUpdate, db: Session = Depends(get_db)):
    alert = db.query(Alert).options(joinedload(Alert.device)).filter((Alert.alert_id == alert_id) | (Alert.id == int(alert_id) if alert_id.isdigit() else False)).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = update_in.status
    db.commit()
    db.refresh(alert)
    return AlertOut.model_validate(alert)

