#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include "../protocol/PacketEnvelope.h"
#include "../routing/RouteTable.h"
#include "../radio/RadioDriver.h"
#include "../sensors/SensorManager.h"

#define MAX_INCOMING_QUEUE 32
#define MAX_OUTGOING_QUEUE 16

class GatewayServer {
public:
    GatewayServer(RadioDriver& radio, RouteTable& routes, const char* boatId = "BOAT-001");
    void setBoatId(const char* id) {
        if (id && strlen(id) > 0) {
            strncpy(_boatId, id, sizeof(_boatId));
        }
    }
    void setSensors(SensorManager* sensors) { _sensors = sensors; }
    void begin(const char* apSsid = "SOS-LoRa", const char* apPassword = "maritime123");
    void loop();
    void enqueueIncomingPacket(const PacketEnvelope& packet);
    uint32_t getPacketsSent() const { return _packetsSent; }
    uint32_t getPacketsReceived() const { return _packetsReceived; }
    void setShoreStationMode(bool isShore,
                             const char* supabaseUrl = "",
                             const char* supabaseKey = "",
                             const char* tableName = "sos_alerts");

private:
    RadioDriver& _radio;
    RouteTable& _routes;
    char _boatId[16];
    char _boatName[32];
    char _callSign[16];
    AsyncWebServer _server;
    SensorManager* _sensors;

    bool _isShoreNode;
    char _supabaseUrl[128];
    char _supabaseKey[256];
    char _supabaseTable[32];

    // Outgoing packet queue (pending LoRa TX)
    PacketEnvelope _txQueue[MAX_OUTGOING_QUEUE];
    uint8_t _txHead;
    uint8_t _txTail;
    uint8_t _txCount;

    // Incoming packet queue (pending app fetch)
    PacketEnvelope _rxQueue[MAX_INCOMING_QUEUE];
    uint32_t _rxSequence[MAX_INCOMING_QUEUE];
    uint8_t _rxHead;
    uint8_t _rxTail;
    uint8_t _rxCount;
    uint32_t _nextSeq;

    uint32_t _packetsSent;
    uint32_t _packetsReceived;
    uint32_t _sosAlertsLogged;
    uint32_t _lastBeaconTime;

    void setupRoutes();
    bool enqueueTxPacket(const PacketEnvelope& packet);
    bool dequeueTxPacket(PacketEnvelope& packet);
    void uploadSosToCloud(const PacketEnvelope& packet);
};
