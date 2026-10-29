#include "GatewayServer.h"
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

GatewayServer::GatewayServer(RadioDriver& radio, RouteTable& routes, const char* boatId)
    : _radio(radio),
      _routes(routes),
      _server(80),
      _isShoreNode(false),
      _txHead(0),
      _txTail(0),
      _txCount(0),
      _rxHead(0),
      _rxTail(0),
      _rxCount(0),
      _nextSeq(1),
      _packetsSent(0),
      _packetsReceived(0),
      _sosAlertsLogged(0),
      _lastBeaconTime(0),
      _sensors(nullptr) {
    strncpy(_boatId, boatId, sizeof(_boatId));
    strncpy(_boatName, "SeaLink Vessel", sizeof(_boatName));
    strncpy(_callSign, "SL-01", sizeof(_callSign));
    _supabaseUrl[0] = '\0';
    _supabaseKey[0] = '\0';
    strncpy(_supabaseTable, "sos_alerts", sizeof(_supabaseTable));
}

void GatewayServer::setShoreStationMode(bool isShore,
                                        const char* supabaseUrl,
                                        const char* supabaseKey,
                                        const char* tableName) {
    _isShoreNode = isShore;
    if (supabaseUrl && strlen(supabaseUrl) > 0) {
        strncpy(_supabaseUrl, supabaseUrl, sizeof(_supabaseUrl));
    }
    if (supabaseKey && strlen(supabaseKey) > 0) {
        strncpy(_supabaseKey, supabaseKey, sizeof(_supabaseKey));
    }
    if (tableName && strlen(tableName) > 0) {
        strncpy(_supabaseTable, tableName, sizeof(_supabaseTable));
    }
    if (_isShoreNode) {
        strncpy(_boatId, "SHORE-BASE", sizeof(_boatId));
        strncpy(_boatName, "Coast Guard Shore Station", sizeof(_boatName));
        strncpy(_callSign, "COAST-GUARD", sizeof(_callSign));
    }
}

void GatewayServer::begin(const char* boatId, const char* gatewayIp, const char* apPassword) {
    if (boatId && strlen(boatId) > 0) {
        strncpy(_boatId, boatId, sizeof(_boatId));
    }

    char finalSsid[32];
    snprintf(finalSsid, sizeof(finalSsid), "SeaLink-%s", _boatId);

    IPAddress local_IP(192, 168, 4, 1);
    if (gatewayIp && strlen(gatewayIp) > 0) {
        local_IP.fromString(gatewayIp);
    }

    WiFi.mode(WIFI_AP_STA); // AP for crew phones, STA for Shore Station internet uplink
    IPAddress subnet_mask(255, 255, 255, 0);
    WiFi.softAPConfig(local_IP, local_IP, subnet_mask);
    WiFi.softAP(finalSsid, apPassword, 1, 0, 8); // Support up to 8 simultaneous crew devices on board

    IPAddress ip = WiFi.softAPIP();
    Serial.printf("[Wi-Fi AP] Started SSID: '%s', IP: %s\n",
                  finalSsid, ip.toString().c_str());

    setupRoutes();
    _server.begin();
    Serial.printf("[HTTP Server] SeaLink REST API listening on port 80 (Node: %s, ShoreMode: %s)\n",
                  _boatId, _isShoreNode ? "YES" : "NO");
}

