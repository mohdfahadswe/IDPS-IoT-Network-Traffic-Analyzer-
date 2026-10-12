# Physical ESP32 Integration & Setup Guide

This guide details the complete process for flashing, configuring, and verifying the **physical ESP32 microcontroller** with the **NetPulse IoT Platform**.

---

## 📋 Hardware Requirements

1. **ESP32 Development Board** (ESP32-WROOM-32, NodeMCU-32S, or ESP32-CAM).
2. **Micro-USB or USB-C Data Cable** (Ensure the cable supports data transfer, not just power charging).
3. **Optional Sensor**: DHT11 or DHT22 temperature and humidity sensor.
   - *Note*: If no sensor is attached, the firmware automatically falls back to internal environmental telemetry and functions 100% identically.
4. **Host Computer**: Running the NetPulse FastAPI backend connected to the same Wi-Fi network.

---

## 🛠️ Step 1: Arduino IDE & ESP32 Board Package Setup

1. Download and install **[Arduino IDE (v2.x)](https://www.arduino.cc/en/software)**.
2. Open Arduino IDE and navigate to:
   - **File** $\rightarrow$ **Preferences** (Windows: `Ctrl + ,`).
3. In the **Additional boards manager URLs** field, paste the official Espressif URL:
   ```text
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Click **OK**.
5. Navigate to **Tools** $\rightarrow$ **Board** $\rightarrow$ **Boards Manager...** (or click the Boards icon in the left toolbar).
6. Search for `esp32` by **Espressif Systems** and click **Install**.

---

## 🔌 Step 2: Connect ESP32 to Laptop

1. Connect the ESP32 board to your computer via USB.
2. If your computer does not recognize the device, install the CP210x or CH340 USB-to-UART driver:
   - **CP2102 Driver**: [Silicon Labs CP210x Drivers](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)
   - **CH340 Driver**: [WCH CH340 Driver](http://www.wch-ic.com/downloads/CH341SER_EXE.html)
3. In Arduino IDE, navigate to:
   - **Tools** $\rightarrow$ **Board** $\rightarrow$ **esp32** $\rightarrow$ select **ESP32 Dev Module**.
   - **Tools** $\rightarrow$ **Port** $\rightarrow$ select the COM port assigned to the ESP32 (e.g., `COM3`, `COM4`, etc.).

---

## 🌐 Step 3: Find Your Laptop's Local Wi-Fi IP Address

The ESP32 communicates with the backend over local Wi-Fi.

> [!IMPORTANT]
> **Do not use `localhost` or `127.0.0.1`** in the ESP32 firmware. Microcontrollers reside on their own IP and must target the host laptop's local LAN IP.

1. Open PowerShell on your laptop and run:
   ```powershell
   ipconfig
   ```
2. Locate the **Wireless LAN adapter Wi-Fi** section and note your **IPv4 Address** (for example: `192.168.1.150`).

---

## 🔋 Standalone Operation (Power Bank / Phone Charger)

The ESP32 is engineered to run **completely standalone**:
- Plug the ESP32 directly into a **USB Power Bank**, **5V Wall Charger**, or **Car USB adapter**.
- No PC or serial connection is required after initial flashing.
- The on-board **Blue LED (GPIO 2)** provides real-time hardware status:
  - 🔄 **Pulsing / Blinking**: Connecting to Wi-Fi.
  - 🟢 **Solid ON**: Wi-Fi connected and actively streaming to backend.
  - 💡 **Brief Flash**: Data packet transmitted successfully.
  - ⚠️ **Double-Blink**: Backend unreachable / packet dropped.

---

## ⚙️ Easy Switching: Local vs. Online Cloud Backend

Open `esp32/esp32_firmware.ino` in Arduino IDE to configure your target mode:

```cpp
// ============================================================================
// 1. BACKEND TARGET CONFIGURATION (EASY SWITCH)
// ============================================================================

// Set to 0 for LOCAL Laptop / Hotspot; Set to 1 for ONLINE Cloud / ngrok URL
#define USE_ONLINE_BACKEND 0

// [MODE 0] Local Laptop IP (When sharing same Wi-Fi / iPhone Hotspot)
const char* BACKEND_LOCAL_URL  = "http://172.20.10.2:8000";

// [MODE 1] Online / Cloud URL (When backend is deployed on Render/Railway/ngrok/VPS)
const char* BACKEND_ONLINE_URL = "https://your-online-backend.onrender.com";
```

### 📶 Multi-Wi-Fi Network Auto-Discovery:
You can store multiple Wi-Fi networks (e.g. your iPhone Hotspot AND your Home Wi-Fi). The ESP32 will automatically connect to whichever is available:

```cpp
// Primary Network (e.g. Mobile Hotspot)
const char* WIFI_SSID_1 = "FahadiPhone";
const char* WIFI_PASS_1 = "01230123";

// Secondary Network (e.g. Home Wi-Fi)
const char* WIFI_SSID_2 = "Your_Home_WiFi";
const char* WIFI_PASS_2 = "Your_Home_Password";
```

---

## 🚀 Step 5: Upload Firmware & Monitor Serial Log

1. Click the **Upload** button (Arrow icon) in Arduino IDE.
   - *Tip*: If the terminal shows `Connecting........_____.....`, press and hold the **BOOT** button on the ESP32 for 2 seconds until the upload progress percentage begins.
2. Once upload completes (`Done uploading`), open the **Serial Monitor**:
   - **Tools** $\rightarrow$ **Serial Monitor** (or `Ctrl + Shift + M`).
   - Set the baud rate in the bottom right corner to **`115200 baud`**.
3. Press the **EN** or **RST** button on the ESP32 to restart.

### Expected Serial Monitor Output:
```text
==================================================
   NetPulse IoT - Physical ESP32 Agent v2.4       
==================================================
Device ID:   esp32-001
Target Host: http://192.168.1.150:8000
[WIFI] Connecting to SSID: Your_WiFi_Name
....
[WIFI] Successfully connected to Wi-Fi network!
[WIFI] ESP32 Assigned IP: 192.168.1.75
[WIFI] ESP32 MAC Address:  24:6F:28:B1:C2:34
[WIFI] Signal Strength (RSSI): -52 dBm

[HTTP] Verifying Backend Health: http://192.168.1.150:8000/api/health
[HTTP] Backend is HEALTHY and REACHABLE!
[HTTP] Response: {"status":"healthy","service":"NetPulse IoT Security Platform",...}

--------------------------------------------------
[EVENT DISPATCH] Sending to: http://192.168.1.150:8000/api/device-events
[PAYLOAD]
{
  "device_id": "esp32-001",
  "device_name": "ESP32 Physical Security Node",
  "device_type": "ESP32",
  "status": "online",
  "ip_address": "192.168.1.75",
  "mac_address": "24:6F:28:B1:C2:34",
  "sensor_data": {
    "temperature": 27.2,
    "humidity": 53.0,
    "rssi": -52,
    "uptime_sec": 10
  },
  "domain_contacted": "pool.ntp.org",
  "protocol": "TCP",
  "destination_port": 80
}
[HTTP SUCCESS] Response Code: 200
[BACKEND DECISION]: {"status":"success","device_id":"esp32-001","classification":"Normal","risk_score":12.0,...}
--------------------------------------------------
```

---

## 🔍 Step 6: Verify in NetPulse Web Dashboard

1. Navigate to `http://localhost:5173/devices`.
2. Observe `esp32-001` labeled with **Source: Real** and **Type: ESP32**.
3. View real-time temperature telemetry and live packet metrics updating continuously over WebSockets!
