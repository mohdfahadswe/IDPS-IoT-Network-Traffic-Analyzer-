import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database.connection import Base, engine, SessionLocal
from backend.app.models.database_models import User, Device, Domain, SystemSettings, NetworkTraffic, Alert
from backend.app.security.auth_handler import hash_password

logger = logging.getLogger(__name__)

INITIAL_DEVICES = [
    {
        "device_id": "sim-temp-01",
        "name": "HVAC Smart Temp Sensor",
        "type": "Smart Sensor",
        "ip_address": "192.168.1.101",
        "mac_address": "AA:BB:CC:11:22:01",
        "status": "online",
        "risk_level": "Low",
        "risk_score": 8.5,
        "source": "simulated",
        "sensor_type": "Temperature & Humidity",
        "latest_sensor_data": {"temperature": 22.8, "humidity": 48.2}
    },
    {
        "device_id": "sim-cam-02",
        "name": "Entrance Security Camera",
        "type": "Smart Camera",
        "ip_address": "192.168.1.102",
        "mac_address": "AA:BB:CC:11:22:02",
        "status": "online",
        "risk_level": "Low",
        "risk_score": 14.0,
        "source": "simulated",
        "sensor_type": "Video Feed",
        "latest_sensor_data": {"fps": 30, "bitrate_kbps": 2048}
    },
    {
        "device_id": "sim-light-03",
        "name": "Conference Smart Light",
        "type": "Smart Light",
        "ip_address": "192.168.1.103",
        "mac_address": "AA:BB:CC:11:22:03",
        "status": "online",
        "risk_level": "Low",
        "risk_score": 5.0,
        "source": "simulated",
        "sensor_type": "Luminance",
        "latest_sensor_data": {"lux": 450, "power_state": "ON"}
    },
    {
        "device_id": "sim-plug-04",
        "name": "Server Rack Smart Plug",
        "type": "Smart Plug",
        "ip_address": "192.168.1.104",
        "mac_address": "AA:BB:CC:11:22:04",
        "status": "online",
        "risk_level": "Low",
        "risk_score": 9.2,
        "source": "simulated",
        "sensor_type": "Power Draw",
        "latest_sensor_data": {"watts": 128.5, "voltage": 220.4}
    },
    {
        "device_id": "sim-env-05",
        "name": "Environmental Air Quality Monitor",
        "type": "Air Quality Sensor",
        "ip_address": "192.168.1.105",
        "mac_address": "AA:BB:CC:11:22:05",
        "status": "online",
        "risk_level": "Low",
        "risk_score": 6.5,
        "source": "simulated",
        "sensor_type": "Environmental & Gas Telemetry",
        "latest_sensor_data": {"aqi": 34, "co2_ppm": 412, "voc_ppb": 85}
    },
    {
        "device_id": "sim-gw-06",
        "name": "Industrial IoT Edge Gateway",
        "type": "Edge Gateway",
        "ip_address": "192.168.1.106",
        "mac_address": "AA:BB:CC:11:22:06",
        "status": "online",
        "risk_level": "Low",
        "risk_score": 11.0,
        "source": "simulated",
        "sensor_type": "Modbus Telemetry",
        "latest_sensor_data": {"active_nodes": 6, "throughput_pps": 42}
    }
]

INITIAL_DOMAINS = [
    {
        "domain_name": "pool.ntp.org",
        "overall_risk_score": 5.0,
        "risk_level": "Low",
        "category": "Network Time Service",
        "request_count": 342,
        "risk_explanation": "Legitimate Network Time Protocol synchronization endpoint with high trust rating."
    },
    {
        "domain_name": "api.weatherapi.com",
        "overall_risk_score": 12.0,
        "risk_level": "Low",
        "category": "Weather Telemetry",
        "request_count": 184,
        "risk_explanation": "Standard third-party weather API service accessed periodically."
    },
    {
        "domain_name": "mqtt.netpulse-iot.local",
        "overall_risk_score": 8.0,
        "risk_level": "Low",
        "category": "Local Broker",
        "request_count": 920,
        "risk_explanation": "Internal IoT message broker gateway running on LAN."
    },
    {
        "domain_name": "malicious-c2-server.ru",
        "overall_risk_score": 88.0,
        "risk_level": "Critical",
        "category": "Command & Control",
        "request_count": 12,
        "risk_explanation": "High risk was assigned because this domain was contacted frequently during suspicious network activity."
    }
]