void GatewayServer::setupRoutes() {
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Content-Type");

    _server.onNotFound([](AsyncWebServerRequest* request) {
        if (request->method() == HTTP_OPTIONS) {
            request->send(204);
        } else {
            request->send(404, "application/json", "{\"error\":\"Endpoint not found\"}");
        }
    });

    // GET /api/v1/status
    _server.on("/api/v1/status", HTTP_GET, [this](AsyncWebServerRequest* request) {
        JsonDocument doc;
        doc["boatId"] = _boatId;
        doc["boatName"] = _boatName;
        doc["firmwareVersion"] = "1.2.0-mesh-sos";
        doc["protocolVersion"] = "v1";
        doc["wifiApStatus"] = "active";
        doc["apSsid"] = "SOS-LoRa";
        doc["ipAddress"] = WiFi.softAPIP().toString();
        doc["loraStatus"] = _radio.isReady() ? "ready" : "error";
        doc["frequency"] = 433000000;
        doc["queueLength"] = _txCount;
        doc["freeHeap"] = ESP.getFreeHeap();
        doc["packetsReceived"] = _packetsReceived;
        doc["packetsTransmitted"] = _packetsSent;
        doc["isShoreGateway"] = _isShoreNode;
        doc["cloudSyncAvailable"] = _isShoreNode && (strlen(_supabaseUrl) > 0);
        doc["timestamp"] = millis();

        JsonArray routes = doc["knownRoutes"].to<JsonArray>();
        RouteInfo rList[8];
        size_t count = _routes.getActiveRoutes(rList, 8);
        for (size_t i = 0; i < count; i++) {
            JsonObject rObj = routes.add<JsonObject>();
            rObj["destinationBoatId"] = rList[i].destinationBoatId;
            rObj["nextHopBoatId"] = rList[i].nextHopBoatId;
            rObj["hopCount"] = rList[i].hopCount;
            rObj["lastSeen"] = rList[i].lastSeen;
            rObj["rssi"] = rList[i].rssi;
        }

        // Live Onboard Sensor Telemetry (GPS, Gas, Motion)
        JsonObject telem = doc["telemetry"].to<JsonObject>();
        if (_sensors) {
            JsonObject gps = telem["gps"].to<JsonObject>();
            GpsData g = _sensors->getGps();
            gps["hasFix"] = g.hasFix;
            gps["latitude"] = g.latitude;
            gps["longitude"] = g.longitude;
            gps["satellites"] = g.satellites;
            gps["speedKmph"] = g.speedKmph;

            JsonObject gas = telem["gas"].to<JsonObject>();
            GasData ga = _sensors->getGas();
            gas["hazardDetected"] = ga.hazardDetected;
            gas["digitalValue"] = ga.digitalValue;
            gas["status"] = ga.hazardDetected ? "HAZARDOUS_GAS_DETECTED" : "NORMAL";

            JsonObject motion = telem["motion"].to<JsonObject>();
            MotionData m = _sensors->getMotion();
            motion["pitch"] = m.pitch;
            motion["roll"] = m.roll;
            motion["totalAccelG"] = m.totalAccelG;
            motion["capsizingAlert"] = m.capsizingAlert;
            motion["impactAlert"] = m.impactAlert;
        }

        String output;
        serializeJson(doc, output);
        request->send(200, "application/json", output);
    });

    // GET /api/v1/telemetry
    _server.on("/api/v1/telemetry", HTTP_GET, [this](AsyncWebServerRequest* request) {
        JsonDocument doc;
        doc["boatId"] = _boatId;
        doc["timestamp"] = millis();

        if (_sensors) {
            JsonObject gps = doc["gps"].to<JsonObject>();
            GpsData g = _sensors->getGps();
            gps["hasFix"] = g.hasFix;
            gps["latitude"] = g.latitude;
            gps["longitude"] = g.longitude;
            gps["satellites"] = g.satellites;
            gps["speedKmph"] = g.speedKmph;

            JsonObject gas = doc["gas"].to<JsonObject>();
            GasData ga = _sensors->getGas();
            gas["hazardDetected"] = ga.hazardDetected;
            gas["digitalValue"] = ga.digitalValue;
            gas["status"] = ga.hazardDetected ? "HAZARDOUS_GAS_DETECTED" : "NORMAL";

            JsonObject motion = doc["motion"].to<JsonObject>();
            MotionData m = _sensors->getMotion();
            motion["pitch"] = m.pitch;
            motion["roll"] = m.roll;
            motion["totalAccelG"] = m.totalAccelG;
            motion["capsizingAlert"] = m.capsizingAlert;
            motion["impactAlert"] = m.impactAlert;
        }

        String output;
        serializeJson(doc, output);
        request->send(200, "application/json", output);
    });

    // GET /api/v1/identity
    _server.on("/api/v1/identity", HTTP_GET, [this](AsyncWebServerRequest* request) {
        JsonDocument doc;
        doc["boatId"] = _boatId;
        doc["boatName"] = _boatName;
        doc["callSign"] = _callSign;
        doc["apSsid"] = "SOS-LoRa";
        doc["firmwareVersion"] = "1.2.0-mesh-sos";
        doc["protocolVersion"] = "v1";
        doc["isShoreGateway"] = _isShoreNode;

        String output;
        serializeJson(doc, output);
        request->send(200, "application/json", output);
    });

    // POST /api/v1/messages
    _server.on(
        "/api/v1/messages",
        HTTP_POST,
        [](AsyncWebServerRequest* request) {
            // Handled in onBody handler below
        },
        NULL,
        [this](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            JsonDocument jsonObj;
            DeserializationError err = deserializeJson(jsonObj, data, len);
            if (err) {
                request->send(400, "application/json", "{\"error\":\"Invalid JSON format\"}");
                return;
            }

            if (!jsonObj["destinationBoatId"] || !jsonObj["text"] || !jsonObj["id"]) {
                request->send(400, "application/json", "{\"error\":\"Missing required packet fields (id, destinationBoatId, text)\"}");
                return;
            }

            const char* text = jsonObj["text"];
            size_t textLen = strlen(text);
            if (textLen > MAX_PAYLOAD_SIZE) {
                request->send(400, "application/json", "{\"error\":\"Payload exceeds radio limit\"}");
                return;
            }

            bool isSos = jsonObj["isSos"] | false;

            PacketEnvelope pkt;
            pkt.packetType = isSos ? PKT_SOS : PKT_DATA;
            pkt.hopCount = 1;
            pkt.hopLimit = isSos ? 7 : (jsonObj["hopLimit"] | 4);
            pkt.isSos = isSos ? 1 : 0;
            pkt.cloudSynced = 0;
            pkt.latitude = jsonObj["latitude"] | 0.0f;
            pkt.longitude = jsonObj["longitude"] | 0.0f;

            // Auto-inject live hardware GPS coordinates if available from NEO-6M sensor
            if ((pkt.latitude == 0.0f && pkt.longitude == 0.0f) && _sensors && _sensors->getGps().hasFix) {
                pkt.latitude = (float)_sensors->getGps().latitude;
                pkt.longitude = (float)_sensors->getGps().longitude;
            }

            strncpy(pkt.messageId, jsonObj["id"], sizeof(pkt.messageId));
            strncpy(pkt.sourceBoatId, _boatId, sizeof(pkt.sourceBoatId));
            strncpy(pkt.destinationBoatId, jsonObj["destinationBoatId"], sizeof(pkt.destinationBoatId));
            strncpy(pkt.senderUserId, jsonObj["senderUserId"] | "CREW-01", sizeof(pkt.senderUserId));
            strncpy(pkt.recipientUserId, jsonObj["recipientUserId"] | "*", sizeof(pkt.recipientUserId));
            strncpy(pkt.senderName, jsonObj["senderName"] | "Crew", sizeof(pkt.senderName));
            strncpy(pkt.payload, text, sizeof(pkt.payload));
            pkt.payloadLength = textLen;

            // Always transmit onto 433 MHz LoRa RF unless it's strictly addressed to our own node ID
            bool isLocalSelfOnly = (strcmp(pkt.destinationBoatId, _boatId) == 0);

            // 1. Enqueue for local delivery to phones connected to this gateway
            enqueueIncomingPacket(pkt);

            // 2. Transmit over 433 MHz LoRa RF to other vessels
            bool txQueued = true;
            if (!isLocalSelfOnly || isSos) {
                txQueued = enqueueTxPacket(pkt);
            }

            if (txQueued) {
                JsonDocument resp;
                resp["success"] = true;
                resp["messageId"] = pkt.messageId;
                resp["status"] = isLocalSelfOnly ? "delivered_onboard" : "accepted_by_gateway";
                resp["queuePosition"] = _txCount;

                if (isSos) {
                    Serial.printf("[SOS INITIATED] Vessel %s triggered SOS Distress Flood! HopLimit: %u\n",
                                  _boatId, pkt.hopLimit);
                }

                String out;
                serializeJson(resp, out);
                request->send(200, "application/json", out);
            } else {
                request->send(503, "application/json", "{\"error\":\"Gateway transmission queue is full\"}");
            }
        }
    );

    // GET /api/v1/messages?cursor=<cursor>
    _server.on("/api/v1/messages", HTTP_GET, [this](AsyncWebServerRequest* request) {
        uint32_t cursor = 0;
        if (request->hasParam("cursor")) {
            cursor = request->getParam("cursor")->value().toInt();
        }

        JsonDocument doc;
        JsonArray msgs = doc["messages"].to<JsonArray>();

        uint32_t latestSeq = cursor;
        for (uint8_t i = 0; i < _rxCount; i++) {
            uint8_t idx = (_rxTail + i) % MAX_INCOMING_QUEUE;
            if (_rxSequence[idx] > cursor) {
                JsonObject m = msgs.add<JsonObject>();
                m["id"] = _rxQueue[idx].messageId;
                m["sourceBoatId"] = _rxQueue[idx].sourceBoatId;
                m["destinationBoatId"] = _rxQueue[idx].destinationBoatId;
                m["senderUserId"] = _rxQueue[idx].senderUserId;
                m["recipientUserId"] = _rxQueue[idx].recipientUserId;
                m["senderName"] = _rxQueue[idx].senderName;
                m["text"] = _rxQueue[idx].payload;
                m["hopCount"] = _rxQueue[idx].hopCount;
                m["rssi"] = _rxQueue[idx].rssi;
                m["snr"] = _rxQueue[idx].snr;
                m["createdAt"] = _rxQueue[idx].timestamp;
                m["isSos"] = (_rxQueue[idx].isSos == 1);
                m["cloudSynced"] = (_rxQueue[idx].cloudSynced == 1);

                if (_rxQueue[idx].latitude != 0.0f || _rxQueue[idx].longitude != 0.0f) {
                    m["latitude"] = _rxQueue[idx].latitude;
                    m["longitude"] = _rxQueue[idx].longitude;
                }

                if (_rxSequence[idx] > latestSeq) {
                    latestSeq = _rxSequence[idx];
                }
            }
        }

        doc["nextCursor"] = String(latestSeq);
        doc["hasMore"] = false;
        doc["totalPending"] = _rxCount;

        String out;
        serializeJson(doc, out);
        request->send(200, "application/json", out);
    });
}

