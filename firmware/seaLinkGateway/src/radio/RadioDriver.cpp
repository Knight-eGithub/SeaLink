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

    // 3. Diagnostic check: Read RegVersion (0x42) directly
    digitalWrite(LORA_SS, LOW);
    SPI.transfer(0x42 & 0x7F); // Read bit (MSB 0)
    uint8_t version = SPI.transfer(0x00);
    digitalWrite(LORA_SS, HIGH);

    Serial.printf("[LoRa Diagnostic] SPI RegVersion read: 0x%02X (Expected: 0x12)\n", version);
    if (version == 0x00) {
        Serial.println(" -> [DIAGNOSTIC] 0x00 returned. SX1278 has NO POWER (check 3.3V/GND) or NSS (GPIO 5) / SCK (GPIO 18) is disconnected.");
    } else if (version == 0xFF) {
        Serial.println(" -> [DIAGNOSTIC] 0xFF returned. MISO (GPIO 19) is floating/disconnected, or MOSI (GPIO 23) is swapped.");
    }

    LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);

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
