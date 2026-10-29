import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { messageService } from '../services/messages/MessageService';
import { GatewayStatus } from '../services/gateway/GatewayTypes';
import { DEFAULT_GATEWAY_CONFIG } from '../config/network';

export default function ConnectGatewayScreen() {
  const [gatewayIp, setGatewayIp] = useState<string>(DEFAULT_GATEWAY_CONFIG.host);
  const [gatewayPort, setGatewayPort] = useState<string>(String(DEFAULT_GATEWAY_CONFIG.port));
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [simulationMode, setSimulationMode] = useState(messageService.getSimulationMode());

  const gatewayClient = messageService.getGatewayClient();

  useEffect(() => {
    const config = gatewayClient.getConfig();
    setGatewayIp(config.host);
    setGatewayPort(String(config.port));
    setSimulationMode(messageService.getSimulationMode());

    testConnection();
  }, []);

  const testConnection = async (overrideIp?: string) => {
    setIsConnecting(true);
    setLastError(null);
    setTestResult(null);

    const targetIp = (overrideIp || gatewayIp).trim();
    const portNum = parseInt(gatewayPort, 10) || 80;
    gatewayClient.updateConfig({
      host: targetIp,
      port: portNum,
    });

    const result = await messageService.checkGatewayConnection();
    setIsConnecting(false);

    if (result.isConnected && result.status) {
      setStatus(result.status);
    } else {
      setStatus(null);
      setLastError(result.error || 'Connection failed');
    }
  };

  const handleToggleSimulation = (val: boolean) => {
    setSimulationMode(val);
    messageService.setSimulationMode(val);
    if (val) {
      Alert.alert(
        'Simulation Mode Activated',
        'Synthetic mock traffic will be generated for UI development. Messages are NOT transmitted over the physical SX1278 LoRa radio.'
      );
    }
    testConnection();
  };

  const sendTestPacket = async () => {
    setIsSendingTest(true);
    setTestResult(null);

    try {
      const resp = await gatewayClient.sendMessage({
        id: `ping_${Date.now()}`,
        destinationBoatId: 'ALL',
        senderUserId: 'CREW-01',
        recipientUserId: '*',
        senderName: 'Gateway Ping',
        text: `PING / TEST PACKET ${new Date().toLocaleTimeString()}`,
      });

      if (resp.success) {
        setTestResult(`Success: Gateway accepted packet (${resp.messageId}). Buffered in ESP32 radio queue.`);
      } else {
        setTestResult(`Failed: Gateway returned: ${resp.error}`);
      }
    } catch (err: unknown) {
      setTestResult(`Error: ${(err as Error)?.message || 'Transmission failed'}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Simulation Mode Toggle Card */}
      <View style={[styles.card, styles.simCard]}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.simTitle}>Simulation Mode</Text>
            <Text style={styles.simSub}>
              Use synthetic mock traffic to test the chat UI without connecting to physical ESP32 hardware.
            </Text>
          </View>
          <Switch
            value={simulationMode}
            onValueChange={handleToggleSimulation}
            thumbColor={simulationMode ? '#167D6A' : '#778790'}
            trackColor={{ false: '#E8ECEF', true: '#B5E8DC' }}
          />
        </View>
      </View>

      {/* Gateway Address Configuration */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>ESP32 Wi-Fi Gateway Endpoint</Text>
        <Text style={styles.cardSub}>
          Connect phone Wi-Fi to '{DEFAULT_GATEWAY_CONFIG.defaultApSsid}'. Default SoftAP address is {DEFAULT_GATEWAY_CONFIG.host}.
        </Text>

        <View style={styles.formRow}>
          <View style={{ flex: 3 }}>
            <Text style={styles.label}>Gateway IP Address</Text>
            <TextInput
              style={styles.input}
              value={gatewayIp}
              onChangeText={setGatewayIp}
              placeholder="192.168.4.1"
              placeholderTextColor="#82919B"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Port</Text>
            <TextInput
              style={styles.input}
              value={gatewayPort}
              onChangeText={setGatewayPort}
              placeholder="80"
              placeholderTextColor="#82919B"
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Quick Node Presets for Multi-Device Desk Testing */}
        <Text style={[styles.label, { marginTop: 10, marginBottom: 6 }]}>Quick Node Presets (Unique Subnets):</Text>
        <View style={styles.presetRow}>
          <TouchableOpacity
            style={[styles.presetPill, gatewayIp === '192.168.4.1' && styles.presetPillActive]}
            onPress={() => {
              setGatewayIp('192.168.4.1');
              testConnection('192.168.4.1');
            }}
          >
            <Text style={[styles.presetPillText, gatewayIp === '192.168.4.1' && styles.presetPillTextActive]}>
              BOAT-001 (192.168.4.1)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetPill, gatewayIp === '192.168.5.1' && styles.presetPillActive]}
            onPress={() => {
              setGatewayIp('192.168.5.1');
              testConnection('192.168.5.1');
            }}
          >
            <Text style={[styles.presetPillText, gatewayIp === '192.168.5.1' && styles.presetPillTextActive]}>
              BOAT-104 (192.168.5.1)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetPill, gatewayIp === '192.168.6.1' && styles.presetPillActive]}
            onPress={() => {
              setGatewayIp('192.168.6.1');
              testConnection('192.168.6.1');
            }}
          >
            <Text style={[styles.presetPillText, gatewayIp === '192.168.6.1' && styles.presetPillTextActive]}>
              SHORE (192.168.6.1)
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => testConnection()}
          disabled={isConnecting}
          activeOpacity={0.8}
        >
          {isConnecting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Connect & Query Gateway</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Connected Telemetry */}
      {status ? (
        <View style={[styles.card, styles.connectedCard]}>
          <View style={styles.badgeRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.connectedTitle}>GATEWAY ONLINE & CONNECTED</Text>
          </View>

          <View style={styles.telemetryGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Vessel ID</Text>
              <Text style={styles.gridValue}>{status.boatId}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>LoRa Status</Text>
              <Text style={[styles.gridValue, { color: '#167D6A' }]}>
                {status.loraStatus.toUpperCase()} (433 MHz)
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>TX Queue Depth</Text>
              <Text style={styles.gridValue}>{status.queueLength} pkts</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Free Heap</Text>
              <Text style={styles.gridValue}>{Math.round(status.freeHeap / 1024)} KB</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.pingBtn}
            onPress={sendTestPacket}
            disabled={isSendingTest}
            activeOpacity={0.8}
          >
            {isSendingTest ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.pingBtnText}>Send LoRa Test Packet</Text>
            )}
          </TouchableOpacity>

          {testResult && (
            <View style={styles.resultBox}>
              <Text style={styles.resultText}>{testResult}</Text>
            </View>
          )}
        </View>
      ) : lastError ? (
        <View style={[styles.card, styles.errorCard]}>
          <Text style={styles.errorTitle}>Gateway Unreachable</Text>
          <Text style={styles.errorDetail}>{lastError}</Text>

          <View style={styles.troubleshootBox}>
            <Text style={styles.troubleshootHeader}>Quick Setup Checklist:</Text>
            <Text style={styles.troubleshootText}>
              1. Open Wi-Fi Settings and select SSID: '{DEFAULT_GATEWAY_CONFIG.defaultApSsid}'.
            </Text>
            <Text style={styles.troubleshootText}>
              2. Enter AP Password: '{DEFAULT_GATEWAY_CONFIG.defaultApPassword}'.
            </Text>
            <Text style={styles.troubleshootText}>
              3. If phone says "Wi-Fi has no internet", tap "Keep Wi-Fi Connection".
            </Text>
          </View>
        </View>
      ) : null}

      {/* Live Hardware Sensor Telemetry */}
      {status?.telemetry ? (
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Onboard Sensor Telemetry</Text>
          <Text style={styles.cardSub}>Real-time readings from hardware sensors</Text>

          <View style={styles.sensorGrid}>
            <View style={styles.sensorBox}>
              <Text style={styles.sensorLabel}>📍 GPS MODULE (NEO-6M)</Text>
              <Text style={styles.sensorValue}>
                {status.telemetry.gps.hasFix
                  ? `${status.telemetry.gps.latitude.toFixed(4)}°N, ${status.telemetry.gps.longitude.toFixed(4)}°E`
                  : 'Searching for Fix...'}
              </Text>
              <Text style={styles.sensorMeta}>
                Sats: {status.telemetry.gps.satellites} · Speed: {status.telemetry.gps.speedKmph.toFixed(1)} km/h
              </Text>
            </View>

            <View style={[styles.sensorBox, status.telemetry.gas.hazardDetected && styles.sensorAlertBox]}>
              <Text style={styles.sensorLabel}>🔥 GAS / SMOKE (MQ-135)</Text>
              <Text style={[styles.sensorValue, status.telemetry.gas.hazardDetected && styles.sensorAlertText]}>
                {status.telemetry.gas.hazardDetected ? '🚨 HAZARD DETECTED' : '✅ NORMAL AIR QUALITY'}
              </Text>
              <Text style={styles.sensorMeta}>Pin: GPIO27 Digital Read</Text>
            </View>

            <View style={[styles.sensorBox, status.telemetry.motion.capsizingAlert && styles.sensorAlertBox]}>
              <Text style={styles.sensorLabel}>📐 MOTION & TILT (MPU6050)</Text>
              <Text style={[styles.sensorValue, status.telemetry.motion.capsizingAlert && styles.sensorAlertText]}>
                Pitch: {status.telemetry.motion.pitch.toFixed(1)}° · Roll: {status.telemetry.motion.roll.toFixed(1)}°
              </Text>
              <Text style={styles.sensorMeta}>
                {status.telemetry.motion.capsizingAlert ? '⚠️ CAPSIZING WARNING' : 'Stable Vessel Attitude'} · Accel: {status.telemetry.motion.totalAccelG.toFixed(2)}G
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Hardware Pinout Baseline */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Hardware Pinout Baseline</Text>
        <Text style={styles.pinText}>• Radio (SX1278): NSS=5, RST=14, DIO0=26, SCK=18, MISO=19, MOSI=23</Text>
        <Text style={styles.pinText}>• Gas Sensor (MQ-135): DO = GPIO27 (Digital Input)</Text>
        <Text style={styles.pinText}>• Shared I2C (OLED + MPU6050): SDA=GPIO21, SCL=GPIO22</Text>
        <Text style={styles.pinText}>• GPS Module: RX2=GPIO16 (from GPS TX), TX2=GPIO17 (to GPS RX)</Text>
        <Text style={styles.pinText}>• Wi-Fi SoftAP: 'SOS-LoRa', Default IP: 192.168.4.1</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FA' },
  content: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8ECEF',
  },
  simCard: {
    backgroundColor: '#FAF5FF',
    borderColor: '#E9D5FF',
  },
  simTitle: {
    color: '#6B21A8',
    fontSize: 15,
    fontWeight: '800',
  },
  simSub: {
    color: '#7E22CE',
    fontSize: 12,
    marginTop: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeader: {
    color: '#17252D',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardSub: {
    color: '#667780',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  label: {
    color: '#667780',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F2F5F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#24343C',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E7ECEF',
  },
  primaryBtn: {
    backgroundColor: '#167D6A',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  presetPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  presetPillActive: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  presetPillText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },
  presetPillTextActive: {
    color: '#065F46',
    fontWeight: '800',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  connectedCard: {
    borderColor: '#B5E8DC',
    backgroundColor: '#F0FDF4',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#42B883',
  },
  connectedTitle: {
    color: '#167D6A',
    fontWeight: '800',
    fontSize: 13,
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  gridItem: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8ECEF',
  },
  gridLabel: {
    color: '#778790',
    fontSize: 11,
    fontWeight: '600',
  },
  gridValue: {
    color: '#17252D',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  pingBtn: {
    backgroundColor: '#167D6A',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  pingBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  resultBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B5E8DC',
  },
  resultText: {
    color: '#167D6A',
    fontSize: 12,
  },
  sensorGrid: {
    gap: 8,
  },
  sensorBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sensorAlertBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  sensorLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sensorValue: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  sensorAlertText: {
    color: '#DC2626',
  },
  sensorMeta: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  errorCard: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  errorTitle: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  errorDetail: {
    color: '#B91C1C',
    fontSize: 12,
    marginBottom: 10,
  },
  troubleshootBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  troubleshootHeader: {
    color: '#991B1B',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  troubleshootText: {
    color: '#667780',
    fontSize: 11,
    marginBottom: 3,
    lineHeight: 15,
  },
  pinText: {
    color: '#667780',
    fontSize: 12,
    fontFamily: 'monospace',
    marginVertical: 2,
  },
});
