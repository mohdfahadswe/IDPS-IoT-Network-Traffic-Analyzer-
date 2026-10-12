import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session

from backend.app.models.database_models import Device, DeviceEvent, Alert, NetworkTraffic, RiskScoreRecord
from backend.app.schemas.api_schemas import DeviceEventCreate
from backend.app.ml.feature_extractor import extract_features_from_event
from backend.app.ml.model_service import ModelService
from backend.app.ml.risk_engine import risk_engine
from backend.app.analytics.domain_analyzer import analyze_and_record_domain
from backend.app.services.auto_response import auto_response_engine
from backend.app.services.blocking_service import blocking_service
from backend.app.websocket.connection_manager import manager

class DeviceService:
    @staticmethod
    def get_or_register_device(
        db: Session,
        device_id: str,
        name: str = None,
        device_type: str = "ESP32",
        ip_address: str = "192.168.1.150",
        mac_address: str = None,
        source: str = "real"
    ) -> Device:
        """
        Retrieves an existing device or auto-registers a new IoT node.
        """
        device = db.query(Device).filter(Device.device_id == device_id).first()
        now = datetime.now(timezone.utc)

        if not device:
            if not mac_address:
                # Generate pseudo-MAC based on device_id for clean presentation
                clean_id = device_id.replace("-", "").lower()[:12].ljust(12, '0')
                mac_address = ":".join(clean_id[i:i+2] for i in range(0, 12, 2))

            device = Device(
                device_id=device_id,
                name=name or f"Node {device_id}",
                type=device_type or "ESP32",
                ip_address=ip_address or "192.168.1.150",
                mac_address=mac_address,
                status="online",
                risk_level="Low",
                risk_score=5.0,
                source=source,
                sensor_type="DHT11/Telemetry" if "esp" in device_id.lower() or device_type == "ESP32" else "Telemetry",
                first_seen=now,
                last_seen=now
            )
            db.add(device)
            db.commit()
            db.refresh(device)
        else:
            device.last_seen = now
            if device.status == "offline":
                device.status = "online"
            if source:
                device.source = source
            if name:
                device.name = name
            if ip_address:
                device.ip_address = ip_address
            if mac_address:
                device.mac_address = mac_address
            db.commit()

        return device

    @staticmethod
    async def process_device_event(
        db: Session,
        event_in: DeviceEventCreate,
        client_ip: str = "192.168.1.150"
    ) -> Dict[str, Any]:
        """
        Full processing pipeline:
        1. Auto-register/update device
        2. Check blocking state
        3. Feature extraction
        4. Random Forest classification
        5. Risk scoring (0-100) + explainable reasons
        6. Domain analysis
        7. Automated response policy
        8. Alert generation
        9. Database persist & WebSocket broadcast
        """
        now = datetime.now(timezone.utc)
        device_id = event_in.device_id
        source_ip = event_in.ip_address or client_ip

        # 1. Device registration/retrieval
        is_real_esp = (
            (device_id.lower().startswith("esp32") or "physical" in device_id.lower()) 
            and not device_id.startswith("sim-")
        )
        source_type = "real" if is_real_esp else "simulated"
        device = DeviceService.get_or_register_device(
            db=db,
            device_id=device_id,
            name=event_in.device_name,
            device_type=event_in.device_type or "ESP32",
            ip_address=source_ip,
            mac_address=event_in.mac_address,
            source=source_type
        )

        # Track initial status before processing
        old_status = device.status

        # Update sensor data if present
        if event_in.sensor_data:
            device.latest_sensor_data = event_in.sensor_data
            db.commit()

        # 2. Check if currently blocked
        is_blocked = blocking_service.is_entity_blocked(db=db, device_id=device_id, ip_address=source_ip)
        if is_blocked:
            traffic_sample = NetworkTraffic(
                timestamp=now,
                bytes_in=int((event_in.traffic_volume or 1000) * 0.7),
                bytes_out=int((event_in.traffic_volume or 1000) * 0.3),
                packets_count=event_in.packet_count or 5,
                is_suspicious=True,
                source_ip=source_ip,
                destination_ip="192.168.1.1",
                protocol=str(event_in.protocol or "TCP")
            )
            db.add(traffic_sample)
            db.commit()

            event_payload = {
                "device_id": device_id,
                "device_name": device.name,
                "source_ip": source_ip,
                "source": device.source,
                "status": "blocked",
                "risk_score": 100.0,
                "risk_level": "Critical",
                "traffic_volume": event_in.traffic_volume or 1000,
                "packet_count": event_in.packet_count or 5,
                "protocol": str(event_in.protocol or "TCP"),
                "destination_port": event_in.destination_port or 80,
                "action_taken": "Traffic Dropped (Entity Blocked)",
                "is_suspicious": True,
                "sensor_data": device.latest_sensor_data,
                "timestamp": now.isoformat()
            }
            await manager.broadcast("DEVICE_EVENT", event_payload)

            return {
                "status": "blocked",
                "device_id": device_id,
                "classification": "Suspicious",
                "risk_score": 100.0,
                "risk_level": "Critical",
                "action_taken": "Traffic Dropped (Entity Blocked)",
                "reasons": ["Entity is actively blocked by security policy"]
            }

        # 3. Query historical alerts
        historical_alerts_count = db.query(Alert).filter(Alert.device_id == device_id).count()

        # 4. Feature Extraction
        raw_dict = event_in.model_dump()
        features = extract_features_from_event(
            event_data=raw_dict,
            historical_alerts_count=historical_alerts_count,
            recent_events_count_in_min=3
        )

        # 5. Random Forest Classification
        model_service = ModelService.get_instance()
        rf_is_suspicious, rf_confidence, rf_reasons = model_service.predict(features)

        # 6. Domain Analysis
        domain_name = event_in.domain_contacted
        domain_risk = 0.0
        if domain_name:
            domain_record, domain_risk = analyze_and_record_domain(
                db=db,
                domain_name=domain_name,
                device_id=device_id,
                device_risk_score=device.risk_score or 0.0,
                port=features.get("destination_port", 80)
            )

        # 7. Multi-Factor Risk Scoring
        risk_score, risk_level, reasons = risk_engine.calculate_risk(
            rf_is_suspicious=rf_is_suspicious,
            rf_confidence=rf_confidence,
            features=features,
            domain_risk=domain_risk,
            rf_reasons=rf_reasons
        )

        # 8. Record Risk Score History
        risk_record = RiskScoreRecord(
            device_id=device_id,
            score=risk_score,
            level=risk_level,
            reasons_json=reasons,
            timestamp=now
        )
        db.add(risk_record)

        # 9. Automated Response Policy
        action_taken, _ = auto_response_engine.process_policy(
            db=db,
            device=device,
            risk_score=risk_score,
            risk_level=risk_level,
            reasons=reasons,
            source_ip=source_ip
        )

        # 10. Generate Alert if Suspicious or Risk >= 31
        alert_obj = None
        if rf_is_suspicious or risk_score >= 31.0:
            alert_id = f"ALT-{uuid.uuid4().hex[:8].upper()}"
            alert_type = (
                "Unusual Traffic Pattern" if features["traffic_volume"] > 10000
                else "Port Scan Detection" if features["failed_connections"] >= 5
                else "High Request Frequency" if features["request_frequency"] > 5.0
                else "Suspicious Domain Communication" if domain_risk > 60.0
                else "Abnormal Telemetry Deviation"
            )

            severity = "Critical" if risk_score >= 81 else "High" if risk_score >= 61 else "Medium"

            alert_obj = Alert(
                alert_id=alert_id,
                timestamp=now,
                device_id=device_id,
                source_ip=source_ip,
                alert_type=alert_type,
                severity=severity,
                description=f"Device {device_id} triggered {alert_type}. Reasons: {'; '.join(reasons)}",
                risk_score=risk_score,
                status="New",
                action_taken=action_taken
            )
            db.add(alert_obj)

        # 11. Save Device Event
        event_record = DeviceEvent(
            device_id=device_id,
            traffic_volume=features["traffic_volume"],
            packet_count=features["packet_count"],
            request_frequency=features["request_frequency"],
            connection_frequency=features["connection_frequency"],
            failed_connections=features["failed_connections"],
            protocol=str(event_in.protocol or "TCP"),
            port=features["destination_port"],
            is_suspicious=rf_is_suspicious,
            risk_score=risk_score,
            reasons=reasons,
            raw_payload=raw_dict,
            timestamp=now
        )
        db.add(event_record)

        # 12. Record Network Traffic Sample
        traffic_sample = NetworkTraffic(
            timestamp=now,
            bytes_in=int(features["traffic_volume"] * 0.7),
            bytes_out=int(features["traffic_volume"] * 0.3),
            packets_count=features["packet_count"],
            is_suspicious=rf_is_suspicious,
            source_ip=source_ip,
            destination_ip="192.168.1.1",
            protocol=str(event_in.protocol or "TCP")
        )
        db.add(traffic_sample)

        db.commit()

        # 13. Real-Time WebSocket Broadcasts
        event_payload = {
            "device_id": device_id,
            "device_name": device.name,
            "source_ip": source_ip,
            "source": device.source,
            "status": device.status,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "traffic_volume": features["traffic_volume"],
            "packet_count": features["packet_count"],
            "protocol": str(event_in.protocol or "TCP"),
            "destination_port": features["destination_port"],
            "action_taken": action_taken,
            "is_suspicious": rf_is_suspicious,
            "sensor_data": device.latest_sensor_data,
            "timestamp": now.isoformat()
        }
        await manager.broadcast("DEVICE_EVENT", event_payload)
        if device.status != old_status:
            await manager.broadcast("DEVICE_STATUS_CHANGE", {
                "device_id": device_id,
                "status": device.status,
                "timestamp": now.isoformat()
            })

        if alert_obj:
            await manager.broadcast("NEW_ALERT", {
                "id": alert_obj.id,
                "alert_id": alert_obj.alert_id,
                "device_id": alert_obj.device_id,
                "device_name": device.name,
                "source_ip": alert_obj.source_ip,
                "alert_type": alert_obj.alert_type,
                "severity": alert_obj.severity,
                "description": alert_obj.description,
                "risk_score": alert_obj.risk_score,
                "status": alert_obj.status,
                "action_taken": alert_obj.action_taken,
                "timestamp": now.isoformat()
            })

        return {
            "status": "success",
            "device_id": device_id,
            "classification": "Suspicious" if rf_is_suspicious else "Normal",
            "risk_score": risk_score,
            "risk_level": risk_level,
            "action_taken": action_taken,
            "reasons": reasons
        }

device_service = DeviceService()
