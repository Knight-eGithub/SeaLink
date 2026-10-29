#include <Arduino.h>
#include <WiFi.h>
#include "radio/RadioDriver.h"
#include "routing/RouteTable.h"
#include "api/GatewayServer.h"
#include "config/CloudConfig.h"
#include "sensors/SensorManager.h"

// Set to true on the ESP32 acting as the Coastal Shore Station (Cloud Bridge)
// Set to false on ESP32s deployed on boats
#define IS_SHORE_GATEWAY false

// Set Vessel ID (e.g. "BOAT-001" for Vessel 1, "BOAT-104" for Vessel 2)
#define THIS_BOAT_ID "BOAT-001"

RadioDriver radio;
RouteTable routes;
SensorManager sensors;
GatewayServer gateway(radio, routes, IS_SHORE_GATEWAY ? "SHORE-BASE" : THIS_BOAT_ID);

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n==============================================");
    Serial.println("  SeaLink Maritime LoRa Gateway with SOS Mesh");
    Serial.printf("  Node Type: %s\n", IS_SHORE_GATEWAY ? "COASTAL SHORE STATION (SUPABASE BRIDGE)" : "VESSEL GATEWAY");
    Serial.println("==============================================");

    // 1. Initialize Onboard Hardware Sensors (GPS, MQ-135 Gas, MPU6050, OLED)
    Serial.println("[Setup Step 1/3] Initializing Onboard Hardware Sensors...");
    sensors.begin();
    gateway.setSensors(&sensors);

    // 2. Initialize proven SX1278 SPI LoRa radio
    Serial.println("[Setup Step 2/3] Initializing SX1278 LoRa Transceiver...");
    if (!radio.begin()) {
        Serial.println("[CRITICAL] LoRa radio offline! Continuing to Wi-Fi SoftAP...");
    } else {
        Serial.println("[LoRa OK] SX1278 radio ready for RF mesh communication.");
    }

    // 2. Configure Shore Mode and connect to Internet Wi-Fi (if Shore Node)
    if (IS_SHORE_GATEWAY) {
        gateway.setShoreStationMode(true, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_TABLE);

        Serial.printf("[INTERNET] Connecting Shore Station to Wi-Fi SSID '%s'...\n", SHORE_WIFI_SSID);
        WiFi.begin(SHORE_WIFI_SSID, SHORE_WIFI_PASSWORD);

        int attempts = 0;
        while (WiFi.status() != WL_CONNECTED && attempts < 15) {
            delay(500);
            Serial.print(".");
            attempts++;
        }
        Serial.println();

        if (WiFi.status() == WL_CONNECTED) {
            Serial.printf("[INTERNET CONNECTED] Shore Station Online. IP: %s\n", WiFi.localIP().toString().c_str());
            Serial.printf("[SUPABASE LINK] Configured Target: %s/rest/v1/%s\n", SUPABASE_URL, SUPABASE_TABLE);
        } else {
            Serial.println("[INTERNET WARNING] Could not connect to Wi-Fi. SOS will be logged locally and retried.");
        }
    }

    // 3. Start local SoftAP for crew or base operator phones (SSID and IP auto-derived from boat ID)
    Serial.println("[Setup Step 3/3] Launching Local Wi-Fi Access Point and Web Server...");
    gateway.begin(nullptr, "maritime123");

    Serial.printf("[READY] %s listening for 433 MHz LoRa radio traffic.\n",
                  IS_SHORE_GATEWAY ? "Shore Station" : "Boat Gateway");
}

void loop() {
    sensors.update();
    gateway.loop();

    sensors.updateOled(
        IS_SHORE_GATEWAY ? "SHORE-BASE" : "BOAT-001",
        radio.isReady() ? "OK" : "ERR",
        gateway.getPacketsSent(),
        gateway.getPacketsReceived()
    );

    delay(2);
}
