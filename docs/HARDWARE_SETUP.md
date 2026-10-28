# SeaLink — Complete Hardware Setup & Gateway Flashing Guide

## 1. Complete System Circuit & Pinout (From Schematic)

The gateway connects the **ESP32 DevKit V1** to the SX1278 LoRa transceiver and 4 onboard sensors via SPI, I2C, UART, and GPIO:

### A. Power Rails
- **Common GND**: Tied across all modules, sensors, and ESP32 GND pins.
- **5V / VIN Supply**: Powers MQ-135 Gas Sensor VCC and GPS Module VCC.
- **3.3V Supply**: Powers SX1278 LoRa VCC, MPU6050 VCC, and OLED Display VCC.
> ⚠️ **CRITICAL WARNING**: Never connect 5V to the SX1278 LoRa module or MPU6050! They are 3.3V devices and 5V will destroy them.

---

### B. Pinout Interconnection Table

| Module | Module Pin | ESP32 GPIO | Bus / Protocol | Purpose / Function |
| :--- | :--- | :--- | :--- | :--- |
| **SX1278 LoRa** | VCC | **3V3** | Power | 3.3V Radio Power |
| | GND | **GND** | Power | Common Ground |
| | NSS / CS | **GPIO 5** | SPI CS | Chip Select |
| | RST | **GPIO 14** | GPIO | Hardware Reset |
| | DIO0 | **GPIO 26** | Interrupt | Packet Tx/Rx Ready Interrupt |
| | SCK | **GPIO 18** | SPI SCK | SPI Serial Clock |
| | MISO | **GPIO 19** | SPI MISO | SPI Master In Slave Out |
| | MOSI | **GPIO 23** | SPI MOSI | SPI Master Out Slave In |
| **MQ-135 Gas** | VCC | **5V / VIN** | Power | Sensor Heater & Comparator |
| | GND | **GND** | Power | Common Ground |
| | DO | **GPIO 27** | Digital In | Smoke / Toxic Gas Detection |
| **MPU6050** | VCC | **3V3** | Power | 3.3V Motion Sensor Power |
| | GND | **GND** | Power | Common Ground |
| | SDA | **GPIO 21** | Shared I2C | Pitch, Roll & Capsizing Detection |
| | SCL | **GPIO 22** | Shared I2C | I2C Clock |
| **OLED (SSD1306)** | VCC | **3V3** | Power | 3.3V Display Power |
| | GND | **GND** | Power | Common Ground |
| | SDA | **GPIO 21** | Shared I2C | Real-time Status Display |
| | SCL | **GPIO 22** | Shared I2C | I2C Clock |
| **GPS (NEO-6M)** | VCC | **5V / VIN** | Power | GPS Receiver Power |
| | GND | **GND** | Power | Common Ground |
| | TX | **GPIO 16** | Serial2 RX | Hardware GPS NMEA Sentences |
| | RX | **GPIO 17** | Serial2 TX | GPS Configuration |

---

## 2. Onboard Telemetry Capabilities
1. **Live GPS Position Tracking**: Automatically parses NMEA latitude, longitude, satellite count, and speed over ground; auto-populates all SOS distress calls.
2. **MQ-135 Gas / Fire Detection**: Monitors onboard air quality; instantly flags toxic gas leaks or cabin fires.
3. **MPU6050 Vessel Motion / Capsizing**: Calculates pitch and roll angles in real-time; triggers capsizing distress when vessel roll exceeds 40°.
4. **OLED Status Display**: Live 128x64 display showing Vessel ID, LoRa Tx/Rx counts, GPS fix, and sensor alerts.

## 2. Firmware Flashing (PlatformIO)

The firmware is located in `firmware/seaLinkGateway`.

### Flashing Vessel 1 (Vessel Alpha)
1. In `firmware/seaLinkGateway/src/main.cpp`, ensure:
   ```cpp
   GatewayServer gateway(radio, routes, "BOAT-ALPHA");
   ```
2. Connect the first ESP32 via USB.
3. Open a terminal in `firmware/seaLinkGateway` and run:
   ```bash
   pio run --target upload
   ```

### Flashing Vessel 2 (Vessel Bravo)
1. In `firmware/seaLinkGateway/src/main.cpp`, change the boat ID to `"BOAT-BRAVO"`:
   ```cpp
   GatewayServer gateway(radio, routes, "BOAT-BRAVO");
   ```
2. In `firmware/seaLinkGateway/src/api/GatewayServer.cpp`, update default boat name if desired (e.g. `"Sagar Kanya"`).
3. Connect the second ESP32 via USB and run:
   ```bash
   pio run --target upload
   ```

## 3. Wi-Fi Connection Guide for Crew

1. Power the ESP32 from a 5V USB power bank or onboard USB outlet.
2. On your Android or iOS smartphone:
   - Open **Settings** -> **Wi-Fi**.
   - Select SSID: **`SOS-LoRa`**.
   - Enter password: **`maritime123`**.
3. **Android Captive Portal Notice**:
   - Android will display a system notification: *"Wi-Fi has no internet access"*.
   - Tap the notification and select **"Keep Wi-Fi Connection" / "Stay Connected"**.
4. Open the **SeaLink** mobile app.
   - The top banner will immediately indicate:
     `GATEWAY CONNECTED • SOS-LoRa (192.168.4.1) • LoRa 433 MHz Ready`.
   - You can now exchange radio messages with other vessels in range.

## 4. Mobile App Offline APK Build Instructions (Android)

To build an offline-capable Android APK:

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```
2. Build local offline Android APK with EAS:
   ```bash
   eas build --platform android --profile preview --local
   ```
   Or prebuild standard Android native project:
   ```bash
   npx expo prebuild --platform android
   cd android && ./gradlew assembleRelease
   ```
3. Install the resulting `.apk` file onto Android devices via USB (`adb install app-release.apk`) or file transfer.
