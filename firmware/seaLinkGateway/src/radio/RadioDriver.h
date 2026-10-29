#pragma once
#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
#include "../protocol/PacketEnvelope.h"

#define LORA_SS   5
#define LORA_RST  14
#define LORA_DIO0 26
#define LORA_SCK  18
#define LORA_MISO 19
#define LORA_MOSI 23
#define LORA_FREQ 433000000L

class RadioDriver {
public:
    RadioDriver();
    bool begin();
    bool transmitPacket(const PacketEnvelope& packet);
    bool receivePacket(PacketEnvelope& packet);
    bool isReady() const { return _initialized; }
    int getRssi() { return LoRa.packetRssi(); }
    float getSnr() { return LoRa.packetSnr(); }

private:
    bool _initialized;
    uint32_t _txCount;
    uint32_t _rxCount;
};
