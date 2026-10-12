from fastapi import APIRouter, HTTPException
from backend.app.schemas.api_schemas import SimulationControlRequest, ScenarioTriggerRequest
from backend.app.simulation.simulation_engine import simulation_engine

router = APIRouter(prefix="/simulation", tags=["IoT Simulation Engine"])

@router.get("/status")
def get_simulation_status():
    return {
        "is_running": simulation_engine.is_running,
        "speed": simulation_engine.speed,
        "device_count": len(simulation_engine.devices),
        "devices": [
            {"device_id": d["device_id"], "name": d["name"], "type": d["type"]}
            for d in simulation_engine.devices
        ]
    }

@router.post("/start")
async def start_simulation(control_in: SimulationControlRequest = None):
    if control_in and control_in.speed:
        simulation_engine.speed = control_in.speed
    await simulation_engine.start()
    return {
        "status": "success",
        "message": "IoT Simulation Engine active",
        "is_running": True,
        "speed": simulation_engine.speed
    }

@router.post("/stop")
async def stop_simulation():
    await simulation_engine.stop()
    return {
        "status": "success",
        "message": "IoT Simulation Engine stopped",
        "is_running": False
    }

@router.post("/trigger-scenario")
async def trigger_simulation_scenario(req: ScenarioTriggerRequest):
    result = await simulation_engine.trigger_scenario(
        scenario=req.scenario.lower(),
        device_id=req.device_id
    )
    return {
        "status": "success",
        "scenario": req.scenario,
        "result": result
    }

@router.get("/burst/status")
def get_burst_status():
    return {
        "is_bursting": simulation_engine.is_bursting,
        "target_device": simulation_engine.burst_device_id
    }

@router.post("/burst/start")
async def start_burst(device_id: str = "esp32-001"):
    await simulation_engine.start_burst(device_id=device_id)
    return {
        "status": "success",
        "is_bursting": True,
        "target_device": simulation_engine.burst_device_id
    }

@router.post("/burst/stop")
async def stop_burst():
    await simulation_engine.stop_burst()
    return {
        "status": "success",
        "is_bursting": False
    }

@router.post("/burst/toggle")
async def toggle_burst(device_id: str = "esp32-001"):
    active = await simulation_engine.toggle_burst(device_id=device_id)
    return {
        "status": "success",
        "is_bursting": active,
        "target_device": simulation_engine.burst_device_id
    }

