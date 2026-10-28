import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { messageRepository } from '../services/messages/MessageRepository';
import { messageService } from '../services/messages/MessageService';
import { Boat } from '../domain/boat';

export default function BoatsScreen() {
  const router = useRouter();
  const [boats, setBoats] = useState<Boat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const [newBoatId, setNewBoatId] = useState('');
  const [newBoatName, setNewBoatName] = useState('');
  const [newCallSign, setNewCallSign] = useState('');

  const loadBoats = async () => {
    const list = await messageRepository.getAllBoats();
    setBoats(list);
  };

  useEffect(() => {
    loadBoats();
    const unsub = messageService.subscribeBoats((updated) => {
      setBoats(updated);
    });
    return () => unsub();
  }, []);

  const handleAddBoat = async () => {
    if (!newBoatId.trim() || !newBoatName.trim()) {
      Alert.alert('Validation Error', 'Boat ID and Boat Name are required.');
      return;
    }

    const newBoat: Boat = {
      id: newBoatId.trim().toUpperCase(),
      name: newBoatName.trim(),
      callSign: newCallSign.trim().toUpperCase() || 'V-NEW',
      color: '#347F78',
      lastSeen: Date.now(),
      hopCount: 1,
      linkType: 'direct',
    };

    await messageRepository.saveBoat(newBoat);
    setNewBoatId('');
    setNewBoatName('');
    setNewCallSign('');
    setModalVisible(false);
    await loadBoats();
  };

  const filteredBoats = boats.filter(
    (b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.callSign.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search vessel name or ID..."
          placeholderTextColor="#82919B"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredBoats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/chat/${item.id}` as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.avatar, { backgroundColor: item.color || '#347F78' }]}>
              <Text style={styles.avatarText}>{item.name[0]}</Text>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text style={styles.boatName}>{item.name}</Text>
                <View
                  style={[
                    styles.linkBadge,
                    item.linkType === 'direct'
                      ? styles.badgeDirect
                      : styles.badgeMesh,
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {item.linkType === 'direct'
                      ? 'Direct 1-Hop'
                      : `Mesh (${item.hopCount} hops)`}
                  </Text>
                </View>
              </View>

              <Text style={styles.boatMeta}>
                Callsign: <Text style={styles.highlight}>{item.callSign}</Text> · ID: {item.id}
              </Text>

              {item.nextHopBoatId && (
                <Text style={styles.meshPath}>
                  Routed via gateway: {item.nextHopBoatId}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyView}>
            <Text style={styles.emptyText}>No matching vessels found.</Text>
          </View>
        }
      />

      {/* Add Boat Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Register Vessel</Text>
            <Text style={styles.modalSub}>
              Add an authorized vessel gateway to your fleet directory.
            </Text>

            <Text style={styles.inputLabel}>Boat ID (e.g. BOAT-505)</Text>
            <TextInput
              style={styles.modalInput}
              value={newBoatId}
              onChangeText={setNewBoatId}
              placeholder="BOAT-505"
              placeholderTextColor="#82919B"
              autoCapitalize="characters"
            />

            <Text style={styles.inputLabel}>Vessel Name (e.g. Sea Scout)</Text>
            <TextInput
              style={styles.modalInput}
              value={newBoatName}
              onChangeText={setNewBoatName}
              placeholder="Sea Scout"
              placeholderTextColor="#82919B"
            />

            <Text style={styles.inputLabel}>Callsign (e.g. SS-505)</Text>
            <TextInput
              style={styles.modalInput}
              value={newCallSign}
              onChangeText={setNewCallSign}
              placeholder="SS-505"
              placeholderTextColor="#82919B"
              autoCapitalize="characters"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleAddBoat}
              >
                <Text style={styles.saveBtnText}>Save Vessel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FA' },
  searchRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E8ECEF',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F2F5F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#24343C',
    fontSize: 14,
  },
  addBtn: {
    backgroundColor: '#167D6A',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  listContent: {
    padding: 14,
    paddingBottom: 32,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8ECEF',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  cardBody: { flex: 1 },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  boatName: {
    color: '#17252D',
    fontSize: 15,
    fontWeight: '800',
  },
  linkBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeDirect: {
    backgroundColor: '#E6F8F2',
  },
  badgeMesh: {
    backgroundColor: '#EDF5FD',
  },
  badgeText: {
    color: '#167D6A',
    fontSize: 10,
    fontWeight: '700',
  },
  boatMeta: {
    color: '#667780',
    fontSize: 12,
    marginTop: 2,
  },
  highlight: {
    color: '#167D6A',
    fontWeight: '700',
  },
  meshPath: {
    color: '#84929A',
    fontSize: 10,
    marginTop: 2,
  },
  emptyView: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#778790',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8ECEF',
  },
  modalTitle: {
    color: '#17252D',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSub: {
    color: '#667780',
    fontSize: 12,
    marginBottom: 16,
  },
  inputLabel: {
    color: '#667780',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalInput: {
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
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F2F5F6',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#667780',
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#167D6A',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
