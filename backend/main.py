import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import settings
from backend.app.database.connection import SessionLocal
from backend.app.database.seed import seed_database
from backend.app.ml.model_service import ModelService
from backend.app.services.blocking_service import blocking_service
from backend.app.services.usb_serial_service import usb_serial_bridge
from backend.app.simulation.simulation_engine import simulation_engine
from backend.app.websocket.connection_manager import manager

# API Routers
from backend.app.api.events import router as events_router
from backend.app.api.auth import router as auth_router
from backend.app.api.devices import router as devices_router
from backend.app.api.traffic import router as traffic_router
from backend.app.api.alerts import router as alerts_router
from backend.app.api.domains import router as domains_router
from backend.app.api.blocking import router as blocking_router
from backend.app.api.analytics import router as analytics_router
from backend.app.api.reports import router as reports_router
from backend.app.api.simulation import router as simulation_router
from backend.app.api.settings import router as settings_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("netpulse")

async def periodic_block_expiry_worker():
    """
    Background worker that runs every 5 seconds to expire temporary blocks.
    """
    while True:
        try:
            db = SessionLocal()
            try:
                await blocking_service.check_and_expire_temporary_blocks(db)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error in block expiration worker: {e}")
        await asyncio.sleep(5)

async def periodic_device_heartbeat_worker():
    """
    Background worker running every 2s:
    Marks physical real devices (source == 'real') as 'offline' if no telemetry received for > 45 seconds.
    Simulated devices are managed by the simulation engine.
    """
    while True:
        try:
            db = SessionLocal()
            try:
                from datetime import datetime, timezone
                from backend.app.models.database_models import Device
                
                now = datetime.now(timezone.utc)
                online_real_devices = db.query(Device).filter(
                    Device.status.in_(["online", "suspicious"]),
                    Device.source == "real"
                ).all()
                changed = False
                
                for dev in online_real_devices:
                    if not dev.last_seen:
                        dev.status = "offline"
                        changed = True
                        await manager.broadcast("DEVICE_STATUS_CHANGE", {
                            "device_id": dev.device_id,
                            "status": "offline",
                            "timestamp": now.isoformat()
                        })
                    else:
                        last_seen_dt = dev.last_seen.replace(tzinfo=timezone.utc) if dev.last_seen.tzinfo is None else dev.last_seen
                        if (now - last_seen_dt).total_seconds() > 45:
                            dev.status = "offline"
                            changed = True
                            await manager.broadcast("DEVICE_STATUS_CHANGE", {
                                "device_id": dev.device_id,
                                "status": "offline",
                                "timestamp": now.isoformat()
                            })
                if changed:
                    db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error in heartbeat worker: {e}")
        await asyncio.sleep(2)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup:
    logger.info("Initializing NetPulse IoT Security Platform...")
    
    # 1. Database seed
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()

    # 2. Ensure Random Forest model loaded / auto-trained
    ModelService.get_instance()

    # 3. Start background workers
    expiry_task = asyncio.create_task(periodic_block_expiry_worker())
    heartbeat_task = asyncio.create_task(periodic_device_heartbeat_worker())
    await usb_serial_bridge.start()
    logger.info("Background security, USB serial bridge, and heartbeat workers launched.")

    yield

    # Shutdown:
    await usb_serial_bridge.stop()
    expiry_task.cancel()
    heartbeat_task.cancel()
    if simulation_engine.is_running:
        await simulation_engine.stop()
    logger.info("Platform shutting down gracefully.")

app = FastAPI(
    title="NetPulse IoT Platform",
    description="IoT Network Security Monitoring, Threat Detection, and Automated Response Platform",
    version="2.4.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(events_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(devices_router, prefix="/api")
app.include_router(traffic_router, prefix="/api")
app.include_router(alerts_router, prefix="/api")
app.include_router(domains_router, prefix="/api")
app.include_router(blocking_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(simulation_router, prefix="/api")
app.include_router(settings_router, prefix="/api")

# Real-time WebSocket Endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep-alive receive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.debug(f"WebSocket closed: {e}")
        manager.disconnect(websocket)

@app.get("/")
def root():
    return {
        "platform": settings.PROJECT_NAME,
        "status": "operational",
        "api_docs": "/docs",
        "health_check": "/api/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)
