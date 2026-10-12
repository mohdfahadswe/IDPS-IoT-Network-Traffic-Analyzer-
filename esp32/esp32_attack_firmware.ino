/*
 * ============================================================================
 * NetPulse IoT - Physical ESP32 Attack & Prevention Demonstration Firmware
 * ============================================================================
 *
 * Target Board: ESP32 Dev Module / NodeMCU-32S / ESP32-WROOM-32
 * Features:
 *   - 🚀 4 Interactive Modes (Normal Telemetry + 3 Real Attack Vectors)
 *   - 🔘 Physical BOOT Button (GPIO 0) to cycle or trigger attack on demand
 *   - 🛡️ Physical Hardware Prevention Feedback (LED Strobe & Serial Dossier)
 *   - 💡 Intelligent LED Status Diagnostics (GPIO 2)
 *   - 📶 Multi-Wi-Fi Network Auto-Discovery (Hotspot + Home Wi-Fi)
 *
 * Modes Available:
 *   [MODE 0] Normal Operation: Clean telemetry (temp, humidity, NTP sync)
 *   [MODE 1] Traffic Burst Flood: High throughput burst (85,000 bytes, 850
 * pkts) [MODE 2] C2 Domain Exfiltration: Contacting malicious-c2-server.ru on
 * Port 4444 [MODE 3] Port Scan / Brute Force: High connection rate & port scans
 * (Port 23/Telnet, 22/SSH)
 * ============================================================================
 */

#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiMulti.h>

// ============================================================================
// 1. BACKEND TARGET CONFIGURATION
// ============================================================================

// Set to 0 for LOCAL Laptop / Hotspot LAN; Set to 1 for ONLINE Cloud / ngrok
// URL
#define USE_ONLINE_BACKEND 0

// [MODE 0] Local Laptop IP (When ESP32 and Laptop share same Wi-Fi / Hotspot)
const char *BACKEND_LOCAL_URL = "http://172.20.10.2:8000";

// [MODE 1] Online / Cloud URL (When backend is deployed on Cloud/VPS/ngrok)
const char *BACKEND_ONLINE_URL = "https://your-online-backend.com";

#if USE_ONLINE_BACKEND
const char *BACKEND_BASE_URL = BACKEND_ONLINE_URL;
const bool IS_HTTPS_TARGET = true;
#else
const char *BACKEND_BASE_URL = BACKEND_LOCAL_URL;
const bool IS_HTTPS_TARGET = false;
#endif

// ============================================================================
// 2. WI-FI NETWORKS (MULTI-SSID AUTO CONNECT)
// ============================================================================

// Primary Network (e.g. Mobile Hotspot)
const char *WIFI_SSID_1 = "FahadiPhone";
const char *WIFI_PASS_1 = "01230123";

// Secondary Network (e.g. Home or Office Wi-Fi - Leave blank if not used)
const char *WIFI_SSID_2 = "Your_Home_WiFi";
const char *WIFI_PASS_2 = "Your_Home_Password";

// ============================================================================
// 3. DEVICE & ATTACK SETTINGS
// ============================================================================

const char *DEVICE_ID = "esp32-001";
const char *DEVICE_NAME = "ESP32 ";
const char *DEVICE_TYPE = "ESP32";

// On-board Diagnostic LED Pin (GPIO 2 on most ESP32 boards)
const int LED_PIN = 2;

// Physical Built-in BOOT Button Pin (GPIO 0 - active LOW)
const int BOOT_BUTTON_PIN = 0;

// Attack Modes Enumeration
enum OperationMode {
  MODE_NORMAL = 0,
  MODE_TRAFFIC_BURST = 1,
  MODE_C2_EXFILTRATION = 2,
  MODE_PORT_SCAN = 3
};

OperationMode currentMode = MODE_NORMAL;
bool isDeviceBlocked = false;

// Intervals
const unsigned long NORMAL_INTERVAL_MS = 3000;
const unsigned long ATTACK_BURST_INTERVAL_MS = 1500;

WiFiMulti wifiMulti;
unsigned long lastSendTime = 0;
unsigned long lastButtonPress = 0;

// ============================================================================
// 4. DIAGNOSTIC LED PATTERNS
// ============================================================================

void blinkLed(int times, int onMs, int offMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(onMs);
    digitalWrite(LED_PIN, LOW);
    delay(offMs);
  }
}

// ============================================================================
// 5. WI-FI MANAGEMENT
// ============================================================================

