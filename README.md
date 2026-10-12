# NetPulse IoT: Network Security Monitoring, Threat Detection & Automated Response Platform

> A professional, enterprise-grade IoT network security monitoring and automated response platform featuring **MANDATORY physical ESP32 microcontroller integration**, **Random Forest machine learning threat classification**, **multi-factor dynamic risk scoring (0–100)**, **transparent domain heuristic intelligence**, **manual and automated quarantine blocking with countdown expiry**, and a **real-time React + TypeScript dashboard**.

---

## 1. Project Overview

**NetPulse IoT** delivers an end-to-end security pipeline specifically tailored for heterogeneous IoT environments (smart sensors, security cameras, smart plugs, industrial nodes, and physical ESP32 microcontrollers). 

The platform continuously evaluates network flow volume, packet burst rates, request frequencies, connection failures, target ports, and contacted domains. Telemetry is streamed through a trained **Random Forest Classifier** and scored across multi-factor heuristics to automatically contain high-risk and critical anomalies in real time without human intervention.

---

## 2. System Architecture

```
┌────────────────────────────────┐       ┌────────────────────────────────┐
│   Physical ESP32 Device        │       │   IoT Simulation Fleet         │
│   (WiFi + DHT Sensor Telemetry)│       │   (6 Heterogeneous Profiles)   │
└───────────────┬────────────────┘       └───────────────┬────────────────┘
                │                                        │
                │ HTTP POST /api/device-events           │
                └───────────────────┬────────────────────┘
                                    ▼
                     ┌─────────────────────────────┐
                     │   FastAPI Backend Server    │
                     │   (Bound to 0.0.0.0:8000)   │
                     │   - Auto Device Registration│
                     │   - Token-based JWT Auth    │
                     └──────────────┬──────────────┘
                                    ▼
                     ┌─────────────────────────────┐
                     │  Feature Extraction Engine  │
                     │  (9 Standardized Features)  │
                     └──────────────┬──────────────┘
                                    ▼
                     ┌─────────────────────────────┐
                     │  Random Forest Classifier   │
                     │   (Normal vs Suspicious)    │
                     └──────────────┬──────────────┘
                                    ▼
                     ┌─────────────────────────────┐
                     │   Dynamic Risk Engine       │
                     │   (0–100 Multi-Factor Score)│
                     └──────────────┬──────────────┘
                                    ▼
                     ┌─────────────────────────────┐
                     │  Automated Policy Engine    │
                     │  - Score >= 81: Block       │
                     │  - Score >= 61: Temp Block  │
                     │  - Score >= 31: Alert/Watch │
                     │  - Expiry Worker (Every 5s) │
                     └──────────────┬──────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
    ┌───────────────────────────────┐ ┌───────────────────────────────┐
    │  SQLite / PostgreSQL DB       │ │  WebSocket Live Broadcast     │
    │  (12 Relational Tables)       │ │  (/ws Dynamic Channel)        │
    └───────────────────────────────┘ └───────────────┬───────────────┘
                                                      ▼
                                      ┌───────────────────────────────┐
                                      │  React + TS Enterprise SaaS   │
                                      │  (Vite + Tailwind CSS v4)     │
                                      └───────────────────────────────┘
```

---

## 3. Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, React Router 7, Axios, Recharts, Lucide Icons, WebSocket client.
- **Backend**: Python 3.13, FastAPI, SQLAlchemy ORM, Pydantic v2, Uvicorn, Native WebSockets, Scapy.
- **Database**: SQLite (zero-setup default for local dev) + PostgreSQL ready via `DATABASE_URL`.
- **Machine Learning**: Scikit-Learn `RandomForestClassifier`, Pandas, NumPy, Joblib.
- **Microcontroller**: ESP32 C++ Arduino firmware, Wi-Fi Station Mode, REST HTTP client, DHT sensor support.
- **Security & Auth**: JWT (JSON Web Tokens via PyJWT), Bcrypt password hashing.

---

## 4. Key Features

