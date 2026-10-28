#include "RadioDriver.h"

RadioDriver::RadioDriver() : _initialized(false), _txCount(0), _rxCount(0) {}

bool RadioDriver::begin() {
    // 1. Initialize SPI bus on designated pins
    SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);

    // 2. Hardware reset pulse to wake up SX1278
    pinMode(LORA_SS, OUTPUT);
    digitalWrite(LORA_SS, HIGH);
    pinMode(LORA_RST, OUTPUT);
    digitalWrite(LORA_RST, LOW);
    delay(20);
    digitalWrite(LORA_RST, HIGH);
    delay(50); // Allow PLL and internal oscillators to stabilize

    // 3. Electrical continuity test on MISO (GPIO 19)
    pinMode(LORA_MISO, INPUT_PULLDOWN);
    delay(2);
    int misoLow = digitalRead(LORA_MISO);
    pinMode(LORA_MISO, INPUT_PULLUP);
    delay(2);
    int misoHigh = digitalRead(LORA_MISO);

    Serial.printf("[LoRa Diagnostic] MISO pin (GPIO 19) line test: Pulldown=%d, Pullup=%d\n", misoLow, misoHigh);
    if (misoLow == 0 && misoHigh == 1) {
        Serial.println(" -> [DIAGNOSTIC] MISO (GPIO 19) is FLOATING! The jumper wire is loose or not reaching the RA-02 MISO pin.");
    } else if (misoLow == 0 && misoHigh == 0) {
        Serial.println(" -> [DIAGNOSTIC] MISO (GPIO 19) is held LOW (0V). The RA-02 may have no 3.3V power, or MISO is shorted to GND.");
    }

    // 4. Diagnostic check: Read RegVersion (0x42) on GPIO 5
    digitalWrite(LORA_SS, LOW);
    SPI.transfer(0x42 & 0x7F); // Read bit (MSB 0)
    uint8_t version = SPI.transfer(0x00);
    digitalWrite(LORA_SS, HIGH);

    Serial.printf("[LoRa Diagnostic] SPI RegVersion read on GPIO 5: 0x%02X (Expected: 0x12)\n", version);

    // 5. If not found on GPIO 5, probe alternate CS pins (15, 4, 2)
    uint8_t workingCs = LORA_SS;
    if (version != 0x12) {
        const uint8_t altCs[] = { 15, 4, 2, 27 };
        for (uint8_t cs : altCs) {
            pinMode(cs, OUTPUT);
            digitalWrite(cs, HIGH);
            delay(2);
            digitalWrite(cs, LOW);
            SPI.transfer(0x42 & 0x7F);
            uint8_t altV = SPI.transfer(0x00);
            digitalWrite(cs, HIGH);
            if (altV == 0x12) {
                Serial.printf(" -> [FOUND!] SX1278 responded on Chip Select GPIO %u!\n", cs);
                workingCs = cs;
                version = 0x12;
                break;
            }
        }
    }

    LoRa.setPins(workingCs, LORA_RST, LORA_DIO0);

    if (!LoRa.begin(LORA_FREQ)) {
        Serial.println("[LoRa] Radio initialization FAILED!");
        _initialized = false;
        return false;
    }

    // High spreading factor for maritime long-range resilience
    LoRa.setSpreadingFactor(9);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setCodingRate4(7);
    LoRa.enableCrc();

    Serial.println("[LoRa] SX1278 initialized on 433 MHz.");
    _initialized = true;
    return true;
}

bool RadioDriver::transmitPacket(const PacketEnvelope& packet) {
    if (!_initialized) return false;

    uint8_t buffer[MAX_PACKET_SIZE];
    size_t len = 0;
    if (!packet.serialize(buffer, len)) {
        return false;
    }

    LoRa.beginPacket();
    LoRa.write(buffer, len);
    int res = LoRa.endPacket();

    if (res == 1) {
        _txCount++;
        Serial.printf("[LoRa TX] Sent pkt %s to %s (len: %u bytes)\n",
                      packet.messageId, packet.destinationBoatId, len);
        return true;
    } else {
        Serial.printf("[LoRa TX ERROR] Failed to send pkt %s\n", packet.messageId);
        return false;
    }
}

bool RadioDriver::receivePacket(PacketEnvelope& packet) {
    if (!_initialized) return false;

    int packetSize = LoRa.parsePacket();
    if (packetSize == 0) return false;

    uint8_t buffer[MAX_PACKET_SIZE];
    int bytesRead = 0;
    while (LoRa.available() && bytesRead < MAX_PACKET_SIZE) {
        buffer[bytesRead++] = (uint8_t)LoRa.read();
    }

    if (PacketEnvelope::deserialize(buffer, bytesRead, packet)) {
        packet.rssi = LoRa.packetRssi();
        packet.snr  = LoRa.packetSnr();
        _rxCount++;
        Serial.printf("[LoRa RX] Received pkt %s from %s (RSSI: %d, SNR: %.1f)\n",
                      packet.messageId, packet.sourceBoatId, packet.rssi, packet.snr);
        return true;
    }

    return false;
}
