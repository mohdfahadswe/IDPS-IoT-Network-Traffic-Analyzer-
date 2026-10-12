from datetime import datetime, timezone
from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session
from backend.app.models.database_models import Domain, DomainActivity

KNOWN_SUSPICIOUS_DOMAINS = {
    "malicious-c2-server.ru": {"category": "Command & Control", "base_risk": 88.0, "reason": "Known malicious dynamic DNS C2 endpoint signature"},
    "cryptominer-pool.xyz": {"category": "Cryptomining Pool", "base_risk": 82.0, "reason": "Associated with unauthorized Stratum mining traffic"},
    "iot-exploit-payloads.top": {"category": "Exploit Delivery", "base_risk": 94.0, "reason": "Domain identified hosting Mirai/Gafgyt payload binaries"},
    "suspicious-telemetry.cc": {"category": "Data Exfiltration", "base_risk": 75.0, "reason": "High entropy unregistered telemetry collection endpoint"},
    "unknown-peer-relay.net": {"category": "Untrusted Relay", "base_risk": 65.0, "reason": "Repeated anomalous connection attempts from unauthorized IoT node"}
}

DEFAULT_LEGITIMATE_DOMAINS = {
    "pool.ntp.org": {"category": "Network Time Service", "base_risk": 5.0, "reason": "Legitimate Network Time Protocol synchronization endpoint"},
    "time.google.com": {"category": "Network Time Service", "base_risk": 5.0, "reason": "Standard trusted time server"},
    "api.weatherapi.com": {"category": "Weather Telemetry", "base_risk": 12.0, "reason": "Standard third-party weather API service"},
    "mqtt.netpulse-iot.local": {"category": "Local Broker", "base_risk": 8.0, "reason": "Internal IoT message broker gateway"},
    "updates.espressif.com": {"category": "Firmware Updates", "base_risk": 10.0, "reason": "Espressif official firmware repository"}
}

def analyze_and_record_domain(
    db: Session,
    domain_name: str,
    device_id: str,
    device_risk_score: float = 0.0,
    port: int = 443
) -> Tuple[Domain, float]:
    """
    Analyzes contacted domain, calculates dynamic radial risk score,
    and maintains database record with transparent explanations.
    """
    if not domain_name:
        domain_name = "local-broker.lan"

    domain_record = db.query(Domain).filter(Domain.domain_name == domain_name).first()
    now = datetime.now(timezone.utc)

    if not domain_record:
        # Determine baseline attributes
        if domain_name in KNOWN_SUSPICIOUS_DOMAINS:
            meta = KNOWN_SUSPICIOUS_DOMAINS[domain_name]
            category = meta["category"]
            base_risk = meta["base_risk"]
            explanation = meta["reason"]
        elif domain_name in DEFAULT_LEGITIMATE_DOMAINS:
            meta = DEFAULT_LEGITIMATE_DOMAINS[domain_name]
            category = meta["category"]
            base_risk = meta["base_risk"]
            explanation = meta["reason"]
        else:
            # Check TLD or entropy
            if any(domain_name.endswith(tld) for tld in [".top", ".xyz", ".cc", ".ru", ".tk"]):
                category = "Suspicious TLD"
                base_risk = 68.0
                explanation = "Domain registered under high-abuse top-level domain without validated reputation"
            else:
                category = "External Web Service"
                base_risk = 25.0
                explanation = "Uncategorized external domain contacted by IoT device"

        # Calculate initial risk score
        risk_score = base_risk
        if device_risk_score > 60.0:
            risk_score = min(100.0, risk_score + 15.0)
            explanation += f" High risk was assigned because this domain was contacted frequently during suspicious network activity (device risk {device_risk_score:.0f})."

        risk_level = "Critical" if risk_score >= 81 else "High" if risk_score >= 61 else "Medium" if risk_score >= 31 else "Low"

        domain_record = Domain(
            domain_name=domain_name,
            overall_risk_score=round(risk_score, 1),
            risk_level=risk_level,
            category=category,
            request_count=1,
            risk_explanation=explanation,
            first_seen=now,
            last_seen=now
        )
        db.add(domain_record)
        db.commit()
        db.refresh(domain_record)
    else:
        # Update activity count and dynamic risk adjustment
        domain_record.request_count += 1
        domain_record.last_seen = now
        
        # Velocity-based risk penalty if contacted by high risk device
        if device_risk_score > 60.0 and domain_record.overall_risk_score < 90.0:
            domain_record.overall_risk_score = min(100.0, domain_record.overall_risk_score + 5.0)
            domain_record.risk_explanation = f"Risk increased because this domain was contacted during high-risk telemetry spikes by {device_id}."
        
        score = domain_record.overall_risk_score
        domain_record.risk_level = "Critical" if score >= 81 else "High" if score >= 61 else "Medium" if score >= 31 else "Low"
        db.commit()

    # Log domain activity
    activity = DomainActivity(
        domain_id=domain_record.id,
        device_id=device_id,
        timestamp=now,
        port=port,
        risk_contribution=domain_record.overall_risk_score
    )
    db.add(activity)
    db.commit()

    return domain_record, domain_record.overall_risk_score
