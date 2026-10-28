#pragma once
#include <Arduino.h>

#define MAX_PACKET_SIZE 255
#define MAX_PAYLOAD_SIZE 180

enum PacketType : uint8_t {
    PKT_DATA       = 0x01,
    PKT_ACK        = 0x02,
    PKT_BEACON     = 0x03,
    PKT_ROUTE_REQ  = 0x04,
    PKT_ROUTE_RESP = 0x05,
    PKT_SOS        = 0x99  // Emergency SOS distress broadcast to all boats + Shore
};

struct PacketEnvelope {
    uint8_t packetType;
    char messageId[36];
    char sourceBoatId[16];
    char destinationBoatId[16]; // e.g. "SOS-ALL" or boat ID
    char senderUserId[16];
    char recipientUserId[16];
    char senderName[24];
    uint8_t hopCount;
    uint8_t hopLimit;
    uint8_t isSos;
    float latitude;
    float longitude;
    uint8_t cloudSynced;
    uint16_t payloadLength;
    char payload[MAX_PAYLOAD_SIZE];
    int16_t rssi;
    float snr;
    uint32_t timestamp;

    bool serialize(uint8_t* buffer, size_t& len) const;
    static bool deserialize(const uint8_t* buffer, size_t len, PacketEnvelope& outPacket);
};
