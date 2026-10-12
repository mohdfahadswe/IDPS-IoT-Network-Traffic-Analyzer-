from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.app.database.connection import get_db
from backend.app.models.database_models import (
    Device, DeviceEvent, Alert, Domain, BlockedEntity, NetworkTraffic
)

router = APIRouter(prefix="/analytics", tags=["Analytics & Reporting Intelligence"])

@router.get("")
def get_analytics_overview(days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)

    from backend.app.simulation.simulation_engine import simulation_engine

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
            if (now - rd_dt).total_seconds() > 45:
                rd.status = "offline"
    db.commit()

    # 3. Total KPI counters
    total_devices = db.query(Device).count()
    active_devices = db.query(Device).filter(Device.status.in_(["online", "suspicious"])).count()
    total_alerts = db.query(Alert).filter(Alert.timestamp >= start_date).count()
    active_blocks = db.query(BlockedEntity).filter(BlockedEntity.is_active == True).count()

    # Network volume in window
    traffic_sum = db.query(
        func.sum(NetworkTraffic.bytes_in + NetworkTraffic.bytes_out)
    ).filter(NetworkTraffic.timestamp >= start_date).scalar() or 0

    # Average fleet risk
    avg_risk = db.query(func.avg(Device.risk_score)).scalar() or 0.0

    # 2. Alert Severity Distribution
    severity_counts = (
        db.query(Alert.severity, func.count(Alert.id))
        .filter(Alert.timestamp >= start_date)
        .group_by(Alert.severity)
        .all()
    )
    severity_dist = {sev: count for sev, count in severity_counts}
    for s in ["Low", "Medium", "High", "Critical"]:
        severity_dist.setdefault(s, 0)

    # 3. Threat Categories Breakdown (from real alerts)
    alert_type_counts = (
        db.query(Alert.alert_type, func.count(Alert.id))
        .filter(Alert.timestamp >= start_date)
        .group_by(Alert.alert_type)
        .order_by(desc(func.count(Alert.id)))
        .all()
    )
    threat_types = [
        {"name": at, "count": cnt} for at, cnt in alert_type_counts
    ]

    # 4. Protocol Traffic Distribution
    protocol_counts = (
        db.query(
            NetworkTraffic.protocol,
            func.count(NetworkTraffic.id),
            func.sum(NetworkTraffic.bytes_in + NetworkTraffic.bytes_out)
        )
        .filter(NetworkTraffic.timestamp >= start_date)
        .group_by(NetworkTraffic.protocol)
        .all()
    )
    protocols_dist = [
        {
            "protocol": p or "TCP",
            "count": c,
            "bytes": int(b or 0)
        }
        for p, c, b in protocol_counts
    ]

    # 5. Daily / Hourly Threat Trends with accurate real-time timestamps
    daily_trends = []
    if days == 1:
        # 24-hour hourly distribution (8 intervals of 3 hours)
        for i in range(7, -1, -1):
            slice_start = now - timedelta(hours=(i + 1) * 3)
            slice_end = now - timedelta(hours=i * 3)

            alerts_count = db.query(Alert).filter(Alert.timestamp >= slice_start, Alert.timestamp < slice_end).count()
            critical_count = db.query(Alert).filter(
                Alert.timestamp >= slice_start,
                Alert.timestamp < slice_end,
                Alert.severity.in_(["High", "Critical"])
            ).count()
            vol = db.query(func.sum(NetworkTraffic.bytes_in + NetworkTraffic.bytes_out)).filter(
                NetworkTraffic.timestamp >= slice_start, NetworkTraffic.timestamp < slice_end
            ).scalar() or 0

            time_str = slice_end.strftime("%H:%M")
            daily_trends.append({
                "date": time_str,
                "timestamp": slice_end.isoformat(),
                "total_threats": alerts_count,
                "critical_threats": critical_count,
                "traffic_kb": round(vol / 1024, 1)
            })
    else:
        # Day-by-day distribution
        for i in range(days - 1, -1, -1):
            day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)

            alerts_count = db.query(Alert).filter(Alert.timestamp >= day_start, Alert.timestamp < day_end).count()
            critical_count = db.query(Alert).filter(
                Alert.timestamp >= day_start,
                Alert.timestamp < day_end,
                Alert.severity.in_(["High", "Critical"])
            ).count()
            vol = db.query(func.sum(NetworkTraffic.bytes_in + NetworkTraffic.bytes_out)).filter(
                NetworkTraffic.timestamp >= day_start, NetworkTraffic.timestamp < day_end
            ).scalar() or 0

            daily_trends.append({
                "date": day_start.strftime("%b %d"),
                "timestamp": day_start.isoformat(),
                "total_threats": alerts_count,
                "critical_threats": critical_count,
                "traffic_kb": round(vol / 1024, 1)
            })

    # 6. Most Suspicious Devices
    suspicious_devices = (
        db.query(Device)
        .order_by(desc(Device.risk_score))
        .limit(6)
        .all()
    )

    # 7. Highest-Risk External Domains
    top_risk_domains = (
        db.query(Domain)
        .order_by(desc(Domain.overall_risk_score))
        .limit(6)
        .all()
    )

    # 8. Device Type Distribution
    type_counts = (
        db.query(Device.type, func.count(Device.id))
        .group_by(Device.type)
        .all()
    )
    type_dist = [{"type": t, "count": c} for t, c in type_counts]

    return {
        "kpis": {
            "total_devices": total_devices,
            "active_devices": active_devices,
            "threats_detected": total_alerts,
            "blocked_entities": active_blocks,
            "total_traffic_bytes": int(traffic_sum),
            "avg_fleet_risk": round(float(avg_risk), 1)
        },
        "severity_distribution": severity_dist,
        "threat_types": threat_types,
        "protocols": protocols_dist,
        "daily_trends": daily_trends,
        "suspicious_devices": [
            {
                "device_id": d.device_id,
                "name": d.name,
                "type": d.type,
                "ip_address": d.ip_address,
                "risk_score": d.risk_score,
                "risk_level": d.risk_level,
                "status": d.status,
                "last_seen": (d.last_seen.replace(tzinfo=timezone.utc) if d.last_seen and d.last_seen.tzinfo is None else d.last_seen).isoformat() if d.last_seen else None
            }
            for d in suspicious_devices
        ],
        "top_risk_domains": [
            {
                "domain_name": dom.domain_name,
                "category": dom.category,
                "risk_score": dom.overall_risk_score,
                "risk_level": dom.risk_level,
                "request_count": dom.request_count,
                "last_seen": (dom.last_seen.replace(tzinfo=timezone.utc) if dom.last_seen and dom.last_seen.tzinfo is None else dom.last_seen).isoformat() if dom.last_seen else None
            }
            for dom in top_risk_domains
        ],
        "device_types": type_dist,
        "meta": {
            "current_time": now.isoformat(),
            "time_window": f"Last {days} Days" if days > 1 else "Last 24 Hours",
            "start_time": start_date.isoformat(),
            "end_time": now.isoformat()
        }
    }