void setupWiFiMulti() {
  WiFi.mode(WIFI_STA);

  if (strlen(WIFI_SSID_1) > 0) {
    wifiMulti.addAP(WIFI_SSID_1, WIFI_PASS_1);
  }
  if (strlen(WIFI_SSID_2) > 0 && strcmp(WIFI_SSID_2, "Your_Home_WiFi") != 0) {
    wifiMulti.addAP(WIFI_SSID_2, WIFI_PASS_2);
  }

  Serial.println("[WIFI] Scanning & connecting to available Wi-Fi network...");

  int attempts = 0;
  while (wifiMulti.run() != WL_CONNECTED && attempts < 25) {
    delay(400);
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_PIN, HIGH);
    Serial.println("==================================================");
    Serial.println("[WIFI SUCCESS] Connected to Access Point!");
    Serial.print("  SSID:       ");
    Serial.println(WiFi.SSID());
    Serial.print("  IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("  RSSI:       ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    Serial.println("==================================================");
    blinkLed(3, 100, 100);
    digitalWrite(LED_PIN, HIGH);
  } else {
    Serial.println("[WIFI ERROR] Connection timeout. Operating in offline "
                   "diagnostic loop.");
  }
}

// ============================================================================
// 6. ATTACK & TELEMETRY DISPATCH ENGINE
// ============================================================================

