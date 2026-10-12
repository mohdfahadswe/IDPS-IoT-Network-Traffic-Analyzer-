import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database.connection import get_db
from backend.app.models.database_models import Alert, Device, NetworkTraffic

router = APIRouter(prefix="/reports", tags=["Compliance & Forensic Reports"])

@router.get("/export-csv")
def export_csv_report(
    report_type: str = Query("alerts", description="alerts, devices, or traffic"),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """
    100% working CSV exporter for incident response, inventory, or traffic audits.
    """
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    output = io.StringIO()

    if report_type == "alerts":
        writer = csv.writer(output)
        writer.writerow([
            "Alert ID", "Timestamp", "Device ID", "Source IP",
            "Alert Type", "Severity", "Risk Score", "Status", "Action Taken", "Description"
        ])
        alerts = (
            db.query(Alert)
            .filter(Alert.timestamp >= start_date)
            .order_by(desc(Alert.timestamp))
            .all()
        )
        for a in alerts:
            writer.writerow([
                a.alert_id,
                a.timestamp.isoformat() if a.timestamp else "",
                a.device_id or "",
                a.source_ip,
                a.alert_type,
                a.severity,
                a.risk_score,
                a.status,
                a.action_taken,
                a.description
            ])
        filename = f"netpulse_alerts_report_{now.strftime('%Y%m%d_%H%M%S')}.csv"

    elif report_type == "devices":
        writer = csv.writer(output)
        writer.writerow([
            "Device ID", "Name", "Type", "Source", "IP Address", "MAC Address",
            "Status", "Risk Level", "Risk Score", "First Seen", "Last Seen"
        ])
        devices = db.query(Device).order_by(Device.name.asc()).all()
        for d in devices:
            writer.writerow([
                d.device_id,
                d.name,
                d.type,
                d.source,
                d.ip_address,
                d.mac_address or "",
                d.status,
                d.risk_level,
                d.risk_score,
                d.first_seen.isoformat() if d.first_seen else "",
                d.last_seen.isoformat() if d.last_seen else ""
            ])
        filename = f"netpulse_devices_inventory_{now.strftime('%Y%m%d_%H%M%S')}.csv"

    else: # traffic
        writer = csv.writer(output)
        writer.writerow([
            "ID", "Timestamp", "Source IP", "Destination IP", "Protocol",
            "Bytes In", "Bytes Out", "Total Bytes", "Packets", "Is Suspicious"
        ])
        traffic = (
            db.query(NetworkTraffic)
            .filter(NetworkTraffic.timestamp >= start_date)
            .order_by(desc(NetworkTraffic.timestamp))
            .limit(1000)
            .all()
        )
        for t in traffic:
            writer.writerow([
                t.id,
                t.timestamp.isoformat() if t.timestamp else "",
                t.source_ip or "",
                t.destination_ip or "",
                t.protocol,
                t.bytes_in,
                t.bytes_out,
                t.bytes_in + t.bytes_out,
                t.packets_count,
                t.is_suspicious
            ])
        filename = f"netpulse_traffic_log_{now.strftime('%Y%m%d_%H%M%S')}.csv"

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

@router.get("/summary")
def get_reports_summary(days: int = Query(30), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)

    alerts_count = db.query(Alert).filter(Alert.timestamp >= start_date).count()
    devices_count = db.query(Device).count()
    traffic_samples = db.query(NetworkTraffic).filter(NetworkTraffic.timestamp >= start_date).count()

    return {
        "generated_at": now.isoformat(),
        "time_window_days": days,
        "available_reports": [
            {
                "id": "alerts",
                "name": "Security Incidents & Alerts Audit Report",
                "record_count": alerts_count,
                "format": "CSV"
            },
            {
                "id": "devices",
                "name": "Connected Device Inventory & Risk Posture",
                "record_count": devices_count,
                "format": "CSV"
            },
            {
                "id": "traffic",
                "name": "Network Flow & Telemetry Activity Log",
                "record_count": traffic_samples,
                "format": "CSV"
            }
        ]
    }
