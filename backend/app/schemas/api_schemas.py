from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, Field, field_serializer

# Auth Schemas
class UserLogin(BaseModel):
    email: str
    password: str
    remember_me: bool = False

class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str

class ForgotPasswordRequest(BaseModel):
    email: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class UserProfile(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    created_at: Optional[datetime] = None

# ESP32 and IoT Device Event Ingestion
class SensorData(BaseModel):
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    state: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None

class DeviceEventCreate(BaseModel):
    device_id: str
    device_name: Optional[str] = None
    device_type: Optional[str] = "ESP32"
    status: Optional[str] = "online"
    sensor_data: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    domain_contacted: Optional[str] = None
    traffic_volume: Optional[int] = None
    packet_count: Optional[int] = None
    request_frequency: Optional[float] = None
    connection_frequency: Optional[float] = None
    failed_connections: Optional[int] = None
    protocol: Optional[str] = "TCP"
    destination_port: Optional[int] = 80
    timestamp: Optional[str] = None

class DeviceEventResponse(BaseModel):
    status: str
    device_id: str
    classification: str
    risk_score: float
    risk_level: str
    action_taken: str
    reasons: List[str]

# Device Schemas
class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: str
    name: str
    type: str
    ip_address: str
    mac_address: Optional[str] = None
    status: str
    risk_level: str
    risk_score: float
    source: str
    sensor_type: Optional[str] = None
    latest_sensor_data: Optional[Dict[str, Any]] = None
    first_seen: datetime
    last_seen: datetime

    @field_serializer("first_seen", "last_seen", when_used="always")
    def serialize_datetime(self, dt: datetime, _info) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

class DeviceActionRequest(BaseModel):
    action: str # monitor, block, temp_block, unblock
    duration_minutes: Optional[int] = 15 # for temp_block
    reason: Optional[str] = "Operator initiated action"

# Alert Schemas
class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    alert_id: str
    timestamp: datetime
    device_id: Optional[str] = None
    device_name: Optional[str] = None
    source_ip: str
    alert_type: str
    severity: str
    description: str
    risk_score: float
    status: str
    action_taken: str

    @field_serializer("timestamp", when_used="always")
    def serialize_datetime(self, dt: datetime, _info) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

class AlertUpdate(BaseModel):
    status: str # New, Acknowledged, Resolved

# Domain Schemas
class DomainOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    domain_name: str
    overall_risk_score: float
    risk_level: str
    category: str
    request_count: int
    risk_explanation: Optional[str] = None
    first_seen: datetime
    last_seen: datetime
    connected_devices: Optional[List[str]] = []

    @field_serializer("first_seen", "last_seen", when_used="always")
    def serialize_datetime(self, dt: datetime, _info) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

# Blocking Schemas
class BlockEntityRequest(BaseModel):
    entity_type: str = "ip" # device or ip
    entity_id: str
    ip_address: Optional[str] = None
    reason: str = "Identified as malicious/suspicious activity"
    is_temporary: bool = False
    duration_minutes: Optional[int] = 15

class BlockedEntityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entity_type: str
    entity_id: str
    ip_address: Optional[str] = None
    reason: str
    is_temporary: bool
    block_start: datetime
    expiry_time: Optional[datetime] = None
    is_active: bool
    time_remaining_seconds: Optional[int] = None

# Simulation Schemas
class SimulationControlRequest(BaseModel):
    speed: Optional[str] = "normal"
    device_count: Optional[int] = 6

class ScenarioTriggerRequest(BaseModel):
    scenario: str
    device_id: Optional[str] = None

# Settings Schemas
class SettingsUpdate(BaseModel):
    platform_name: Optional[str] = None
    analyst_email: Optional[str] = None
    traffic_threshold_bytes: Optional[int] = None
    detection_sensitivity: Optional[str] = None
    auto_response_enabled: Optional[bool] = None
    high_risk_threshold: Optional[int] = None
    critical_risk_threshold: Optional[int] = None
    default_temp_block_minutes: Optional[int] = None
    simulation_speed: Optional[str] = None