bool GatewayServer::enqueueTxPacket(const PacketEnvelope& packet) {
    if (_txCount >= MAX_OUTGOING_QUEUE) return false;
    _txQueue[_txHead] = packet;
    _txHead = (_txHead + 1) % MAX_OUTGOING_QUEUE;
    _txCount++;
    return true;
}

bool GatewayServer::dequeueTxPacket(PacketEnvelope& packet) {
    if (_txCount == 0) return false;
    packet = _txQueue[_txTail];
    _txTail = (_txTail + 1) % MAX_OUTGOING_QUEUE;
    _txCount--;
    return true;
}

void GatewayServer::enqueueIncomingPacket(const PacketEnvelope& packet) {
    _rxQueue[_rxHead] = packet;
    _rxSequence[_rxHead] = _nextSeq++;
    _rxHead = (_rxHead + 1) % MAX_INCOMING_QUEUE;

    if (_rxCount < MAX_INCOMING_QUEUE) {
        _rxCount++;
    } else {
        _rxTail = (_rxTail + 1) % MAX_INCOMING_QUEUE;
    }
    _packetsReceived++;
}

void GatewayServer::uploadSosToCloud(const PacketEnvelope& packet) {
    _sosAlertsLogged++;
    Serial.println("\n*******************************************************");
    Serial.printf(" [SHORE CLOUD BRIDGE] 🚨 INTERCEPTED LORA SOS DISTRESS!\n");
    Serial.printf(" -> Source Vessel : %s\n", packet.sourceBoatId);
    Serial.printf(" -> Distress Text : %s\n", packet.payload);
    Serial.printf(" -> GPS Position  : %.4f N, %.4f E\n", packet.latitude, packet.longitude);
    Serial.printf(" -> Mesh Hop Count: %u (RSSI: %d dBm, SNR: %.1f dB)\n", packet.hopCount, packet.rssi, packet.snr);

    if (strlen(_supabaseUrl) == 0 || strlen(_supabaseKey) == 0) {
        Serial.println(" -> [SUPABASE NOTE] URL/Key empty. Simulating successful cloud upload.");
        Serial.println("*******************************************************\n");
        return;
    }

    if (WiFi.status() != WL_CONNECTED) {
        Serial.println(" -> [SUPABASE WARNING] Shore Station STA Wi-Fi not connected to Internet. Cannot reach Supabase.");
        Serial.println("*******************************************************\n");
        return;
    }

    WiFiClientSecure client;
    client.setInsecure(); // Connects to Supabase HTTPS

    HTTPClient http;
    String endpoint = String(_supabaseUrl) + "/rest/v1/" + String(_supabaseTable);

    if (http.begin(client, endpoint)) {
        http.addHeader("Content-Type", "application/json");
        http.addHeader("apikey", _supabaseKey);
        http.addHeader("Authorization", String("Bearer ") + _supabaseKey);
        http.addHeader("Prefer", "return=minimal");

        JsonDocument doc;
        doc["message_id"] = packet.messageId;
        doc["source_boat_id"] = packet.sourceBoatId;
        doc["category"] = "EMERGENCY_SOS";
        doc["distress_text"] = packet.payload;
        doc["latitude"] = packet.latitude;
        doc["longitude"] = packet.longitude;
        doc["hop_count"] = packet.hopCount;
        doc["rssi"] = packet.rssi;
        doc["snr"] = packet.snr;

        String requestBody;
        serializeJson(doc, requestBody);

        int httpCode = http.POST(requestBody);
        if (httpCode >= 200 && httpCode < 300) {
            Serial.printf(" -> [SUPABASE SUCCESS] HTTP %d: Alert saved in PostgreSQL 'sos_alerts' table!\n", httpCode);
        } else {
            Serial.printf(" -> [SUPABASE ERROR] HTTP %d: %s\n", httpCode, http.getString().c_str());
        }
        http.end();
    } else {
        Serial.println(" -> [SUPABASE ERROR] Failed to begin HTTPS connection to Supabase endpoint.");
    }
    Serial.println("*******************************************************\n");
}