1. **Mandatory Real ESP32 Integration**: Genuine, compilable Arduino firmware with automatic Wi-Fi watchdog, health-check verifier, JSON telemetry dispatch, and DHT sensor support.
2. **IoT Simulation Fleet**: 6 simulated hardware profiles (Smart Temp Sensor, Security Camera, Smart Light, Smart Plug, Simulated ESP32, ESP8266) with on-demand attack injection scenarios.
3. **Random Forest Machine Learning**: Mandatory Scikit-Learn model classifying telemetry as Normal or Suspicious with self-training fallback.
4. **0–100 Multi-Factor Risk Scoring**: Transparent scoring combining ML predictions, volumetric throughput, connection velocity, failed handshake spikes, and domain risk.
5. **Contacted Domain Heuristics**: Radial SVG gauge visualizing external endpoints, query counts, and transparent reason explanations.
6. **Automated Mitigation Containment**:
   - $\ge 81$ (Critical): Automated Permanent Block
   - $\ge 61$ (High): Automated Temporary Block (quarantine with live countdown timer)
   - $\ge 31$ (Medium): Alert Generated and Monitored
7. **Background Expiration Worker**: Async background loop expiring temporary blocks every 5 seconds and restoring normal communications automatically.
8. **Real-Time WebSocket Stream**: Live graph updates, new alerts, and status changes broadcast to all clients without page refresh.
9. **100% Deterministic CSV Reports**: Instant CSV exports for incidents, inventory, and network flow audits.
10. **Clean Enterprise SaaS Interface**: Minimal light background (`#f8fafc`), crisp white cards, dark sidebar, and responsive layout.

---

## 5. Quick Startup Guide (Step-by-Step Commands)

Follow these exact commands to run the entire platform locally on one laptop.

### Step 1: Open Project Directory
```powershell
cd C:\Users\muham\.gemini\antigravity-ide\scratch\netpulse-iot
```

### Step 2: Install Backend Dependencies
```powershell
python -m pip install -r backend/requirements.txt
```

### Step 3: Train / Validate the Random Forest Model
```powershell
$env:PYTHONPATH="C:\Users\muham\.gemini\antigravity-ide\scratch\netpulse-iot"
python ml/training/train_model.py
```
*(Note: If omitted, the backend will auto-train the model automatically on first boot!)*

### Step 4: Run Automated Verification Tests
```powershell
python -m pytest tests -v
```
*(Confirms 12/12 passing tests across Auth, ESP32 API, RF ML, Risk Engine, Blocking, and Simulation!)*

### Step 5: Start the FastAPI Backend Server
```powershell
$env:PYTHONPATH="C:\Users\muham\.gemini\antigravity-ide\scratch\netpulse-iot"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
The backend is now live at:
- **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

### Step 6: Start the React Frontend
Open a new terminal window:
```powershell
cd C:\Users\muham\.gemini\antigravity-ide\scratch\netpulse-iot\frontend
npm run dev
```
Navigate to: **[http://localhost:5173](http://localhost:5173)** in your browser!

---

## 6. Demo Login Credentials

The database is automatically initialized and seeded on first startup.

- **Email**: `admin@example.com`
- **Password**: `Admin@123`
- *(Or click the "Auto-Fill" button on the login screen for instant one-click login).*

---

## 7. Mandatory Physical ESP32 Microcontroller Setup

The ESP32 is a genuine, active part of the platform.

### Hardware Prerequisites
1. **ESP32 Development Board** (ESP32 Dev Module, NodeMCU-32S, ESP32-WROOM-32).
2. **USB Data Cable** connecting ESP32 to your computer.
3. *(Optional)* DHT11 or DHT22 sensor wired to **GPIO 4**. If no sensor is attached, the firmware automatically generates realistic environmental readings.

### Flashing Steps
1. Open **Arduino IDE (v2.x)**.
2. In **File $\rightarrow$ Preferences**, add the Espressif Board Manager URL:
   ```text
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Install **esp32** by Espressif in **Boards Manager**.
4. Find your laptop's local Wi-Fi IP address in PowerShell:
   ```powershell
   ipconfig
   ```
   *(Look for `IPv4 Address` under Wi-Fi, e.g., `192.168.1.150`).*
5. Open `esp32/esp32_firmware.ino` in Arduino IDE and configure your Wi-Fi and Laptop IP:
   ```cpp
   const char* WIFI_SSID     = "Your_WiFi_SSID";
   const char* WIFI_PASSWORD = "Your_WiFi_Password";
   const char* BACKEND_BASE_URL = "http://192.168.1.150:8000"; // Replace with your laptop's IP
   ```