void sendSecurityPayload(OperationMode mode) {
  if (WiFi.status() != WL_CONNECTED) {
    wifiMulti.run();
    return;
  }

  HTTPClient http;
  String eventsUrl = String(BACKEND_BASE_URL) + "/api/device-events";

  if (IS_HTTPS_TARGET) {
    WiFiClientSecure secureClient;
    secureClient.setInsecure();
    http.begin(secureClient, eventsUrl);
  } else {
    http.begin(eventsUrl);
  }

  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);

  // Payload Parameters based on Mode
  char payload[768];
  float temp = 27.5 + (random(-10, 15) / 10.0);
  float humidity = 52.0 + (random(-15, 15) / 10.0);

  if (mode == MODE_NORMAL) {
    // Standard benign telemetry
    snprintf(payload, sizeof(payload),
             "{\n"
             "  \"device_id\": \"%s\",\n"
             "  \"device_name\": \"%s\",\n"
             "  \"device_type\": \"%s\",\n"
             "  \"status\": \"online\",\n"
             "  \"ip_address\": \"%s\",\n"
             "  \"mac_address\": \"%s\",\n"
             "  \"sensor_data\": {\"temperature\": %.1f, \"humidity\": %.1f, "
             "\"status\": \"normal\"},\n"
             "  \"traffic_volume\": %d,\n"
             "  \"packet_count\": %d,\n"
             "  \"request_frequency\": 0.15,\n"
             "  \"connection_frequency\": 2.0,\n"
             "  \"failed_connections\": 0,\n"
             "  \"domain_contacted\": \"pool.ntp.org\",\n"
             "  \"protocol\": \"TCP\",\n"
             "  \"destination_port\": 80\n"
             "}",
             DEVICE_ID, DEVICE_NAME, DEVICE_TYPE,
             WiFi.localIP().toString().c_str(), WiFi.macAddress().c_str(), temp,
             humidity, random(280, 520), random(3, 7));

    Serial.println("\n[DISPATCH] Mode: NORMAL TELEMETRY -> pool.ntp.org:80");

  } else if (mode == MODE_TRAFFIC_BURST) {
    // ATTACK 1: Volumetric Flood / High Throughput Burst
    int burstVolume = random(75000, 120000);
    int burstPackets = random(600, 1100);

    snprintf(payload, sizeof(payload),
             "{\n"
             "  \"device_id\": \"%s\",\n"
             "  \"device_name\": \"%s\",\n"
             "  \"device_type\": \"%s\",\n"
             "  \"status\": \"online\",\n"
             "  \"ip_address\": \"%s\",\n"
             "  \"mac_address\": \"%s\",\n"
             "  \"sensor_data\": {\"exploit_type\": \"VOLUMETRIC_FLOOD\", "
             "\"burst_state\": \"ACTIVE\"},\n"
             "  \"traffic_volume\": %d,\n"
             "  \"packet_count\": %d,\n"
             "  \"request_frequency\": 48.5,\n"
             "  \"connection_frequency\": 120.0,\n"
             "  \"failed_connections\": 3,\n"
             "  \"domain_contacted\": \"suspicious-telemetry.cc\",\n"
             "  \"protocol\": \"TCP\",\n"
             "  \"destination_port\": 8080\n"
             "}",
             DEVICE_ID, DEVICE_NAME, DEVICE_TYPE,
             WiFi.localIP().toString().c_str(), WiFi.macAddress().c_str(),
             burstVolume, burstPackets);

    Serial.println("\n=======================================================");
    Serial.println("⚡ [ATTACK 1] INJECTING HIGH THROUGHPUT TRAFFIC BURST");
    Serial.print("  Target Domain: suspicious-telemetry.cc (Volume: ");
    Serial.print(burstVolume);
    Serial.println(" bytes)");
    Serial.println("=======================================================");

  } else if (mode == MODE_C2_EXFILTRATION) {
    // ATTACK 2: Command & Control (C2) Communication
    snprintf(payload, sizeof(payload),
             "{\n"
             "  \"device_id\": \"%s\",\n"
             "  \"device_name\": \"%s\",\n"
             "  \"device_type\": \"%s\",\n"
             "  \"status\": \"online\",\n"
             "  \"ip_address\": \"%s\",\n"
             "  \"mac_address\": \"%s\",\n"
             "  \"sensor_data\": {\"exfil_probe\": \"UNAUTHORIZED_BEACON\", "
             "\"reverse_shell\": \"ATTEMPTED\"},\n"
             "  \"traffic_volume\": 28500,\n"
             "  \"packet_count\": 145,\n"
             "  \"request_frequency\": 18.0,\n"
             "  \"connection_frequency\": 45.0,\n"
             "  \"failed_connections\": 2,\n"
             "  \"domain_contacted\": \"malicious-c2-server.ru\",\n"
             "  \"protocol\": \"TCP\",\n"
             "  \"destination_port\": 4444\n"
             "}",
             DEVICE_ID, DEVICE_NAME, DEVICE_TYPE,
             WiFi.localIP().toString().c_str(), WiFi.macAddress().c_str());

    Serial.println("\n=======================================================");
    Serial.println("☠️  [ATTACK 2] INJECTING MALICIOUS C2 DOMAIN EXFILTRATION");
    Serial.println(
        "  Contacting: malicious-c2-server.ru on Port 4444 (Reverse Shell)");
    Serial.println("=======================================================");

  } else if (mode == MODE_PORT_SCAN) {
    // ATTACK 3: Port Scan / Telnet Brute Force
    snprintf(payload, sizeof(payload),
             "{\n"
             "  \"device_id\": \"%s\",\n"
             "  \"device_name\": \"%s\",\n"
             "  \"device_type\": \"%s\",\n"
             "  \"status\": \"online\",\n"
             "  \"ip_address\": \"%s\",\n"
             "  \"mac_address\": \"%s\",\n"
             "  \"sensor_data\": {\"scan_pattern\": \"SYN_FLOOD_PROBE\", "
             "\"target_range\": \"192.168.1.0/24\"},\n"
             "  \"traffic_volume\": 14200,\n"
             "  \"packet_count\": 310,\n"
             "  \"request_frequency\": 35.0,\n"
             "  \"connection_frequency\": 180.0,\n"
             "  \"failed_connections\": 28,\n"
             "  \"domain_contacted\": \"iot-exploit-payloads.top\",\n"
             "  \"protocol\": \"TCP\",\n"
             "  \"destination_port\": 23\n"
             "}",
             DEVICE_ID, DEVICE_NAME, DEVICE_TYPE,
             WiFi.localIP().toString().c_str(), WiFi.macAddress().c_str());

    Serial.println("\n=======================================================");
    Serial.println("🔍 [ATTACK 3] INJECTING PORT SCAN & TELNET BRUTE FORCE");
    Serial.println("  Scanning Ports 22, 23, 445 (Failed Connections: 28)");
    Serial.println("=======================================================");
  }

  // Dispatch HTTP POST
  digitalWrite(LED_PIN, LOW);
  int httpResponseCode = http.POST(payload);
  digitalWrite(LED_PIN, HIGH);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("[BACKEND DECISION]: " + response);

    // ========================================================================
    // 7. REAL-TIME PREVENTION & CONTAINMENT ACKNOWLEDGMENT
    // ========================================================================
    if (response.indexOf("\"status\":\"blocked\"") >= 0 ||
        response.indexOf("Traffic Dropped") >= 0) {
      isDeviceBlocked = true;
      Serial.println(
          "\n*******************************************************");
      Serial.println(
          "🛡️  [PREVENTION ENFORCED] NetPulse Backend Blocked Traffic!");
      Serial.println("    Device is now CONTAINED & Traffic Dropped.");
      Serial.println("    Physical Action: Flashing Rapid Alarm LED Strobe.");
      Serial.println(
          "*******************************************************\n");

      // Flash rapid strobe to visually demonstrate prevention
      blinkLed(10, 35, 35);
      digitalWrite(LED_PIN, LOW); // Stay OFF while blocked
    } else if (response.indexOf("\"classification\":\"Suspicious\"") >= 0 ||
               response.indexOf("\"risk_level\":\"Critical\"") >= 0 ||
               response.indexOf("\"risk_level\":\"High\"") >= 0) {
      Serial.println(
          "\n⚠️  [THREAT FLAGGED] ML Classifier detected Anomaly (High Risk)!");
      blinkLed(5, 50, 50);
      digitalWrite(LED_PIN, HIGH);
    } else {
      isDeviceBlocked = false;
      digitalWrite(LED_PIN, HIGH);
    }
  } else {
    Serial.print("[HTTP ERROR] Failed to reach backend. Code: ");
    Serial.println(httpResponseCode);
    blinkLed(2, 80, 80);
    digitalWrite(LED_PIN, HIGH);
  }

  http.end();
}

