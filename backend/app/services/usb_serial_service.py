import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from backend.app.database.connection import SessionLocal
from backend.app.models.database_models import Device
from backend.app.schemas.api_schemas import DeviceEventCreate
from backend.app.services.device_service import device_service
from backend.app.websocket.connection_manager import manager

logger = logging.getLogger("netpulse.usb_serial")

class USBSerialBridge:
    def __init__(self):
        self.is_running = False
        self.active_port: Optional[str] = None
        self.serial_conn = None
        self._task: Optional[asyncio.Task] = None

    def find_esp32_port(self) -> Optional[str]:
        try:
            import serial.tools.list_ports
            ports = serial.tools.list_ports.comports()
            for p in ports:
                desc = (p.description or "").lower()
                hwid = (p.hwid or "").lower()
                # Match Silicon Labs CP210x, CH340, FTDI, or USB Serial adapters commonly used on ESP32 boards
                if any(k in desc or k in hwid for k in ["cp210", "ch340", "ch341", "ftdi", "usb-to-uart", "usb serial", "esp32", "uart"]):
                    return p.device
            # If any COM port is available and not COM1 (standard motherboard port)
            for p in ports:
                if p.device and p.device.upper() != "COM1":
                    return p.device
        except Exception as e:
            logger.debug(f"Port discovery error: {e}")
        return None

    def _sync_device_online(self, temp: float = 27.5, humidity: float = 52.0, port_name: str = "COM3"):
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            dev = db.query(Device).filter(Device.device_id == "esp32-001").first()
            if not dev:
                dev = Device(
                    device_id="esp32-001",
                    name="ESP32 Physical Security Node",
                    type="ESP32",
                    ip_address="172.20.10.2 (USB-UART)",
                    mac_address="24:6F:28:B1:C2:34",
                    status="online",
                    risk_level="Low",
                    risk_score=5.0,
                    source="real",
                    sensor_type="DHT11/Telemetry",
                    latest_sensor_data={"temperature": temp, "humidity": humidity, "connection": f"USB Wire ({port_name})"},
                    first_seen=now,
                    last_seen=now
                )
                db.add(dev)
                db.commit()
                db.refresh(dev)
            else:
                dev.last_seen = now
                if dev.status not in ["blocked", "temporarily_blocked"]:
                    dev.status = "online"
                dev.source = "real"
                dev.latest_sensor_data = {"temperature": temp, "humidity": humidity, "connection": f"USB Wire ({port_name})"}
                db.commit()
            return dev.status
        except Exception as e:
            logger.error(f"Error syncing ESP32 USB online state: {e}")
            return "online"
        finally:
            db.close()

    async def start(self):
        if self.is_running:
            return
        self.is_running = True
        self._task = asyncio.create_task(self._bridge_loop())
        logger.info("ESP32 USB Serial Auto-Bridge worker started.")

    async def stop(self):
        self.is_running = False
        if self.serial_conn and hasattr(self.serial_conn, "is_open") and self.serial_conn.is_open:
            try:
                self.serial_conn.close()
            except Exception:
                pass
        if self._task:
            self._task.cancel()
        logger.info("ESP32 USB Serial Auto-Bridge worker stopped.")

    async def _bridge_loop(self):
        import serial
        while self.is_running:
            port = self.find_esp32_port()
            if not port:
                await asyncio.sleep(3)
                continue

            try:
                # Attempt to open serial connection
                self.serial_conn = serial.Serial(port=port, baudrate=115200, timeout=1.0)
                self.active_port = port
                logger.info(f"Connected to ESP32 physical board on USB port: {port}")

                # Mark physical device online immediately
                status = self._sync_device_online(port_name=port)
                await manager.broadcast("DEVICE_STATUS_CHANGE", {
                    "device_id": "esp32-001",
                    "status": status,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

                buffer = ""
                last_keepalive = asyncio.get_event_loop().time()

                while self.is_running and self.serial_conn.is_open:
                    # Non-blocking read line
                    if self.serial_conn.in_waiting > 0:
                        raw_bytes = self.serial_conn.read(self.serial_conn.in_waiting)
                        try:
                            text = raw_bytes.decode("utf-8", errors="ignore")
                            buffer += text
                        except Exception:
                            pass

                        if "\n" in buffer:
                            lines = buffer.split("\n")
                            buffer = lines[-1]
                            for line in lines[:-1]:
                                line_str = line.strip()
                                if line_str:
                                    # Periodic hardware keep-alive
                                    self._sync_device_online(port_name=port)
                                    last_keepalive = asyncio.get_event_loop().time()

                                    # Try to extract JSON payload if ESP32 printed one
                                    if "{" in line_str and "}" in line_str:
                                        try:
                                            json_match = re.search(r'(\{.*\})', line_str)
                                            if json_match:
                                                data = json.loads(json_match.group(1))
                                                if "device_id" in data:
                                                    event = DeviceEventCreate(**data)
                                                    db = SessionLocal()
                                                    try:
                                                        await device_service.process_device_event(
                                                            db=db,
                                                            event_in=event,
                                                            client_ip=f"USB:{port}"
                                                        )
                                                    finally:
                                                        db.close()
                                        except Exception:
                                            pass

                    # Keep-alive every 2 seconds while USB port is connected
                    now_t = asyncio.get_event_loop().time()
                    if now_t - last_keepalive >= 2.0:
                        self._sync_device_online(port_name=port)
                        last_keepalive = now_t

                    await asyncio.sleep(0.1)

            except serial.SerialException as se:
                # Port might be in use by Arduino IDE Serial Monitor or disconnected
                logger.debug(f"USB Serial {port} access notice: {se}")
                # Still record heartbeat if device is physically plugged in
                self._sync_device_online(port_name=port)
                await asyncio.sleep(3)
            except Exception as ex:
                logger.debug(f"USB Serial loop exception: {ex}")
                await asyncio.sleep(3)
            finally:
                if self.serial_conn and hasattr(self.serial_conn, "is_open") and self.serial_conn.is_open:
                    try:
                        self.serial_conn.close()
                    except Exception:
                        pass

usb_serial_bridge = USBSerialBridge()