6. Select your ESP32 board and COM port in **Tools $\rightarrow$ Port**.
7. Click **Upload**.
8. Open **Serial Monitor** at **`115200 baud`**.
9. Observe the ESP32 pinging `GET /api/health` and dispatching JSON events to `POST /api/device-events` every 10 seconds.
10. Open the web dashboard at `http://localhost:5173/devices` to see `esp32-001` live with **Source: Real**!

---

## 8. IoT Simulation Engine

In addition to the physical ESP32, the built-in simulator models a heterogeneous fleet:
- **HVAC Smart Temp Sensor** (`sim-temp-01`)
- **Entrance Security Camera** (`sim-cam-02`)
- **Conference Smart Light** (`sim-light-03`)
- **Server Rack Smart Plug** (`sim-plug-04`)
- **Environmental Air Quality Monitor** (`sim-env-05`)
- **Industrial IoT Edge Gateway** (`sim-gw-06`)

### On-Demand Scenarios
From the **Dashboard Quick Actions** or the top navigation bar:
- **Run Simulator**: Starts periodic background telemetry across all nodes.
- **Inject Attack**: Injects an anomalous volumetric flood / port scan pattern, triggering the Random Forest classifier and auto-quarantine!
- **Stop Simulator**: Suspends background generation.

---

## 9. Machine Learning Pipeline: Random Forest

The primary anomaly detection model is a Scikit-Learn **Random Forest Classifier**:
- **Dataset**: 12,000 balanced flow samples generated with realistic IoT network characteristics.
- **Features Analyzed (9)**:
  1. `traffic_volume` (Bytes)
  2. `packet_count`
  3. `request_frequency` (Requests per second)
  4. `connection_frequency` (Connections per minute)
  5. `failed_connections` (Handshake failure count)
  6. `protocol_num` (TCP=6, UDP=17)
  7. `destination_port`
  8. `event_rate` (Events per minute)
  9. `historical_alerts_count`
- **Explainable Predictions**: The system extracts exact rationale for every suspicious classification (e.g., *"Abnormally high traffic volume (120,000 bytes)"*, *"Multiple failed connection attempts (18 failures)"*).

---

## 10. Multi-Factor Risk Scoring Engine

Computes a normalized **0–100 composite risk score**:
- **0–30 (Low Risk)**: Standard operational baseline telemetry.
- **31–60 (Medium Risk)**: Minor volumetric or frequency deviation; logs alert and monitors.
- **61–80 (High Risk)**: Elevated anomaly; triggers **Automated Temporary Quarantine** (15 min default TTL).
- **81–100 (Critical Risk)**: Severe exploit/scan/flood; triggers **Automated Permanent Block**.

---

## 11. Testing & Validation

The project includes an automated test suite executed via `pytest`:
```powershell
python -m pytest tests -v
```

### Covered Test Cases:
- `test_auth.py`: Health ping, admin authentication, password rejection, analyst registration, JWT verification.
- `test_device_events.py`: ESP32 JSON ingestion, device auto-registration, telemetry persistence.
- `test_rf_model.py`: Random Forest classifier inference, confidence boundaries, decision factors.
- `test_risk_scoring.py`: Multi-factor composite score calculation, risk level mapping, transparent explanations.
- `test_blocking.py`: Manual IP blocking, temporary device blocking, background expiration worker simulation, unblock.
- `test_simulation.py`: Simulation status check, on-demand scenario injection (normal, high traffic, attack, rogue node).

---

## 12. Project Limitations & Future Improvements

### Current Limitations:
- Packet capture gracefully defaults to application metadata extraction when raw OS socket sniffing privileges are not granted.
- Blocking operates at the application and simulation layer by default for safety without altering the host OS firewall.

### Planned Improvements:
- Native Windows Filtering Platform (WFP) and Linux `nftables` kernel firewall kernel hooks.
- MQTT and CoAP native broker ingestion listeners.
- Embedded TLS hardware acceleration for ESP32-S3/C3 modules.
- Multi-tenant team role permissions (Viewer, Analyst, Administrator).
