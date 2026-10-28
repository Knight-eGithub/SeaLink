#include "RadioDriver.h"

RadioDriver::RadioDriver() : _initialized(false), _txCount(0), _rxCount(0) {}

bool RadioDriver::begin() {
    SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
    LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
    LoRa.setSPIFrequency(1000000);

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