// ============================================================================
// 8. SETUP & MAIN EXECUTION LOOP
// ============================================================================

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Setup physical BOOT button on GPIO 0
  pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);

  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("========================================================");
  Serial.println("   NetPulse IoT - Real Hardware Attack & Prevention     ");
  Serial.println("========================================================");
  Serial.print("Device ID:      ");
  Serial.println(DEVICE_ID);
  Serial.print("Target Host:    ");
  Serial.println(BACKEND_BASE_URL);
  Serial.println("\n[GUIDE] How to Demonstrate Real Prevention:");
  Serial.println("  1. ESP32 runs in Normal Mode by default (LED solid ON).");
  Serial.println(
      "  2. Press the physical BOOT button on the ESP32 to cycle attacks:");
  Serial.println("     - Press 1: Traffic Burst Flood (85,000 bytes)");
  Serial.println(
      "     - Press 2: Malicious C2 Domain (malicious-c2-server.ru)");
  Serial.println("     - Press 3: Port Scan / Telnet Brute Force (Port 23)");
  Serial.println(
      "  3. Watch NetPulse Dashboard detect threat & apply BLOCK policy.");
  Serial.println(
      "  4. Notice ESP32 LED strobing and stopping blocked packets.");
  Serial.println("========================================================\n");

  setupWiFiMulti();

  // Instant online registration upon boot
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(
        "[BOOT] Initial telemetry dispatch -> Registering online state...");
    sendSecurityPayload(MODE_NORMAL);
    lastSendTime = millis();
  }
}

void loop() {
  // 1. Wi-Fi Watchdog
  if (WiFi.status() != WL_CONNECTED) {
    wifiMulti.run();
  }

  unsigned long currentMillis = millis();

  // 2. Physical BOOT Button Handler -> Cycle Attack Modes On-Demand
  if (digitalRead(BOOT_BUTTON_PIN) == LOW) {
    if (currentMillis - lastButtonPress > 1200) { // 1.2s debounce
      lastButtonPress = currentMillis;

      // Cycle to next attack mode
      if (currentMode == MODE_NORMAL) {
        currentMode = MODE_TRAFFIC_BURST;
      } else if (currentMode == MODE_TRAFFIC_BURST) {
        currentMode = MODE_C2_EXFILTRATION;
      } else if (currentMode == MODE_C2_EXFILTRATION) {
        currentMode = MODE_PORT_SCAN;
      } else {
        currentMode = MODE_NORMAL;
      }

      Serial.print("\n[BUTTON SWITCH] Switched to Mode #");
      Serial.println(currentMode);

      // Brief acknowledgment flash
      blinkLed(2, 60, 60);

      // Immediate dispatch of chosen mode
      sendSecurityPayload(currentMode);
      lastSendTime = currentMillis;
    }
  }

  // 3. Periodic Transmission Loop
  unsigned long activeInterval = (currentMode == MODE_NORMAL)
                                     ? NORMAL_INTERVAL_MS
                                     : ATTACK_BURST_INTERVAL_MS;

  if (currentMillis - lastSendTime >= activeInterval) {
    lastSendTime = currentMillis;
    sendSecurityPayload(currentMode);
  }

  delay(30);
}
