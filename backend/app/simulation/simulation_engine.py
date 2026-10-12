import asyncio
import random
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.app.database.connection import SessionLocal
from backend.app.schemas.api_schemas import DeviceEventCreate
from backend.app.services.device_service import device_service
from backend.app.websocket.connection_manager import manager

logger = logging.getLogger(__name__)

SIMULATED_DEVICE_PROFILES = [
    {
        "device_id": "sim-temp-01",
        "name": "HVAC Smart Temp Sensor",
        "type": "Smart Sensor",
        "ip_address": "192.168.1.101",
        "mac_address": "AA:BB:CC:11:22:01",
        "sensor_type": "Temperature & Humidity",
        "base_temp": 22.5
    },
    {
        "device_id": "sim-cam-02",
        "name": "Entrance Security Camera",
        "type": "Smart Camera",
        "ip_address": "192.168.1.102",
        "mac_address": "AA:BB:CC:11:22:02",
        "sensor_type": "Video Feed",
        "base_temp": 38.0
    },
    {
        "device_id": "sim-light-03",
        "name": "Conference Smart Light",
        "type": "Smart Light",
        "ip_address": "192.168.1.103",
        "mac_address": "AA:BB:CC:11:22:03",
        "sensor_type": "Luminance",
        "base_temp": 25.0
    },
    {
        "device_id": "sim-plug-04",
        "name": "Server Rack Smart Plug",
        "type": "Smart Plug",
        "ip_address": "192.168.1.104",
        "mac_address": "AA:BB:CC:11:22:04",
        "sensor_type": "Power Draw (Watts)",
        "base_temp": 30.2
    },
    {
        "device_id": "sim-env-05",
        "name": "Environmental Air Quality Monitor",
        "type": "Air Quality Sensor",
        "ip_address": "192.168.1.105",
        "mac_address": "AA:BB:CC:11:22:05",
        "sensor_type": "Environmental & Gas Telemetry",
        "base_temp": 24.1
    },
    {
        "device_id": "sim-gw-06",
        "name": "Industrial IoT Edge Gateway",
        "type": "Edge Gateway",
        "ip_address": "192.168.1.106",
        "mac_address": "AA:BB:CC:11:22:06",
        "sensor_type": "Modbus Telemetry",
        "base_temp": 26.8
    }
]

