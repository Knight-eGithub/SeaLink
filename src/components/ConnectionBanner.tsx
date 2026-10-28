import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { messageService } from '../services/messages/MessageService';
import { GatewayStatus } from '../services/gateway/GatewayTypes';

export function ConnectionBanner() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | undefined>();
  const [isSimulation, setIsSimulation] = useState(false);

  useEffect(() => {
    setIsSimulation(messageService.getSimulationMode());
    const unsub = messageService.subscribeStatus((status) => {
      setIsConnected(status.isConnected);
      setGatewayStatus(status.gatewayStatus);
      setIsSimulation(messageService.getSimulationMode());
    });

    messageService.checkGatewayConnection();
    return unsub;
  }, []);

  const handlePress = () => {
    router.push('/connect');
  };

  if (isSimulation) {
    return (
      <Pressable onPress={handlePress} style={[styles.notice, styles.simNotice]}>
        <Text style={styles.simText}>
          🔒 Simulation mode active · Synthetic mock traffic · Tap to switch to LoRa
        </Text>
      </Pressable>
    );
  }

  if (isConnected && gatewayStatus) {
    return (
      <Pressable onPress={handlePress} style={[styles.notice, styles.connectedNotice]}>
        <Text style={styles.connectedText}>
          📡 LoRa Gateway Online · {gatewayStatus.apSsid} (433 MHz) · Vessel {gatewayStatus.boatId}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handlePress} style={[styles.notice, styles.offlineNotice]}>
      <Text style={styles.offlineText}>
        ⚠️ Offline · Connect Wi-Fi to 'SOS-LoRa' (192.168.4.1) · Tap for setup
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  notice: {
    alignSelf: 'center',
    marginVertical: 6,
    marginHorizontal: 16,
    backgroundColor: '#EAF1EF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  connectedNotice: {
    backgroundColor: '#E6F8F2',
  },
  connectedText: {
    color: '#167D6A',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
  simNotice: {
    backgroundColor: '#F3E8FF',
  },
  simText: {
    color: '#6B21A8',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
  offlineNotice: {
    backgroundColor: '#FEF3C7',
  },
  offlineText: {
    color: '#92400E',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
});