void GatewayServer::loop() {
    // 1. Process pending LoRa transmissions
    if (_txCount > 0) {
        PacketEnvelope pkt;
        if (dequeueTxPacket(pkt)) {
            bool success = _radio.transmitPacket(pkt);
            if (success) {
                _packetsSent++;
                _routes.recordSeen(pkt.messageId);
            }
        }
    }

    // 2. Poll LoRa receiver for incoming packets
    PacketEnvelope rxPkt;
    if (_radio.receivePacket(rxPkt)) {
        if (_routes.isDuplicate(rxPkt.messageId)) {
            return;
        }
        _routes.recordSeen(rxPkt.messageId);
        _routes.updateRoute(rxPkt.sourceBoatId, rxPkt.sourceBoatId, rxPkt.hopCount, rxPkt.rssi);

        bool isSos = (rxPkt.packetType == PKT_SOS || rxPkt.isSos == 1);

        if (isSos) {
            Serial.printf("[SOS FLOOD DETECTED] %s reported emergency! (Hop: %u/%u)\n",
                          rxPkt.sourceBoatId, rxPkt.hopCount, rxPkt.hopLimit);

            // A. If Shore Station: upload to Supabase PostgreSQL table
            if (_isShoreNode) {
                uploadSosToCloud(rxPkt);
                rxPkt.cloudSynced = 1;
            }

            // B. Enqueue locally for crew phones
            enqueueIncomingPacket(rxPkt);

            // C. Controlled Mesh Flooding: re-transmit packet onto 433 MHz LoRa if within hop limit
            if (rxPkt.hopCount < rxPkt.hopLimit) {
                rxPkt.hopCount++;
                enqueueTxPacket(rxPkt);
                Serial.printf("[SOS FLOOD RELAY] Re-broadcasting SOS from %s to adjacent vessels and shore (hop %u)\n",
                              rxPkt.sourceBoatId, rxPkt.hopCount);
            }
            return;
        }

        // 2B. Automatic LoRa Mesh Discovery Beacon (Discovers adjacent vessels silently)
        if (rxPkt.packetType == PKT_BEACON) {
            Serial.printf("[Mesh Discovery] Discovered nearby vessel %s over 433 MHz LoRa! (RSSI: %d dBm, SNR: %.1f dB)\n",
                          rxPkt.sourceBoatId, rxPkt.rssi, rxPkt.snr);
            return; // Route table was updated, no need to alert crew chat
        }

        // Deliver to crew phones if addressed to us, broadcast to ALL, or general crew channel
        bool addressedToUs = (strcmp(rxPkt.destinationBoatId, _boatId) == 0 ||
                              strcmp(rxPkt.destinationBoatId, "ALL") == 0 ||
                              strcmp(rxPkt.destinationBoatId, "*") == 0 ||
                              strcmp(rxPkt.destinationBoatId, "ONBOARD-CREW") == 0);

        if (addressedToUs) {
            enqueueIncomingPacket(rxPkt);
        } else {
            if (rxPkt.hopCount < rxPkt.hopLimit) {
                rxPkt.hopCount++;
                enqueueTxPacket(rxPkt);
                Serial.printf("[Mesh Forward] Relaying pkt %s towards %s (hop %u/%u)\n",
                              rxPkt.messageId, rxPkt.destinationBoatId, rxPkt.hopCount, rxPkt.hopLimit);
            }
        }
    }

    // 3. Periodic LoRa Mesh Presence Beacon (every 20s) so nearby vessels automatically discover each other
    uint32_t now = millis();
    if (now - _lastBeaconTime > 20000 && _radio.isReady() && _txCount == 0) {
        _lastBeaconTime = now;
        PacketEnvelope beacon;
        memset(&beacon, 0, sizeof(PacketEnvelope));
        beacon.packetType = PKT_BEACON;
        snprintf(beacon.messageId, sizeof(beacon.messageId), "bcn-%s-%lu", _boatId, (unsigned long)(now / 1000));
        strncpy(beacon.sourceBoatId, _boatId, sizeof(beacon.sourceBoatId));
        strncpy(beacon.destinationBoatId, "ALL", sizeof(beacon.destinationBoatId));
        beacon.hopCount = 1;
        beacon.hopLimit = 1;
        strncpy(beacon.senderName, _boatName, sizeof(beacon.senderName));
        strncpy(beacon.payload, "MESH_BEACON", sizeof(beacon.payload));
        beacon.payloadLength = strlen(beacon.payload);
        if (_sensors) {
            beacon.latitude = (float)_sensors->getGps().latitude;
            beacon.longitude = (float)_sensors->getGps().longitude;
        }
        enqueueTxPacket(beacon);
    }
}
