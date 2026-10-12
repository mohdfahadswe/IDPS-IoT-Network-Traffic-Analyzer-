from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database.connection import get_db
from backend.app.models.database_models import Domain, DomainActivity
from backend.app.schemas.api_schemas import DomainOut

router = APIRouter(prefix="/domains", tags=["Domain Intelligence & Risk Analysis"])

@router.get("", response_model=List[DomainOut])
def list_domains(
    risk_level: Optional[str] = Query(None, description="Filter by Low, Medium, High, Critical"),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Domain)
    if risk_level and risk_level != "all":
        query = query.filter(Domain.risk_level == risk_level)
    if category and category != "all":
        query = query.filter(Domain.category == category)

    domains = query.order_by(desc(Domain.overall_risk_score)).all()

    results = []
    for d in domains:
        # Collect distinct connected device IDs
        device_ids = [
            r[0] for r in (
                db.query(DomainActivity.device_id)
                .filter(DomainActivity.domain_id == d.id)
                .distinct()
                .all()
            )
        ]
        dom_out = DomainOut(
            id=d.id,
            domain_name=d.domain_name,
            overall_risk_score=d.overall_risk_score,
            risk_level=d.risk_level,
            category=d.category,
            request_count=d.request_count,
            risk_explanation=d.risk_explanation,
            first_seen=d.first_seen,
            last_seen=d.last_seen,
            connected_devices=device_ids
        )
        results.append(dom_out)

    return results

@router.get("/{domain_name}")
def get_domain_detail(domain_name: str, db: Session = Depends(get_db)):
    domain = db.query(Domain).filter(Domain.domain_name == domain_name).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    activities = (
        db.query(DomainActivity)
        .filter(DomainActivity.domain_id == domain.id)
        .order_by(desc(DomainActivity.timestamp))
        .limit(25)
        .all()
    )

    return {
        "domain": DomainOut.from_orm(domain),
        "activities": [
            {
                "id": a.id,
                "device_id": a.device_id,
                "port": a.port,
                "timestamp": a.timestamp.isoformat(),
                "risk_contribution": a.risk_contribution
            }
            for a in activities
        ]
    }
