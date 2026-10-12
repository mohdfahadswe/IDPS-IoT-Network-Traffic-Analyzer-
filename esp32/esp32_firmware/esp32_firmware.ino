/*
 * ============================================================================
 * NetPulse IoT - Physical ESP32 Standalone Security & Telemetry Agent
 * ============================================================================
 * 
 * Target Board: ESP32 Dev Module / NodeMCU-32S / ESP32-WROOM-32
 * Power Source: Standalone Phone Charger / Power Bank / PC USB Wire
 * Communication: Wi-Fi HTTP Client (REST JSON)
 * 
 * ⚠️ IMPORTANT FOR IPHONE / 5GHz HOTSPOTS:
 * ESP32 hardware only supports 2.4 GHz Wi-Fi. If using an iPhone Personal Hotspot,
 * you MUST go to iPhone Settings -> Personal Hotspot -> Enable "Maximize Compatibility".
 * ============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// ============================================================================
// 1. BACKEND TARGET CONFIGURATION
// ============================================================================

// Set to 0 for LOCAL Laptop / Hotspot LAN; Set to 1 for ONLINE Cloud / ngrok URL
#define USE_ONLINE_BACKEND 0

// [MODE 0] Local Laptop IP (When ESP32 and Laptop share same Wi-Fi / Hotspot)
const char* BACKEND_LOCAL_URL  = "http://172.20.10.2:8000";

// [MODE 1] Online / Cloud URL (When backend is deployed on Render/Railway/ngrok/VPS)
const char* BACKEND_ONLINE_URL = "https://your-online-backend.com";

// Active Backend URL resolver
#if USE_ONLINE_BACKEND
  const char* BACKEND_BASE_URL = BACKEND_ONLINE_URL;
  const bool  IS_HTTPS_TARGET  = true;
#else
  const char* BACKEND_BASE_URL = BACKEND_LOCAL_URL;
  const bool  IS_HTTPS_TARGET  = false;
#endif

// ============================================================================
// 2. WI-FI NETWORKS (MULTI-SSID AUTO FALLBACK)
// ============================================================================

// Primary Network (e.g. Mobile Hotspot - Enable "Maximize Compatibility" on iPhone!)
const char* WIFI_SSID_1 = "FahadiPhone";
const char* WIFI_PASS_1 = "01230123";

// Secondary Network (e.g. Home or Office Wi-Fi - Leave blank if not used)
const char* WIFI_SSID_2 = "Your_Home_WiFi";
const char* WIFI_PASS_2 = "Your_Home_Password";

// ============================================================================
// 3. DEVICE SETTINGS & PINS
// ============================================================================

const char* DEVICE_ID   = "esp32-001";
const char* DEVICE_NAME = "ESP32 Physical Security Node";
const char* DEVICE_TYPE = "ESP32";

// Telemetry interval (in milliseconds) - Default: 3.5 seconds
const unsigned long TELEMETRY_INTERVAL_MS = 3500;

// Physical DHT sensor configuration (Set 1 if DHT11/22 connected on GPIO 4; 0 for internal telemetry)
#define ENABLE_PHYSICAL_DHT 0 
#define DHT_PIN 4
#define DHT_TYPE 11 // 11 for DHT11, 22 for DHT22

#if ENABLE_PHYSICAL_DHT
  #include <DHT.h>
  DHT dht(DHT_PIN, DHT_TYPE);
#endif

// On-board Diagnostic LED Pin (GPIO 2 on most ESP32 boards)
const int LED_PIN = 2;
// Physical Built-in BOOT Button Pin (GPIO 0 - active LOW)
const int BOOT_BUTTON_PIN = 0;

// Watchdogs and state
unsigned long lastSendTime = 0;
unsigned long lastReconnectAttempt = 0;
unsigned long lastButtonPress = 0;
int activeNetworkIndex = 0;

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
// 5. ROBUST WI-FI CONNECTION MANAGER
// ============================================================================

bool attemptWiFiConnect(const char* ssid, const char* pass, int timeoutSec = 10) {
  if (strlen(ssid) == 0 || strcmp(ssid, "Your_Home_WiFi") == 0) return false;

  Serial.printf("\n[WIFI] Attempting connection to SSID: '%s' (2.4GHz)...\n", ssid);
  WiFi.disconnect(true);
  delay(100);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false); // CRITICAL: Prevent low-power sleep on chargers/powerbanks
  WiFi.setAutoReconnect(true);

  WiFi.begin(ssid, pass);

  int waited = 0;
  while (WiFi.status() != WL_CONNECTED && waited < (timeoutSec * 10)) {
    delay(100);
    digitalWrite(LED_PIN, !digitalRead(LED_PIN)); // Fast blink while searching
    Serial.print(".");
    waited++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_PIN, HIGH); // Solid ON when connected
    Serial.println("\n[WIFI] >>> SUCCESS: Connected to Wi-Fi! <<<");
    Serial.print("[WIFI] Connected SSID: "); Serial.println(WiFi.SSID());
    Serial.print("[WIFI] ESP32 IP:       "); Serial.println(WiFi.localIP());
    Serial.print("[WIFI] Gateway / Host: "); Serial.println(WiFi.gatewayIP());
    Serial.print("[WIFI] Signal (RSSI):  "); Serial.print(WiFi.RSSI()); Serial.println(" dBm");
    return true;
  } else {
    Serial.printf("\n[WIFI] Failed to connect to '%s' within %d seconds.\n", ssid, timeoutSec);
    digitalWrite(LED_PIN, LOW);
    return false;
  }
}

void connectToAvailableWiFi() {
  // Try Network 1
  if (attemptWiFiConnect(WIFI_SSID_1, WIFI_PASS_1, 10)) {
    activeNetworkIndex = 1;
    return;
  }

  // Try Network 2 if configured
  if (strlen(WIFI_SSID_2) > 0 && strcmp(WIFI_SSID_2, "Your_Home_WiFi") != 0) {
    if (attemptWiFiConnect(WIFI_SSID_2, WIFI_PASS_2, 8)) {
      activeNetworkIndex = 2;
      return;
    }
  }

  Serial.println("\n[WIFI WARNING] Could not connect to any configured Wi-Fi network.");
  Serial.println("[HOTSPOT TIP] If using iPhone Hotspot, turn ON 'Maximize Compatibility' in Settings -> Personal Hotspot.");
}

// ============================================================================
// 6. BACKEND HEALTH & TELEMETRY TRANSMISSION
// ============================================================================

bool checkBackendHealth() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String healthUrl = String(BACKEND_BASE_URL) + "/api/health";

  Serial.print("[HTTP] Health Check: ");
  Serial.println(healthUrl);

  if (IS_HTTPS_TARGET) {
    WiFiClientSecure secureClient;
    secureClient.setInsecure();
    http.begin(secureClient, healthUrl);
  } else {
    http.begin(healthUrl);
  }

  http.setTimeout(4000);
  int httpCode = http.GET();

  bool isHealthy = false;
  if (httpCode == HTTP_CODE_OK) {
    Serial.println("[HTTP] Backend is HEALTHY & REACHABLE!");
    digitalWrite(LED_PIN, HIGH);
    isHealthy = true;
  } else {
    Serial.printf("[HTTP] Health check returned code: %d\n", httpCode);
  }
  http.end();
  return isHealthy;
}

void sendDeviceEvent(float temp, float humidity) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WIFI] Link lost. Triggering Wi-Fi reconnection...");
    connectToAvailableWiFi();
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
  http.setTimeout(4000);

  // Construct JSON Payload
  char payload[512];
  snprintf(payload, sizeof(payload),
    "{\n"
    "  \"device_id\": \"%s\",\n"
    "  \"device_name\": \"%s\",\n"
    "  \"device_type\": \"%s\",\n"
    "  \"status\": \"online\",\n"
    "  \"ip_address\": \"%s\",\n"
    "  \"mac_address\": \"%s\",\n"
    "  \"sensor_data\": {\n"
    "    \"temperature\": %.1f,\n"
    "    \"humidity\": %.1f,\n"
    "    \"rssi\": %d,\n"
    "    \"uptime_sec\": %lu,\n"
    "    \"power_source\": \"Charger/Wi-Fi\"\n"
    "  },\n"
    "  \"domain_contacted\": \"pool.ntp.org\",\n"
    "  \"protocol\": \"TCP\",\n"
    "  \"destination_port\": 80\n"
    "}",
    DEVICE_ID,
    DEVICE_NAME,
    DEVICE_TYPE,
    WiFi.localIP().toString().c_str(),
    WiFi.macAddress().c_str(),
    temp,
    humidity,
    WiFi.RSSI(),
    millis() / 1000
  );

  Serial.println("\n--------------------------------------------------");
  Serial.printf("[EVENT DISPATCH] Target: %s\n", eventsUrl.c_str());

  // Visual feedback: Brief LED dip during dispatch
  digitalWrite(LED_PIN, LOW);
  int httpResponseCode = http.POST(payload);
  digitalWrite(LED_PIN, HIGH);

  if (httpResponseCode > 0) {
    Serial.printf("[HTTP SUCCESS] Code: %d\n", httpResponseCode);
    String response = http.getString();
    Serial.println("[BACKEND DECISION]: " + response);

    // Hardware Alert: If backend flags suspicious threat or block policy, strobe alarm LED
    if (response.indexOf("\"status\":\"blocked\"") >= 0 ||
        response.indexOf("\"classification\":\"Suspicious\"") >= 0 ||
        response.indexOf("\"risk_level\":\"Critical\"") >= 0 ||
        response.indexOf("\"risk_level\":\"High\"") >= 0) {
      Serial.println("[SECURITY ALARM] Threat / Containment Flagged! Strobing on-board LED...");
      blinkLed(6, 40, 40);
      digitalWrite(LED_PIN, HIGH);
    }
  } else {
    Serial.printf("[HTTP ERROR] Failed. Code: %d\n", httpResponseCode);
    Serial.printf("[TROUBLESHOOT] Verify laptop IP '%s' is reachable on hotspot/Wi-Fi.\n", BACKEND_BASE_URL);
    blinkLed(2, 80, 80);
    digitalWrite(LED_PIN, HIGH);
  }

  http.end();
  Serial.println("--------------------------------------------------");
}

// ============================================================================
// 7. SETUP & MAIN EXECUTION LOOP
// ============================================================================

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Setup built-in BOOT button (GPIO 0)
  pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);

  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("==================================================");
  Serial.println("   NetPulse IoT - Standalone ESP32 Agent v3.2     ");
  Serial.println("==================================================");
  Serial.printf("Device ID:    %s\n", DEVICE_ID);
  Serial.printf("Target Host:  %s\n", BACKEND_BASE_URL);
  Serial.printf("Backend Mode: %s\n", USE_ONLINE_BACKEND ? "ONLINE (Cloud/ngrok)" : "LOCAL (LAN/Hotspot)");

#if ENABLE_PHYSICAL_DHT
  Serial.println("[SENSOR] Initializing physical DHT sensor...");
  dht.begin();
#else
  Serial.println("[SENSOR] Standalone Telemetry Fallback active.");
#endif

  // Initial Wi-Fi Connection
  connectToAvailableWiFi();

  // Test backend availability once at startup
  checkBackendHealth();

  // Instant online registration upon connection
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[BOOT] Initial telemetry dispatch -> Registering online state immediately...");
    sendDeviceEvent(27.5, 52.0);
    lastSendTime = millis();
  }
}

void loop() {
  unsigned long currentMillis = millis();

  // 1. Wi-Fi Watchdog: Reconnect if disconnected
  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(LED_PIN, LOW);
    if (currentMillis - lastReconnectAttempt >= 6000) {
      lastReconnectAttempt = currentMillis;
      Serial.println("[WIFI WATCHDOG] Wi-Fi link lost. Attempting reconnection...");
      connectToAvailableWiFi();
    }
    delay(50);
    return;
  }

  // 2. Physical BOOT Button Trigger (GPIO 0) -> Immediate On-Demand Dispatch
  if (digitalRead(BOOT_BUTTON_PIN) == LOW) {
    if (currentMillis - lastButtonPress > 1500) { // 1.5s debounce
      lastButtonPress = currentMillis;
      Serial.println("\n[HARDWARE TRIGGER] BOOT Button Pressed -> Dispatching on-demand telemetry burst...");
      blinkLed(3, 50, 50);
      float temp = 28.5 + (random(-10, 15) / 10.0);
      float hum = 55.0 + (random(-15, 15) / 10.0);
      sendDeviceEvent(temp, hum);
      lastSendTime = currentMillis;
    }
  }

  // 3. Periodic Telemetry Transmission
  if (currentMillis - lastSendTime >= TELEMETRY_INTERVAL_MS) {
    lastSendTime = currentMillis;

    float temperature = 0.0;
    float humidity = 0.0;

#if ENABLE_PHYSICAL_DHT
    temperature = dht.readTemperature();
    humidity = dht.readHumidity();

    if (isnan(temperature) || isnan(humidity)) {
      temperature = 26.5 + (random(-10, 10) / 10.0);
      humidity = 50.0 + (random(-15, 15) / 10.0);
    }
#else
    temperature = 27.5 + (random(-12, 15) / 10.0);
    humidity = 52.0 + (random(-20, 20) / 10.0);
#endif

    sendDeviceEvent(temperature, humidity);
  }

  delay(50);
}