def seed_database(db: Session):
    Base.metadata.create_all(bind=engine)
    now = datetime.now(timezone.utc)

    # Clean up test esp32 nodes
    db.query(Device).filter(
        (Device.device_id.ilike("%esp32%")) | 
        (Device.name.ilike("%esp32%")) |
        (Device.name.ilike("%testnode%"))
    ).delete(synchronize_session=False)
    db.commit()

    # 1. Seed Demo User
    demo_user = db.query(User).filter(User.email == settings.DEMO_USER_EMAIL).first()
    if not demo_user:
        demo_user = User(
            email=settings.DEMO_USER_EMAIL,
            hashed_password=hash_password(settings.DEMO_USER_PASSWORD),
            full_name=settings.DEMO_USER_NAME,
            role="admin",
            is_active=True,
            created_at=now
        )
        db.add(demo_user)
        logger.info(f"Demo user created: {settings.DEMO_USER_EMAIL}")

    # 2. Seed Initial Devices (initially offline until simulation starts)
    for dev_info in INITIAL_DEVICES:
        existing = db.query(Device).filter(Device.device_id == dev_info["device_id"]).first()
        if not existing:
            dev = Device(
                device_id=dev_info["device_id"],
                name=dev_info["name"],
                type=dev_info["type"],
                ip_address=dev_info["ip_address"],
                mac_address=dev_info["mac_address"],
                status="offline",
                risk_level=dev_info["risk_level"],
                risk_score=dev_info["risk_score"],
                source=dev_info["source"],
                sensor_type=dev_info["sensor_type"],
                latest_sensor_data=dev_info["latest_sensor_data"],
                first_seen=now - timedelta(hours=2),
                last_seen=now
            )
            db.add(dev)
    db.commit()

    # 3. Seed Initial Domains
    for dom_info in INITIAL_DOMAINS:
        existing = db.query(Domain).filter(Domain.domain_name == dom_info["domain_name"]).first()
        if not existing:
            dom = Domain(
                domain_name=dom_info["domain_name"],
                overall_risk_score=dom_info["overall_risk_score"],
                risk_level=dom_info["risk_level"],
                category=dom_info["category"],
                request_count=dom_info["request_count"],
                risk_explanation=dom_info["risk_explanation"],
                first_seen=now - timedelta(days=1),
                last_seen=now
            )
            db.add(dom)

    # 4. Seed Initial Traffic History for ALL simulated devices
    for dev_info in INITIAL_DEVICES:
        ip = dev_info["ip_address"]
        existing_dev_traffic = db.query(NetworkTraffic).filter(NetworkTraffic.source_ip == ip).count()
        if existing_dev_traffic == 0:
            for i in range(25, 0, -1):
                t_time = now - timedelta(minutes=i)
                # Vary traffic volume realistically by device type
                if "cam" in dev_info["device_id"]:
                    b_in = 6500 + (i * 200) + (300 if i % 2 == 0 else -200)
                    b_out = 4200 + (i * 150)
                    pkts = 45 + (i * 3)
                elif "gw" in dev_info["device_id"]:
                    b_in = 4800 + (i * 180)
                    b_out = 3100 + (i * 90)
                    pkts = 35 + (i * 2)
                else:
                    b_in = 1800 + (i * 80) + (100 if i % 3 == 0 else -80)
                    b_out = 950 + (i * 35)
                    pkts = 15 + (i * 1)
                db.add(NetworkTraffic(
                    timestamp=t_time,
                    bytes_in=b_in,
                    bytes_out=b_out,
                    packets_count=pkts,
                    is_suspicious=False,
                    source_ip=ip,
                    destination_ip="192.168.1.1",
                    protocol="TCP"
                ))
    db.commit()

    # 5. Seed Initial System Settings
    default_settings = [
        ("platform_name", settings.PROJECT_NAME, "Platform display branding name"),
        ("auto_response_enabled", str(settings.AUTO_RESPONSE_ENABLED), "Enable or disable automatic mitigation responses"),
        ("high_risk_threshold", str(settings.HIGH_RISK_THRESHOLD), "Threshold for automatic temporary blocking"),
        ("critical_risk_threshold", str(settings.CRITICAL_RISK_THRESHOLD), "Threshold for automatic permanent blocking"),
        ("default_temp_block_minutes", str(settings.DEFAULT_TEMP_BLOCK_MINUTES), "Duration in minutes for temporary blocks"),
        ("simulation_speed", "normal", "Speed of IoT simulated traffic generation")
    ]
    for key, val, desc in default_settings:
        existing = db.query(SystemSettings).filter(SystemSettings.key == key).first()
        if not existing:
            db.add(SystemSettings(key=key, value=val, description=desc))

    # 6. Seed Sample Initial Alert
    alert_count = db.query(Alert).count()
    if alert_count == 0:
        db.add(Alert(
            alert_id="ALT-INIT001",
            timestamp=now - timedelta(minutes=15),
            device_id="esp32-001",
            source_ip="192.168.1.50",
            alert_type="Baseline Calibration Notice",
            severity="Low",
            description="ESP32 Lab Telemetry Sensor successfully established secure telemetry channel.",
            risk_score=12.0,
            status="Acknowledged",
            action_taken="Monitored"
        ))

    db.commit()
    logger.info("Database seeding complete.")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_database(db)
        print("Database seeded successfully.")
    finally:
        db.close()