class IoTSimulationEngine:
    _instance = None

    def __init__(self):
        self.is_running: bool = False
        self.speed: str = "normal" # slow (8s), normal (4s), fast (1.5s)
        self.task: Optional[asyncio.Task] = None
        self.devices = list(SIMULATED_DEVICE_PROFILES)
        self.unknown_device_counter = 1
        self.is_bursting: bool = False
        self.burst_device_id: str = "esp32-001"
        self.burst_task: Optional[asyncio.Task] = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_interval(self) -> float:
        if self.speed == "fast":
            return 0.6
        elif self.speed == "slow":
            return 2.5
        return 1.2

    async def start(self):
        if self.is_running:
            return
        self.is_running = True

        updated_devices = []
        db: Session = SessionLocal()
        try:
            from backend.app.models.database_models import Device
            now = datetime.now(timezone.utc)
            sim_devices = db.query(Device).filter(Device.source == "simulated").all()
            for dev in sim_devices:
                if dev.status not in ["blocked", "temporarily_blocked"]:
                    dev.status = "online"
                    dev.last_seen = now
                    updated_devices.append((dev.device_id, "online", now.isoformat()))
            db.commit()
        except Exception as e:
            logger.error(f"Error activating simulated devices status: {e}")
        finally:
            db.close()

        for dev_id, status, ts in updated_devices:
            await manager.broadcast("DEVICE_STATUS_CHANGE", {
                "device_id": dev_id,
                "status": status,
                "timestamp": ts
            })

        # Emit initial telemetry for all simulated devices so real-time network activity appears immediately
        for profile in self.devices:
            try:
                await self.generate_normal_event(profile["device_id"])
            except Exception as e:
                logger.error(f"Error generating startup event for {profile['device_id']}: {e}")

        self.task = asyncio.create_task(self._simulation_loop())
        logger.info("IoT Simulation Engine started with instant activity dispatch for all nodes.")
        await manager.broadcast("SIMULATION_STATUS", {"is_running": True, "speed": self.speed})

    async def stop(self):
        self.is_running = False
        if self.task:
            self.task.cancel()
            self.task = None

        updated_devices = []
        db: Session = SessionLocal()
        try:
            from backend.app.models.database_models import Device
            now = datetime.now(timezone.utc)
            sim_devices = db.query(Device).filter(Device.source == "simulated").all()
            for dev in sim_devices:
                if dev.status not in ["blocked", "temporarily_blocked"]:
                    dev.status = "offline"
                    updated_devices.append((dev.device_id, "offline", now.isoformat()))
            db.commit()
        except Exception as e:
            logger.error(f"Error setting simulated devices to offline: {e}")
        finally:
            db.close()

        for dev_id, status, ts in updated_devices:
            await manager.broadcast("DEVICE_STATUS_CHANGE", {
                "device_id": dev_id,
                "status": status,
                "timestamp": ts
            })

        logger.info("IoT Simulation Engine stopped.")
        await manager.broadcast("SIMULATION_STATUS", {"is_running": False, "speed": self.speed})

    async def _simulation_loop(self):
        device_pool = list(self.devices)
        while self.is_running:
            try:
                if not device_pool:
                    device_pool = list(self.devices)
                    random.shuffle(device_pool)
                device_profile = device_pool.pop(0)
                await self.generate_normal_event(device_profile["device_id"])
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in simulation loop: {e}")
            await asyncio.sleep(self.get_interval())

    async def start_burst(self, device_id: str = "esp32-001"):
        if self.is_bursting:
            return
        self.is_bursting = True
        self.burst_device_id = device_id
        self.burst_task = asyncio.create_task(self._burst_loop())
        logger.info(f"Demo Burst stream started for device {device_id}.")
        await manager.broadcast("SIMULATION_BURST_STATUS", {"is_bursting": True, "device_id": self.burst_device_id})

    async def stop_burst(self):
        self.is_bursting = False
        if self.burst_task:
            self.burst_task.cancel()
            self.burst_task = None
        logger.info("Demo Burst stream stopped.")
        await manager.broadcast("SIMULATION_BURST_STATUS", {"is_bursting": False, "device_id": self.burst_device_id})

    async def toggle_burst(self, device_id: str = "esp32-001") -> bool:
        if self.is_bursting:
            await self.stop_burst()
            return False
        else:
            await self.start_burst(device_id)
            return True

    async def _burst_loop(self):
        try:
            while self.is_bursting:
                scenario = random.choice(["high_traffic", "high_traffic", "suspicious_domain", "suspicious_activity"])
                await self.trigger_scenario(scenario, self.burst_device_id)
                await asyncio.sleep(1.8)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in Demo Burst loop: {e}")

    async def trigger_scenario(self, scenario: str, device_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Triggers a specific on-demand simulation scenario.
        Scenarios: normal, high_traffic (traffic_burst), suspicious_activity (port_scan), suspicious_domain (c2domain), unknown_device (rogue_device)
        """
        scenario_key = scenario.lower().strip().replace("-", "_").replace(" ", "_")

        if scenario_key in ["unknown_device", "rogue_device", "rogue", "unknown"]:
            return await self.generate_unknown_device_event(None if device_id == "auto" else device_id)

        if not device_id or device_id == "auto":
            # Pick from active (non-blocked) simulated devices
            db: Session = SessionLocal()
            try:
                from backend.app.models.database_models import Device, BlockedEntity
                blocked_ids = [b.entity_id for b in db.query(BlockedEntity).filter(BlockedEntity.is_active == True).all()]
                blocked_ips = [b.ip_address for b in db.query(BlockedEntity).filter(BlockedEntity.is_active == True).all() if b.ip_address]

                active_sims = db.query(Device).filter(
                    Device.source == "simulated",
                    Device.status.notin_(["blocked", "temporarily_blocked"]),
                    Device.device_id.notin_(blocked_ids) if blocked_ids else True,
                    Device.ip_address.notin_(blocked_ips) if blocked_ips else True
                ).all()

                if active_sims:
                    target_device_id = random.choice(active_sims).device_id
                else:
                    # If all simulated devices were previously blocked, unblock one for testing
                    chosen = random.choice(self.devices)
                    target_device_id = chosen["device_id"]
                    db.query(BlockedEntity).filter(
                        (BlockedEntity.entity_id == target_device_id) |
                        (BlockedEntity.ip_address == chosen["ip_address"])
                    ).update({"is_active": False}, synchronize_session=False)
                    dev_rec = db.query(Device).filter(Device.device_id == target_device_id).first()
                    if dev_rec:
                        dev_rec.status = "online"
                    db.commit()
            except Exception as e:
                logger.error(f"Error selecting unblocked target: {e}")
                target_device_id = random.choice(self.devices)["device_id"]
            finally:
                db.close()
        else:
            target_device_id = device_id
            # Ensure targeted device is unblocked so test scenario can execute
            db = SessionLocal()
            try:
                from backend.app.models.database_models import Device, BlockedEntity
                profile = self._get_profile(target_device_id)
                db.query(BlockedEntity).filter(
                    (BlockedEntity.entity_id == target_device_id) |
                    (BlockedEntity.ip_address == profile.get("ip_address"))
                ).update({"is_active": False}, synchronize_session=False)
                dev_rec = db.query(Device).filter(Device.device_id == target_device_id).first()
                if dev_rec and dev_rec.status in ["blocked", "temporarily_blocked"]:
                    dev_rec.status = "online"
                db.commit()
            except Exception as e:
                logger.error(f"Error resetting target block state: {e}")
            finally:
                db.close()

        if scenario_key in ["normal"]:
            return await self.generate_normal_event(target_device_id)
        elif scenario_key in ["high_traffic", "traffic_burst", "trafficburst", "burst"]:
            return await self.generate_high_traffic_event(target_device_id)
        elif scenario_key in ["suspicious_activity", "port_scan", "portscan", "scan"]:
            return await self.generate_suspicious_activity_event(target_device_id)
        elif scenario_key in ["suspicious_domain", "c2domain", "c2_domain", "c2", "domain"]:
            return await self.generate_suspicious_domain_event(target_device_id)
        else:
            return await self.generate_normal_event(target_device_id)

    def _get_profile(self, device_id: str) -> Dict[str, Any]:
        match = next((d for d in self.devices if d["device_id"] == device_id), None)
        if match:
            return match
        
        # Check database for registered devices
        db: Session = SessionLocal()
        try:
            from backend.app.models.database_models import Device
            dev = db.query(Device).filter(Device.device_id == device_id).first()
            if dev:
                return {
                    "device_id": dev.device_id,
                    "name": dev.name,
                    "type": dev.type,
                    "ip_address": dev.ip_address,
                    "mac_address": dev.mac_address or "AA:BB:CC:DD:EE:FF",
                    "base_temp": 25.0
                }
        finally:
            db.close()
            
        return {
            "device_id": device_id,
            "name": f"Node {device_id}",
            "type": "Smart Device",
            "ip_address": "192.168.1.120",
            "mac_address": "AA:BB:CC:11:22:99",
            "base_temp": 25.0
        }

    async def generate_normal_event(self, device_id: str) -> Dict[str, Any]:
        profile = self._get_profile(device_id)
        temp_val = round(profile["base_temp"] + random.uniform(-1.2, 1.2), 1)

        event = DeviceEventCreate(
            device_id=profile["device_id"],
            device_name=profile["name"],
            device_type=profile["type"],
            ip_address=profile["ip_address"],
            mac_address=profile["mac_address"],
            sensor_data={
                "temperature": temp_val,
                "humidity": round(random.uniform(40.0, 65.0), 1),
                "status": "normal"
            },
            traffic_volume=random.randint(220, 650),
            packet_count=random.randint(2, 6),
            request_frequency=round(random.uniform(0.05, 0.35), 4),
            connection_frequency=round(random.uniform(1.0, 5.0), 2),
            failed_connections=0,
            protocol=random.choice(["TCP", "UDP"]),
            destination_port=random.choice([80, 443, 1883]),
            domain_contacted=random.choice(["pool.ntp.org", "api.weatherapi.com", "mqtt.netpulse-iot.local"])
        )

        db: Session = SessionLocal()
        try:
            return await device_service.process_device_event(db, event, client_ip=profile["ip_address"])
        finally:
            db.close()

    async def generate_high_traffic_event(self, device_id: str) -> Dict[str, Any]:
        profile = self._get_profile(device_id)
        
        event = DeviceEventCreate(
            device_id=profile["device_id"],
            device_name=profile["name"],
            device_type=profile["type"],
            ip_address=profile["ip_address"],
            mac_address=profile["mac_address"],
            sensor_data={"stream_status": "high_throughput_burst", "buffer_percent": 96},
            traffic_volume=random.randint(95000, 280000), # Massive throughput spike on graph
            packet_count=random.randint(850, 2400),
            request_frequency=round(random.uniform(35.0, 95.0), 2),
            connection_frequency=round(random.uniform(80.0, 250.0), 2),
            failed_connections=random.randint(1, 4),
            protocol="TCP",
            destination_port=random.choice([80, 443, 8080]),
            domain_contacted="suspicious-telemetry.cc"
        )

        db: Session = SessionLocal()
        try:
            return await device_service.process_device_event(db, event, client_ip=profile["ip_address"])
        finally:
            db.close()

    async def generate_suspicious_activity_event(self, device_id: str) -> Dict[str, Any]:
        profile = self._get_profile(device_id)
        
        # Simulates port scan or brute-force pattern
        target_port = random.choice([22, 23, 135, 445, 3389, 4444])
        event = DeviceEventCreate(
            device_id=profile["device_id"],
            device_name=profile["name"],
            device_type=profile["type"],
            ip_address=profile["ip_address"],
            mac_address=profile["mac_address"],
            sensor_data={"anomaly_flag": True, "error_code": "CONN_REFUSED_BURST", "scan_pattern": "SYN_FLOOD"},
            traffic_volume=random.randint(18000, 48000), # Elevated packet rate
            packet_count=random.randint(220, 650),
            request_frequency=round(random.uniform(25.0, 75.0), 2),
            connection_frequency=round(random.uniform(120.0, 450.0), 2),
            failed_connections=random.randint(18, 55), # High failed connections = port scan signature
            protocol="TCP",
            destination_port=target_port,
            domain_contacted="malicious-c2-server.ru"
        )

        db: Session = SessionLocal()
        try:
            return await device_service.process_device_event(db, event, client_ip=profile["ip_address"])
        finally:
            db.close()

    async def generate_suspicious_domain_event(self, device_id: str) -> Dict[str, Any]:
        profile = self._get_profile(device_id)
        domain_name = random.choice(["malicious-c2-server.ru", "iot-exploit-payloads.top", "cryptominer-pool.xyz"])
        
        event = DeviceEventCreate(
            device_id=profile["device_id"],
            device_name=profile["name"],
            device_type=profile["type"],
            ip_address=profile["ip_address"],
            mac_address=profile["mac_address"],
            sensor_data={"dns_query_status": "exfil_attempt", "c2_beacon": True},
            traffic_volume=random.randint(28000, 72000),
            packet_count=random.randint(140, 380),
            request_frequency=round(random.uniform(8.0, 24.0), 2),
            connection_frequency=round(random.uniform(30.0, 90.0), 2),
            failed_connections=2,
            protocol="TCP",
            destination_port=random.choice([4444, 6667, 8443]),
            domain_contacted=domain_name
        )

        db: Session = SessionLocal()
        try:
            return await device_service.process_device_event(db, event, client_ip=profile["ip_address"])
        finally:
            db.close()

    async def generate_unknown_device_event(self, device_id: Optional[str] = None) -> Dict[str, Any]:
        if device_id and not device_id.startswith("unknown-iot-node"):
            profile = self._get_profile(device_id)
            event = DeviceEventCreate(
                device_id=profile["device_id"],
                device_name=profile["name"],
                device_type=profile["type"],
                ip_address=profile["ip_address"],
                mac_address=profile["mac_address"],
                sensor_data={"probe": "unauthorized_connection", "client_hello": "spoofed_rogue_fingerprint"},
                traffic_volume=random.randint(16000, 38000),
                packet_count=random.randint(100, 240),
                request_frequency=round(random.uniform(12.0, 32.0), 2),
                connection_frequency=round(random.uniform(25.0, 75.0), 2),
                failed_connections=random.randint(10, 24),
                protocol="TCP",
                destination_port=random.choice([80, 8080, 23]),
                domain_contacted="unknown-peer-relay.net"
            )
            db: Session = SessionLocal()
            try:
                return await device_service.process_device_event(db, event, client_ip=profile["ip_address"])
            finally:
                db.close()
        else:
            dev_num = self.unknown_device_counter
            self.unknown_device_counter += 1
            
            new_device_id = f"unknown-iot-node-{dev_num:02d}"
            ip_address = f"192.168.1.{200 + dev_num}"
            mac_address = f"EE:FF:11:22:33:{dev_num:02d}"

            event = DeviceEventCreate(
                device_id=new_device_id,
                device_name=f"Rogue IoT Node #{dev_num}",
                device_type="Rogue IoT Device",
                ip_address=ip_address,
                mac_address=mac_address,
                sensor_data={"probe": "unauthorized_connection", "client_hello": "unknown_fingerprint", "rogue": True},
                traffic_volume=random.randint(15000, 35000),
                packet_count=random.randint(90, 220),
                request_frequency=round(random.uniform(10.0, 28.0), 2),
                connection_frequency=round(random.uniform(20.0, 65.0), 2),
                failed_connections=random.randint(8, 20),
                protocol="TCP",
                destination_port=random.choice([80, 8080, 23]),
                domain_contacted="unknown-peer-relay.net"
            )

            db: Session = SessionLocal()
            try:
                return await device_service.process_device_event(db, event, client_ip=ip_address)
            finally:
                db.close()

simulation_engine = IoTSimulationEngine.get_instance()
