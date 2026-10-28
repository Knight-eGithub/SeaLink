#include "PacketEnvelope.h"
#include <cstring>

bool PacketEnvelope::serialize(uint8_t* buffer, size_t& len) const {
    if (!buffer) return false;
    size_t offset = 0;

    buffer[offset++] = packetType;
    buffer[offset++] = hopCount;
    buffer[offset++] = hopLimit;
    buffer[offset++] = isSos;
    buffer[offset++] = cloudSynced;

    // GPS coordinates (IEEE 754 4-byte floats)
    memcpy(buffer + offset, &latitude, sizeof(float));
    offset += sizeof(float);
    memcpy(buffer + offset, &longitude, sizeof(float));
    offset += sizeof(float);

    // Fixed-length string fields
    memcpy(buffer + offset, messageId, sizeof(messageId));
    offset += sizeof(messageId);

    memcpy(buffer + offset, sourceBoatId, sizeof(sourceBoatId));
    offset += sizeof(sourceBoatId);

    memcpy(buffer + offset, destinationBoatId, sizeof(destinationBoatId));
    offset += sizeof(destinationBoatId);

    memcpy(buffer + offset, senderUserId, sizeof(senderUserId));
    offset += sizeof(senderUserId);

    memcpy(buffer + offset, recipientUserId, sizeof(recipientUserId));
    offset += sizeof(recipientUserId);

    memcpy(buffer + offset, senderName, sizeof(senderName));
    offset += sizeof(senderName);

    uint8_t pLen = (payloadLength > MAX_PAYLOAD_SIZE) ? MAX_PAYLOAD_SIZE : (uint8_t)payloadLength;
    buffer[offset++] = pLen;

    if (pLen > 0) {
        memcpy(buffer + offset, payload, pLen);
        offset += pLen;
    }

    len = offset;
    return true;
}

bool PacketEnvelope::deserialize(const uint8_t* buffer, size_t len, PacketEnvelope& out) {
    size_t minHeaderSize = 1 + 1 + 1 + 1 + 1 + 4 + 4 + 36 + 16 + 16 + 16 + 16 + 24 + 1;
    if (!buffer || len < minHeaderSize) {
        return false;
    }

    size_t offset = 0;
    out.packetType  = buffer[offset++];
    out.hopCount    = buffer[offset++];
    out.hopLimit    = buffer[offset++];
    out.isSos       = buffer[offset++];
    out.cloudSynced = buffer[offset++];

    memcpy(&out.latitude, buffer + offset, sizeof(float));
    offset += sizeof(float);
    memcpy(&out.longitude, buffer + offset, sizeof(float));
    offset += sizeof(float);

    memcpy(out.messageId, buffer + offset, sizeof(out.messageId));
    out.messageId[sizeof(out.messageId) - 1] = '\0';
    offset += sizeof(out.messageId);

    memcpy(out.sourceBoatId, buffer + offset, sizeof(out.sourceBoatId));
    out.sourceBoatId[sizeof(out.sourceBoatId) - 1] = '\0';
    offset += sizeof(out.sourceBoatId);

    memcpy(out.destinationBoatId, buffer + offset, sizeof(out.destinationBoatId));
    out.destinationBoatId[sizeof(out.destinationBoatId) - 1] = '\0';
    offset += sizeof(out.destinationBoatId);

    memcpy(out.senderUserId, buffer + offset, sizeof(out.senderUserId));
    out.senderUserId[sizeof(out.senderUserId) - 1] = '\0';
    offset += sizeof(out.senderUserId);

    memcpy(out.recipientUserId, buffer + offset, sizeof(out.recipientUserId));
    out.recipientUserId[sizeof(out.recipientUserId) - 1] = '\0';
    offset += sizeof(out.recipientUserId);

    memcpy(out.senderName, buffer + offset, sizeof(out.senderName));
    out.senderName[sizeof(out.senderName) - 1] = '\0';
    offset += sizeof(out.senderName);

    uint8_t pLen = buffer[offset++];
    if (offset + pLen > len) {
        return false;
    }

    out.payloadLength = pLen;
    if (pLen > 0) {
        memcpy(out.payload, buffer + offset, pLen);
    }
    out.payload[pLen] = '\0';
    out.timestamp = millis();

    return true;
}
