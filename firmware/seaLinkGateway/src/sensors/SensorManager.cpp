#include "SensorManager.h"
#include <math.h>

SensorManager::SensorManager()
    : _gpsSerial(2),
      _display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET),
      _gpsReady(false),
      _mpuReady(false),
      _oledReady(false),
      _lastOledUpdate(0),
      _lastSensorPoll(0) {
    _gpsData = {false, 0.0, 0.0, 0, 0.0f, 0.0f};
    _gasData = {false, 1};
    _motionData = {0.0f, 0.0f, 1.0f, false, false};
}

bool SensorManager::begin() {
    Serial.println("[Sensors] Initializing Onboard Hardware Sensors...");

    // 1. Initialize MQ-135 Gas Sensor Digital Pin
    pinMode(PIN_GAS_DIGITAL, INPUT);
    Serial.printf(" -> MQ-135 Gas Sensor: Configured on GPIO%d (Digital Input)\n", PIN_GAS_DIGITAL);

    // 2. Initialize Shared I2C Bus (SDA: 21, SCL: 22)
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

    Serial.println("[I2C Scan] Probing I2C bus (SDA: 21, SCL: 22)...");
    for (uint8_t addr = 1; addr < 127; addr++) {
        Wire.beginTransmission(addr);
        if (Wire.endTransmission() == 0) {
            Serial.printf(" -> Detected I2C device at address 0x%02X\n", addr);
        }
    }

    // 3. Initialize OLED Display (SSD1306)
    if (_display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
        _oledReady = true;
        _display.clearDisplay();
        _display.setTextColor(SSD1306_WHITE);
        _display.setTextSize(1);
        _display.setCursor(0, 0);
        _display.println("SeaLink LoRa Gateway");
        _display.println("Initializing sensors...");
        _display.display();
        Serial.printf(" -> OLED Display (SSD1306): Online at I2C 0x%02X\n", SCREEN_ADDRESS);
    } else {
        Serial.println(" -> [WARN] OLED Display (SSD1306) not found on I2C bus.");
    }

    // 4. Initialize MPU6050 Accelerometer / Gyroscope (Try standard 0x68, then alternate 0x69)
    if (_mpu.begin(0x68, &Wire) || _mpu.begin(0x69, &Wire)) {
        _mpuReady = true;
        _mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
        _mpu.setGyroRange(MPU6050_RANGE_500_DEG);
        _mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
        Serial.println(" -> MPU6050 Motion Sensor: Online (Range +/-8G)");
    } else {
        Serial.println(" -> [WARN] MPU6050 Accelerometer not detected on I2C (checked 0x68 and 0x69).");
    }

    // 5. Initialize Hardware GPS Serial 2 (GPIO16 RX, GPIO17 TX)
    _gpsSerial.begin(9600, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
    _gpsReady = true;
    Serial.printf(" -> GPS Module: Listening on Serial2 (RX: GPIO%d, TX: GPIO%d @ 9600 baud)\n",
                  PIN_GPS_RX, PIN_GPS_TX);

    return true;
}

void SensorManager::update() {
    // 1. Feed incoming GPS NMEA sentences into TinyGPSPlus
    while (_gpsSerial.available() > 0) {
        _gps.encode(_gpsSerial.read());
    }

    // 2. Poll sensors every 200ms
    uint32_t now = millis();
    if (now - _lastSensorPoll >= 200) {
        _lastSensorPoll = now;

        // A. Read MQ-135 Gas Sensor
        // Most digital MQ modules output LOW when gas/smoke exceeds potentiometer threshold
        int gasVal = digitalRead(PIN_GAS_DIGITAL);
        _gasData.digitalValue = gasVal;
        _gasData.hazardDetected = (gasVal == LOW);

        // B. Read GPS Telemetry
        if (_gps.location.isValid()) {
            _gpsData.hasFix = true;
            _gpsData.latitude = _gps.location.lat();
            _gpsData.longitude = _gps.location.lng();
            _gpsData.satellites = _gps.satellites.isValid() ? _gps.satellites.value() : 0;
            _gpsData.speedKmph = _gps.speed.isValid() ? _gps.speed.kmph() : 0.0f;
            _gpsData.altitudeMeters = _gps.altitude.isValid() ? _gps.altitude.meters() : 0.0f;
        } else {
            _gpsData.hasFix = false;
        }

        // C. Read MPU6050 Accelerometer / Gyroscope
        if (_mpuReady) {
            sensors_event_t a, g, temp;
            _mpu.getEvent(&a, &g, &temp);

            // Calculate pitch and roll angles in degrees
            // pitch = angle of inclination forward/backward
            // roll = angle of list port/starboard
            float ax = a.acceleration.x;
            float ay = a.acceleration.y;
            float az = a.acceleration.z;

            _motionData.pitch = atan2(-ax, sqrt(ay * ay + az * az)) * 180.0 / PI;
            _motionData.roll = atan2(ay, az) * 180.0 / PI;

            // Total acceleration magnitude in G's (normal is ~1.0G gravity)
            float totalAccel = sqrt(ax * ax + ay * ay + az * az) / 9.80665f;
            _motionData.totalAccelG = totalAccel;

            // Maritime Capsizing Threshold: continuous roll > 40 deg or pitch > 35 deg
            _motionData.capsizingAlert = (fabs(_motionData.roll) > 40.0f || fabs(_motionData.pitch) > 35.0f);

            // Impact / Collision Alert: sudden acceleration shock > 2.8G
            _motionData.impactAlert = (totalAccel > 2.8f);
        }
    }
}

void SensorManager::updateOled(const char* boatId, const char* loraStatus, uint32_t txCount, uint32_t rxCount) {
    if (!_oledReady) return;

    uint32_t now = millis();
    if (now - _lastOledUpdate < 1000) return; // Refresh OLED at 1 Hz
    _lastOledUpdate = now;

    _display.clearDisplay();
    _display.setTextColor(SSD1306_WHITE);

    // Header: Vessel ID & Radio Status
    _display.setTextSize(1);
    _display.setCursor(0, 0);
    _display.printf("%s", boatId);
    _display.setCursor(70, 0);
    _display.printf("LoRa:%s", loraStatus);

    _display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

    // Line 2: GPS Position
    _display.setCursor(0, 14);
    if (_gpsData.hasFix) {
        _display.printf("GPS: %.3f, %.3f", _gpsData.latitude, _gpsData.longitude);
        _display.setCursor(0, 24);
        _display.printf("Sats:%u Spd:%.1fkm/h", _gpsData.satellites, _gpsData.speedKmph);
    } else {
        _display.println("GPS: Searching Fix...");
        _display.setCursor(0, 24);
        _display.printf("Sats: %u", _gpsData.satellites);
    }

    // Line 3: Motion (Pitch & Roll)
    _display.setCursor(0, 36);
    _display.printf("Tilt: P:%+.0f R:%+.0f", _motionData.pitch, _motionData.roll);
    if (_motionData.capsizingAlert) {
        _display.print(" !CAPSIZE!");
    }

    // Line 4: Gas & Packet Telemetry
    _display.setCursor(0, 48);
    _display.printf("Gas:%s", _gasData.hazardDetected ? "ALERT!" : "OK");
    _display.setCursor(65, 48);
    _display.printf("Tx:%u Rx:%u", txCount, rxCount);

    _display.display();
}
