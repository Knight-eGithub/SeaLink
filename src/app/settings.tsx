import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { messageRepository } from '../services/messages/MessageRepository';
import { CrewIdentity, DEFAULT_IDENTITY, validateIdentity } from '../domain/identity';

export default function SettingsScreen() {
  const router = useRouter();
  const [identity, setIdentity] = useState<CrewIdentity>(DEFAULT_IDENTITY);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const ident = await messageRepository.getIdentity();
    setIdentity(ident);
  };

  const handleSave = async () => {
    const validation = validateIdentity(identity);
    if (!validation.valid) {
      Alert.alert('Validation Error', validation.error || 'Please fill in required fields.');
      return;
    }

    await messageRepository.saveIdentity(identity);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    Alert.alert('Settings Saved', 'Vessel and crew identity updated successfully.');
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Local Data',
      'This will erase all locally stored messages and restore default settings. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await messageRepository.clearAll();
            await loadSettings();
            Alert.alert('Reset Complete', 'Local database has been reinitialized.');
            router.replace('/');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Vessel Profile Card */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Vessel Identity (Shared Gateway)</Text>
        <Text style={styles.cardSub}>
          Shared by all crew aboard this vessel. Must match the ID configured in the ESP32 gateway.
        </Text>

        <Text style={styles.label}>Vessel Name</Text>
        <TextInput
          style={styles.input}
          value={identity.boatName}
          onChangeText={(v) => setIdentity({ ...identity, boatName: v })}
          placeholder="e.g. SeaLink One"
          placeholderTextColor="#82919B"
        />

        <Text style={styles.label}>Boat ID (LoRa Gateway Address)</Text>
        <TextInput
          style={styles.input}
          value={identity.boatId}
          onChangeText={(v) => setIdentity({ ...identity, boatId: v.toUpperCase() })}
          placeholder="e.g. BOAT-001"
          placeholderTextColor="#82919B"
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Marine Callsign</Text>
        <TextInput
          style={styles.input}
          value={identity.callSign}
          onChangeText={(v) => setIdentity({ ...identity, callSign: v.toUpperCase() })}
          placeholder="e.g. SL-01"
          placeholderTextColor="#82919B"
          autoCapitalize="characters"
        />
      </View>

      {/* Crew Identity Card */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Crew Member Profile</Text>
        <Text style={styles.cardSub}>
          Your individual crew identity on this boat. Messages are signed with this identity.
        </Text>

        <Text style={styles.label}>Display Name / Rank</Text>
        <TextInput
          style={styles.input}
          value={identity.displayName}
          onChangeText={(v) => setIdentity({ ...identity, displayName: v })}
          placeholder="e.g. Captain"
          placeholderTextColor="#82919B"
        />

        <Text style={styles.label}>Crew Member ID</Text>
        <TextInput
          style={styles.input}
          value={identity.userId}
          onChangeText={(v) => setIdentity({ ...identity, userId: v.toUpperCase() })}
          placeholder="e.g. CREW-01"
          placeholderTextColor="#82919B"
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Onboard Role</Text>
        <TextInput
          style={styles.input}
          value={identity.role}
          onChangeText={(v) => setIdentity({ ...identity, role: v })}
          placeholder="e.g. Skipper / Navigator"
          placeholderTextColor="#82919B"
        />
      </View>

      {/* Action Buttons */}
      <TouchableOpacity
        style={[styles.saveBtn, isSaved && styles.saveBtnSuccess]}
        onPress={handleSave}
        activeOpacity={0.8}
      >
        <Text style={styles.saveBtnText}>{isSaved ? '✓ Saved' : 'Save Identity'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.resetBtn}
        onPress={handleReset}
        activeOpacity={0.8}
      >
        <Text style={styles.resetBtnText}>Clear Local Database & Cache</Text>
      </TouchableOpacity>
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
  cardHeader: {
    color: '#17252D',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardSub: {
    color: '#667780',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 17,
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
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: '#167D6A',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveBtnSuccess: {
    backgroundColor: '#42B883',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  resetBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  resetBtnText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 12,
  },
});
