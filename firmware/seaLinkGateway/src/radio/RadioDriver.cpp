#include "RadioDriver.h"

static void spiWriteReg(uint8_t cs, uint8_t addr, uint8_t val) {
    digitalWrite(cs, LOW);
    SPI.transfer(addr | 0x80); // Bit 7 = 1 for SPI Write
    SPI.transfer(val);
    digitalWrite(cs, HIGH);
}

static uint8_t spiReadReg(uint8_t cs, uint8_t addr) {
    digitalWrite(cs, LOW);
    SPI.transfer(addr & 0x7F); // Bit 7 = 0 for SPI Read
    uint8_t val = SPI.transfer(0x00);
    digitalWrite(cs, HIGH);
    return val;
}

RadioDriver::RadioDriver() : _initialized(false), _txCount(0), _rxCount(0) {}

bool RadioDriver::begin() {
    Serial.println("[LoRa Init] Configuring SPI Pins (SCK: 18, MISO: 19, MOSI: 23, SS: 5)...");

    // 1. Initialize SPI bus on designated pins
    SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);

    // 2. Hardware reset pulse to wake up SX1278
    pinMode(LORA_SS, OUTPUT);
    digitalWrite(LORA_SS, HIGH);
    pinMode(LORA_RST, OUTPUT);
    digitalWrite(LORA_RST, LOW);
    delay(25);
    digitalWrite(LORA_RST, HIGH);
    delay(60); // Allow PLL and internal oscillators to stabilize

    // 3. Electrical continuity test on MISO (GPIO 19)
    pinMode(LORA_MISO, INPUT_PULLDOWN);
    delay(2);
    int misoLow = digitalRead(LORA_MISO);
    pinMode(LORA_MISO, INPUT_PULLUP);
    delay(2);
    int misoHigh = digitalRead(LORA_MISO);

    // Reset MISO back to normal high-impedance input mode
    pinMode(LORA_MISO, INPUT);

    Serial.printf("[LoRa Diagnostic] MISO pin (GPIO 19) line test: Pulldown=%d, Pullup=%d\n", misoLow, misoHigh);
    if (misoLow == 0 && misoHigh == 1) {
        Serial.println(" -> [DIAGNOSTIC] MISO (GPIO 19) is FLOATING! The jumper wire is loose or not reaching the RA-02 MISO pin.");
    } else if (misoLow == 0 && misoHigh == 0) {
        Serial.println(" -> [DIAGNOSTIC] MISO (GPIO 19) is held LOW (0V). The RA-02 may have no 3.3V power, or MISO is shorted to GND.");
    } else {
        Serial.println(" -> [DIAGNOSTIC] MISO (GPIO 19) electrical continuity is HEALTHY.");
    }

    // 4. Diagnostic check: Read RegVersion (0x42) on GPIO 5
    uint8_t version = spiReadReg(LORA_SS, 0x42);
    Serial.printf("[LoRa Diagnostic] SPI RegVersion read on GPIO 5: 0x%02X (Expected: 0x12)\n", version);

    // 5. If not found on GPIO 5, probe alternate CS pins (15, 4, 2)
    uint8_t workingCs = LORA_SS;
    if (version != 0x12) {
        const uint8_t altCs[] = { 15, 4, 2, 27 };
        for (uint8_t cs : altCs) {
            pinMode(cs, OUTPUT);
            digitalWrite(cs, HIGH);
            delay(2);
            uint8_t altV = spiReadReg(cs, 0x42);
            if (altV == 0x12) {
                Serial.printf(" -> [FOUND!] SX1278 responded on Chip Select GPIO %u!\n", cs);
                workingCs = cs;
                version = 0x12;
                break;
            }
        }
    }

    // Guard: If SX1278 is not returning 0x12, do NOT call LoRa methods that might divide by zero!
    if (version != 0x12) {
        Serial.printf("[LoRa CRITICAL] SX1278 not responding (Version: 0x%02X != 0x12).\n", version);
        Serial.println("                LoRa radio cannot start. System continuing in Gateway Mode (Wi-Fi AP active).");
        Serial.println("                --> Check RA-02: 3.3V power, GND, and GPIO 19 (MISO).");
        _initialized = false;
        return false;
    }

    LoRa.setSPI(SPI);
    LoRa.setPins(workingCs, LORA_RST, LORA_DIO0);
    LoRa.setSPIFrequency(2000000);

    if (!LoRa.begin(LORA_FREQ)) {
        Serial.println("[LoRa] LoRa.begin() failed to lock frequency.");
        _initialized = false;
        return false;
    }

    // Guard against floating MISO causing IntegerDivideByZero inside LoRa.setSpreadingFactor():
    // Pre-populate REG_MODEM_CONFIG_1 (0x1D) with 125 kHz BW (0x72) before reading bandwidth
    spiWriteReg(workingCs, 0x1D, 0x72); // BW: 125kHz, CR: 4/5, Explicit header
    delay(5);

    uint8_t mc1 = spiReadReg(workingCs, 0x1D);
    if ((mc1 >> 4) > 9) {
        Serial.printf("[LoRa WARN] MISO returned invalid bandwidth byte 0x%02X. Applying direct hardware register setup.\n", mc1);
        // Write registers directly over SPI to avoid library division bug:
        spiWriteReg(workingCs, 0x1D, 0x76); // BW: 125 kHz, CR: 4/7, Explicit header
        spiWriteReg(workingCs, 0x1E, 0x94); // SF: 9, CRC: ON
        spiWriteReg(workingCs, 0x26, 0x04); // LDO: 0, AGC: ON
    } else {
        // Safe to use library helpers:
        LoRa.setSignalBandwidth(125000L); // Set BW FIRST so getSignalBandwidth() returns 125000
        LoRa.setSpreadingFactor(9);        // Then set SF (now safe from division by zero)
        LoRa.setCodingRate4(7);
        LoRa.enableCrc();
    }

    Serial.println("[LoRa] SX1278 initialized on 433 MHz (SF: 9, BW: 125 kHz, CR: 4/7, CRC: ON).");
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
        Serial.printf("          Payload: \"%s\" (Sender: %s)\n", packet.payload, packet.senderName);
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
        Serial.printf("\n================ [LoRa INCOMING PACKET] ================\n");
        Serial.printf(" From Vessel : %s (Sender: %s)\n", packet.sourceBoatId, packet.senderName);
        Serial.printf(" To Vessel   : %s (Type: %s, Hop: %u/%u)\n",
                      packet.destinationBoatId, packet.isSos ? "🚨 SOS EMERGENCY" : "STANDARD CHAT",
                      packet.hopCount, packet.hopLimit);
        Serial.printf(" Radio Stats : RSSI: %d dBm, SNR: %.1f dB\n", packet.rssi, packet.snr);
        Serial.printf(" Message Text: \"%s\"\n", packet.payload);
        Serial.printf("========================================================\n\n");
        return true;
    }

    return false;
}
