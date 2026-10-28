#pragma once
#include <Arduino.h>
#include <Wire.h>
#include <TinyGPSPlus.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// Hardware Pin Definitions from SeaLink Circuit Schematic
#define PIN_GAS_DIGITAL     27      // MQ-135 Digital Out (DO)
#define PIN_GPS_RX          16      // ESP32 RX2 <- GPS TX
#define PIN_GPS_TX          17      // ESP32 TX2 -> GPS RX
#define PIN_I2C_SDA         21      // Shared I2C SDA (OLED + MPU6050)
#define PIN_I2C_SCL         22      // Shared I2C SCL (OLED + MPU6050)

#define SCREEN_WIDTH        128
#define SCREEN_HEIGHT       64
#define OLED_RESET          -1
#define SCREEN_ADDRESS      0x3C

struct GpsData {
    bool hasFix;
    double latitude;
    double longitude;
    uint32_t satellites;
    float speedKmph;
    float altitudeMeters;
};

struct GasData {
    bool hazardDetected;
    int digitalValue;
};

struct MotionData {
    float pitch;            // Degrees (-90 to +90)
    float roll;             // Degrees (-180 to +180)
    float totalAccelG;      // Magnitude in G's
    bool capsizingAlert;    // True if roll/pitch exceeds safe maritime threshold
    bool impactAlert;       // True if sudden shock / collision detected
};

class SensorManager {
public:
    SensorManager();
    bool begin();
    void update();

    // Data Getters
    GpsData getGps() const { return _gpsData; }
    GasData getGas() const { return _gasData; }
    MotionData getMotion() const { return _motionData; }

    bool isGpsReady() const { return _gpsReady; }
    bool isMpuReady() const { return _mpuReady; }
    bool isOledReady() const { return _oledReady; }

    // OLED Screen Refresh
    void updateOled(const char* boatId, const char* loraStatus, uint32_t txCount, uint32_t rxCount);

private:
    HardwareSerial _gpsSerial;
    TinyGPSPlus _gps;
    Adafruit_MPU6050 _mpu;
    Adafruit_SSD1306 _display;

    bool _gpsReady;
    bool _mpuReady;
    bool _oledReady;

    GpsData _gpsData;
    GasData _gasData;
    MotionData _motionData;

    uint32_t _lastOledUpdate;
    uint32_t _lastSensorPoll;
};
