# SeaLink — Offline Maritime Messaging Architecture

## 1. System Overview

SeaLink provides robust, offline peer-to-peer and multi-hop maritime messaging between boats at sea. Each vessel operates exactly one ESP32 gateway connected to an SX1278 RA-02 433 MHz LoRa transceiver. Crew members on board connect their smartphones directly to the vessel's ESP32 Wi-Fi SoftAP (`SOS-LoRa`). No cellular service, internet gateway, or cloud infrastructure is required.

```text
Crew Member Phone A (SeaLink App)
       │ (Wi-Fi 802.11 b/g/n - 192.168.4.1)
       ▼
ESP32 Gateway Vessel A (433 MHz LoRa SX1278)
       │ (Long-Range Chirp Spread Spectrum Radio)
       ▼
ESP32 Gateway Vessel B (Intermediate Mesh Relay)
       │ (Relays ciphertext packet / decrements hop limit)
       ▼
ESP32 Gateway Vessel C (Target Vessel Gateway)
       │ (Wi-Fi 802.11 b/g/n)
       ▼
Crew Member Phone C (SeaLink App)
```

## 2. Directory Structure

```text
seaLink/
├── src/
│   ├── app/                    # Expo Router Screens
│   │   ├── _layout.tsx         # Root layout with nautical dark ocean theme
│   │   ├── index.tsx           # Active conversations & quick actions
│   │   ├── connect.tsx         # Real ESP32 Gateway connection & diagnostics
│   │   ├── boats.tsx           # Fleet directory & vessel registration
│   │   ├── chat/[boatId].tsx   # Vessel-to-vessel radio chat screen
│   │   └── settings.tsx        # Vessel & crew identity profile
│   ├── components/             # Modular UI components
│   │   ├── ChatBubble.tsx      # Outgoing & incoming bubbles with delivery states
│   │   ├── MessageComposer.tsx # Input with SX1278 byte budget counter
│   │   ├── ConnectionBanner.tsx# Real-time Wi-Fi gateway status banner
│   │   └── BoatListItem.tsx    # Fleet card with link status (1-hop / mesh)
│   ├── domain/                 # Strongly-typed domain models
│   │   ├── delivery.ts         # Delivery states & metadata
│   │   ├── identity.ts         # Vessel & crew identity models
│   │   ├── boat.ts             # Vessel directory & link state models
│   │   └── message.ts          # Message envelope & byte validation
│   ├── services/
│   │   ├── gateway/            # ESP32 HTTP Gateway Client & Types
│   │   │   ├── GatewayClient.ts
│   │   │   └── GatewayTypes.ts
│   │   ├── messages/           # Message repository & state machine
│   │   │   ├── MessageService.ts
│   │   │   └── MessageRepository.ts
│   │   └── storage/            # Local persistent storage
│   │       └── StorageService.ts
│   └── config/
│       └── network.ts          # Default gateway IP, timeouts, LoRa limits
├── firmware/
│   └── seaLinkGateway/         # ESP32 PlatformIO firmware project
│       ├── platformio.ini
│       └── src/
│           ├── main.cpp
│           ├── radio/          # SX1278 SPI LoRa driver
│           ├── api/            # ESPAsyncWebServer REST API
│           ├── routing/        # Route table & deduplication
│           └── protocol/       # Binary packet serialization
├── tests/                      # Automated Jest test suites
│   ├── domain.test.ts
│   ├── storage.test.ts
│   ├── gateway.test.ts
│   └── messageService.test.ts
└── docs/                       # Technical & hardware documentation
```

## 3. Explicit Delivery States

SeaLink enforces clear separation between local radio transmission and actual destination delivery:

| Delivery State | UI Code | Color | Meaning |
|---|---|---|---|
| `queued_local` | ⏳ | Gray | Message saved locally on phone, waiting for gateway sync |
| `accepted_by_gateway` | ✓ | Blue | Transferred to boat's ESP32 via Wi-Fi and buffered in TX queue |
| `transmitted_to_next_hop` | 📡 | Amber | ESP32 called `LoRa.endPacket()` successfully onto the radio channel |
| `delivered_to_destination_gateway` | 🚢 | Emerald | Received LoRa ACK packet from target vessel gateway |
| `delivered_to_recipient` | ✓✓ | Teal | Recipient crew phone fetched and verified message from target gateway |
| `failed` | ⚠️ | Red | Gateway connection failed or transmission retries exhausted |
| `expired` | ⌛ | Dark Gray | Packet hop limit reached or mesh TTL expired |

> **Important**: `LoRa.endPacket() == 1` proves ONLY that the local transmitter completed sending bytes into the air. It NEVER indicates destination delivery.

## 4. ESP32 Gateway REST API (v1)

### `GET /api/v1/status`
Returns live radio and gateway telemetry.
```json
{
  "boatId": "BOAT-ALPHA",
  "boatName": "INS Matsya",
  "firmwareVersion": "1.0.0-lora",
  "protocolVersion": "v1",
  "wifiApStatus": "active",
  "apSsid": "SOS-LoRa",
  "ipAddress": "192.168.4.1",
  "loraStatus": "ready",
  "frequency": 433000000,
  "queueLength": 0,
  "freeHeap": 184320,
  "packetsReceived": 12,
  "packetsTransmitted": 8,
  "timestamp": 124800,
  "knownRoutes": [
    {
      "destinationBoatId": "BOAT-BRAVO",
      "nextHopBoatId": "BOAT-BRAVO",
      "hopCount": 1,
      "lastSeen": 120000,
      "rssi": -72
    }
  ]
}
```

### `POST /api/v1/messages`
Submits a message packet for radio transmission.
```json
// Request Body
{
  "id": "msg_1730130000_abc123",
  "destinationBoatId": "BOAT-BRAVO",
  "senderUserId": "CREW-01",
  "recipientUserId": "*",
  "senderName": "Captain Ramesh",
  "text": "Entering harbor channel at 8 knots.",
  "hopLimit": 4
}

// Response Body
{
  "success": true,
  "messageId": "msg_1730130000_abc123",
  "status": "accepted_by_gateway",
  "queuePosition": 1
}
```

### `GET /api/v1/messages?cursor=<cursor>`
Cursor-based message retrieval for multiple phone clients.
```json
{
  "messages": [
    {
      "id": "msg_1730130000_abc123",
      "sourceBoatId": "BOAT-BRAVO",
      "destinationBoatId": "BOAT-ALPHA",
      "senderUserId": "CREW-BRAVO-01",
      "recipientUserId": "*",
      "senderName": "First Mate",
      "text": "Understood, starboard channel clear.",
      "hopCount": 1,
      "rssi": -74,
      "snr": 8.5,
      "createdAt": 125400
    }
  ],
  "nextCursor": "2",
  "hasMore": false,
  "totalPending": 1
}
```
