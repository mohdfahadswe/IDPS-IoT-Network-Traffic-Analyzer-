from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from backend.app.database.connection import Base

def utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="admin")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(100), nullable=False) # ESP32, Smart Sensor, Smart Camera, etc.
    ip_address = Column(String(50), nullable=False, index=True)
    mac_address = Column(String(50), nullable=True)
    status = Column(String(50), default="online", index=True) # online, offline, suspicious, temporarily_blocked, blocked
    risk_level = Column(String(50), default="Low") # Low, Medium, High, Critical
    risk_score = Column(Float, default=0.0) # 0 to 100
    source = Column(String(50), default="simulated") # real, simulated
    sensor_type = Column(String(100), nullable=True) # DHT11, DHT22, Temperature, None
    latest_sensor_data = Column(JSON, nullable=True) # {"temperature": 28.5, ...}
    first_seen = Column(DateTime, default=utc_now)
    last_seen = Column(DateTime, default=utc_now, onupdate=utc_now)

    events = relationship("DeviceEvent", back_populates="device", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="device", cascade="all, delete-orphan")

class DeviceEvent(Base):
    __tablename__ = "device_events"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), ForeignKey("devices.device_id"), index=True, nullable=False)
    traffic_volume = Column(Integer, default=0)
    packet_count = Column(Integer, default=1)
    request_frequency = Column(Float, default=0.1)
    connection_frequency = Column(Float, default=1.0)
    failed_connections = Column(Integer, default=0)
    protocol = Column(String(20), default="TCP")
    port = Column(Integer, default=80)
    is_suspicious = Column(Boolean, default=False)
    risk_score = Column(Float, default=0.0)
    reasons = Column(JSON, nullable=True)
    raw_payload = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=utc_now, index=True)

    device = relationship("Device", back_populates="events")

class NetworkTraffic(Base):
    __tablename__ = "network_traffic"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=utc_now, index=True)
    bytes_in = Column(Integer, default=0)
    bytes_out = Column(Integer, default=0)
    packets_count = Column(Integer, default=0)
    is_suspicious = Column(Boolean, default=False)
    source_ip = Column(String(50), nullable=True)
    destination_ip = Column(String(50), nullable=True)
    protocol = Column(String(20), default="TCP")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(String(50), unique=True, index=True, nullable=False)
    timestamp = Column(DateTime, default=utc_now, index=True)
    device_id = Column(String(100), ForeignKey("devices.device_id"), nullable=True, index=True)
    source_ip = Column(String(50), nullable=False, index=True)
    alert_type = Column(String(100), nullable=False) # Unusual Traffic Pattern, Port Scan, etc.
    severity = Column(String(50), nullable=False, index=True) # Low, Medium, High, Critical
    description = Column(Text, nullable=False)
    risk_score = Column(Float, default=0.0)
    status = Column(String(50), default="New", index=True) # New, Acknowledged, Resolved
    action_taken = Column(String(100), default="Monitored") # Monitored, Temporarily Blocked, Blocked
    device = relationship("Device", back_populates="alerts")

    @property
    def device_name(self) -> str | None:
        return self.device.name if self.device else None


class Domain(Base):
    __tablename__ = "domains"

    id = Column(Integer, primary_key=True, index=True)
    domain_name = Column(String(255), unique=True, index=True, nullable=False)
    overall_risk_score = Column(Float, default=10.0)
    risk_level = Column(String(50), default="Low") # Low, Medium, High, Critical
    category = Column(String(100), default="Cloud Telemetry") # Cloud, IoT Services, Suspicious C2, Unknown
    request_count = Column(Integer, default=1)
    risk_explanation = Column(Text, nullable=True)
    first_seen = Column(DateTime, default=utc_now)
    last_seen = Column(DateTime, default=utc_now, onupdate=utc_now)

    activities = relationship("DomainActivity", back_populates="domain", cascade="all, delete-orphan")

class DomainActivity(Base):
    __tablename__ = "domain_activities"

    id = Column(Integer, primary_key=True, index=True)
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=False)
    device_id = Column(String(100), nullable=False, index=True)
    timestamp = Column(DateTime, default=utc_now, index=True)
    port = Column(Integer, default=443)
    risk_contribution = Column(Float, default=0.0)

    domain = relationship("Domain", back_populates="activities")

class BlockedEntity(Base):
    __tablename__ = "blocked_entities"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False) # device, ip
    entity_id = Column(String(100), index=True, nullable=False) # device_id or IP address
    ip_address = Column(String(50), nullable=True)
    reason = Column(Text, nullable=False)
    is_temporary = Column(Boolean, default=False)
    block_start = Column(DateTime, default=utc_now)
    expiry_time = Column(DateTime, nullable=True) # null if permanent
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=utc_now)

class SecurityAction(Base):
    __tablename__ = "security_actions"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=utc_now, index=True)
    action_type = Column(String(100), nullable=False) # Block, Temporary Block, Unblock, Alert and Monitor
    target_entity = Column(String(100), nullable=False)
    reason = Column(Text, nullable=False)
    triggered_by = Column(String(50), default="automatic") # automatic, manual
    details = Column(JSON, nullable=True)

class RiskScoreRecord(Base):
    __tablename__ = "risk_score_records"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), index=True, nullable=False)
    score = Column(Float, nullable=False)
    level = Column(String(50), nullable=False)
    reasons_json = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=utc_now, index=True)

class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    value = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)

class SimulationSession(Base):
    __tablename__ = "simulation_sessions"

    id = Column(Integer, primary_key=True, index=True)
    is_running = Column(Boolean, default=False)
    speed = Column(String(50), default="normal") # slow, normal, fast
    device_count = Column(Integer, default=5)
    active_scenarios = Column(JSON, nullable=True)
    started_at = Column(DateTime, nullable=True)
    stopped_at = Column(DateTime, nullable=True)
