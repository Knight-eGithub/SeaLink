import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatBubble } from '../components/ChatBubble';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { LORA_RADIO_CONSTRAINTS } from '../config/network';
import { Boat, INITIAL_KNOWN_BOATS } from '../domain/boat';
import { CrewIdentity, DEFAULT_IDENTITY } from '../domain/identity';
import { SeaLinkMessage, SosEmergencyCategory } from '../domain/message';
import { SensorTelemetry } from '../services/gateway/GatewayTypes';
import { messageRepository } from '../services/messages/MessageRepository';
import { messageService } from '../services/messages/MessageService';

const SOS_CATEGORIES: SosEmergencyCategory[] = [
  'ENGINE_FAILURE',
  'SINKING',
  'FIRE',
  'MEDICAL',
  'COLLISION',
  'PIRACY',
  'GENERAL',
];

export default function HomeScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Boat[]>(INITIAL_KNOWN_BOATS);
  const [activeId, setActiveId] = useState<string>(INITIAL_KNOWN_BOATS[0].id);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<SeaLinkMessage[]>([]);
  const [identity, setIdentity] = useState<CrewIdentity>(DEFAULT_IDENTITY);
  const [isSending, setIsSending] = useState(false);
  const [isGatewayConnected, setIsGatewayConnected] = useState(false);
  const [telemetry, setTelemetry] = useState<SensorTelemetry | undefined>(undefined);

  // SOS Emergency Modal State
  const [sosModalVisible, setSosModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<SosEmergencyCategory>('ENGINE_FAILURE');
  const [sosDetails, setSosDetails] = useState('');
  const [isBroadcastingSos, setIsBroadcastingSos] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const loadData = useCallback(async () => {
    const [ident, boatsList] = await Promise.all([
      messageRepository.getIdentity(),
      messageRepository.getAllBoats(),
    ]);

    setIdentity(ident);
    if (boatsList.length > 0) {
      setContacts(boatsList);
    }
  }, []);

  const loadActiveMessages = useCallback(async (boatId: string) => {
    const msgs = await messageRepository.getMessagesByBoat(boatId);
    setMessages(msgs);
  }, []);

  useEffect(() => {
    loadData();

    const unsubMsg = messageService.subscribeMessages(() => {
      loadActiveMessages(activeId);
    });

    const unsubBoats = messageService.subscribeBoats((updatedBoats) => {
      if (updatedBoats.length > 0) {
        setContacts(updatedBoats);
      }
    });

    const unsubStatus = messageService.subscribeStatus((st) => {
      setIsGatewayConnected(st.isConnected);
      if (st.gatewayStatus?.telemetry) {
        setTelemetry(st.gatewayStatus.telemetry);
      }
    });

    messageService.startPolling(3500);

    return () => {
      unsubMsg();
      unsubBoats();
      unsubStatus();
      messageService.stopPolling();
    };
  }, [activeId, loadData, loadActiveMessages]);

  useEffect(() => {
    loadActiveMessages(activeId);
  }, [activeId, loadActiveMessages]);

  const activeContact = contacts.find((c) => c.id === activeId) || contacts[0];

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || isSending) return;

    setDraft('');
    setIsSending(true);

    try {
      await messageService.sendMessage({
        destinationBoatId: activeContact.id,
        text,
      });

      await loadActiveMessages(activeContact.id);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
    } catch (error) {
      console.error('Send failed:', error);
      setDraft(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleBroadcastSos = async () => {
    setIsBroadcastingSos(true);
    try {
      const gps = telemetry?.gps;
      await messageService.broadcastSosDistress({
        category: selectedCategory,
        details: sosDetails.trim(),
        latitude: gps?.hasFix ? gps.latitude : 12.9141,
        longitude: gps?.hasFix ? gps.longitude : 74.8560,
      });

      setSosModalVisible(false);
      setSosDetails('');
      await loadActiveMessages(activeContact.id);
      Alert.alert(
        '🚨 SOS Distress Flood Broadcasted',
        `Distress alert (${selectedCategory}) is flooding the entire 433 MHz LoRa mesh. The Shore Station will log your distress coordinates to the Cloud Database.`
      );
    } catch (err: unknown) {
      Alert.alert('SOS Broadcast Error', (err as Error)?.message || 'Failed to dispatch SOS');
    } finally {
      setIsBroadcastingSos(false);
    }
  };

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) : 0
  );
  const bottomInset = Math.max(insets.bottom, 6);

  const byteLength = new TextEncoder().encode(draft).length;
  const maxBytes = LORA_RADIO_CONSTRAINTS.maxPayloadBytes;
  const isOverLimit = byteLength > maxBytes;

  return (
    <View style={styles.screen}>
      {/* Top Header with Safe Area Notch Protection */}
      <View style={[styles.headerContainer, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Pressable
            style={styles.brandIcon}
            onPress={() => router.push('/connect')}
          >
            <Text style={styles.brandIconText}>S</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>SeaLink</Text>
            <Text style={styles.subtitle}>Your offline messenger</Text>
          </View>

          {/* Emergency SOS Trigger Button */}
          <Pressable
            style={styles.sosButton}
            onPress={() => setSosModalVisible(true)}
          >
            <Text style={styles.sosButtonText}>🚨 SOS</Text>
          </Pressable>

          <Pressable
            style={styles.myStatus}
            onPress={() => router.push('/settings')}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isGatewayConnected ? '#42B883' : '#E5A34B' },
              ]}
            />
            <Text style={styles.myId}>{identity.boatId}</Text>
          </Pressable>
        </View>
      </View>

      {/* Horizontal Fleet Carousel */}
      <View style={styles.contactSection}>
        <FlatList
          horizontal
          data={contacts}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.contacts}
          renderItem={({ item }) => {
            const selected = item.id === activeId;
            const avatarColor = item.color || '#347F78';
            return (
              <Pressable
                style={styles.contact}
                onPress={() => setActiveId(item.id)}
              >
                <View
                  style={[
                    styles.contactAvatar,
                    { backgroundColor: avatarColor },
                    selected && styles.selectedAvatar,
                  ]}
                >
                  <Text style={styles.avatarText}>{item.name[0]}</Text>
                  <View
                    style={[
                      styles.onlineDot,
                      item.linkType === 'mesh' && { backgroundColor: '#5679A6' },
                    ]}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.contactName, selected && styles.selectedName]}
                >
                  {item.name}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Active Chat Header */}
      <View style={styles.chatHeader}>
        <View
          style={[
            styles.chatAvatar,
            { backgroundColor: activeContact.color || '#347F78' },
          ]}
        >
          <Text style={styles.avatarText}>{activeContact.name[0]}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.chatName}>{activeContact.name}</Text>
          <Text style={styles.chatStatus}>
            {activeContact.id === 'ONBOARD-CREW'
              ? 'Local Wi-Fi Intercom · Onboard Comms'
              : `${activeContact.id} · ${activeContact.linkType === 'direct' ? 'Direct 433 MHz LoRa' : `Mesh (${activeContact.hopCount} hops)`}`}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/boats')}
          hitSlop={10}
        >
          <Text style={styles.more}>•••</Text>
        </Pressable>
      </View>

      {/* Connection Notice Banner */}
      <ConnectionBanner />

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        style={styles.messageList}
        contentContainerStyle={[
          styles.messageContent,
          messages.length === 0 && styles.emptyContent,
        ]}
        data={messages}
        keyExtractor={(item) => item.id}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View
              style={[
                styles.largeAvatar,
                { backgroundColor: activeContact.color || '#347F78' },
              ]}
            >
              <Text style={styles.largeAvatarText}>{activeContact.name[0]}</Text>
            </View>
            <Text style={styles.emptyTitle}>{activeContact.name}</Text>
            <Text style={styles.emptySubtitle}>
              Start a conversation. Messages you send will appear here over LoRa radio.
            </Text>
          </View>
        }
        renderItem={({ item }) => <ChatBubble message={item} />}
      />

      {/* Composer with SX1278 Byte Accounting */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            style={[styles.input, isOverLimit && styles.inputOverLimit]}
            placeholder="Type a message..."
            placeholderTextColor="#82919B"
            multiline
            maxLength={maxBytes}
          />
          <Pressable
            onPress={sendMessage}
            disabled={!draft.trim() || isOverLimit || isSending}
            style={[
              styles.sendButton,
              (!draft.trim() || isOverLimit || isSending) && styles.disabled,
            ]}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </Pressable>
        </View>
        <View style={[styles.footerRow, { paddingBottom: bottomInset }]}>
          <Text style={styles.footer}>
            OFFLINE NETWORK · {identity.boatId}
          </Text>
          {draft.length > 0 && (
            <Text
              style={[
                styles.byteCount,
                isOverLimit && { color: '#DC2626', fontWeight: 'bold' },
              ]}
            >
              {byteLength}/{maxBytes} bytes
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* SOS Emergency Distress Modal */}
      <Modal
        visible={sosModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSosModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sosModalCard}>
            <View style={styles.sosModalHeader}>
              <Text style={styles.sosModalTitle}>🚨 BROADCAST SOS DISTRESS</Text>
              <Pressable
                onPress={() => setSosModalVisible(false)}
                hitSlop={8}
              >
                <Text style={styles.closeBtn}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.sosModalDesc}>
              This will flood the entire 433 MHz LoRa mesh network. All vessels within reach will receive an urgent siren, and the Shore Station will log your distress coordinates to the Cloud Database.
            </Text>

            <Text style={styles.sosFieldLabel}>Emergency Distress Type</Text>
            <View style={styles.chipsRow}>
              {SOS_CATEGORIES.map((cat) => {
                const selected = selectedCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    style={[styles.categoryChip, selected && styles.selectedCategoryChip]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text style={[styles.categoryChipText, selected && styles.selectedCategoryChipText]}>
                      {cat.replace('_', ' ')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sosFieldLabel}>Distress Details / Situation</Text>
            <TextInput
              style={styles.sosInput}
              value={sosDetails}
              onChangeText={setSosDetails}
              placeholder="e.g. Taking on water, 4 crew onboard, requesting immediate assistance"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={120}
            />

            <View style={styles.gpsRow}>
              <Text style={styles.gpsText}>
                📍 Hardware GPS: {telemetry?.gps?.hasFix
                  ? `${telemetry.gps.latitude.toFixed(4)}°N, ${telemetry.gps.longitude.toFixed(4)}°E (Sats: ${telemetry.gps.satellites})`
                  : '12.9141°N, 74.8560°E (Searching GPS fix...)'}
              </Text>
            </View>

            {telemetry?.gas?.hazardDetected && (
              <View style={styles.hazardAlertRow}>
                <Text style={styles.hazardAlertText}>
                  🔥 MQ-135 Gas / Smoke Hazard Detected Onboard!
                </Text>
              </View>
            )}

            {telemetry?.motion?.capsizingAlert && (
              <View style={styles.hazardAlertRow}>
                <Text style={styles.hazardAlertText}>
                  ⚠️ MPU6050 Alert: Extreme Vessel Roll ({telemetry.motion.roll.toFixed(1)}°)!
                </Text>
              </View>
            )}

            <View style={styles.modalActionRow}>
              <Pressable
                style={styles.cancelModalBtn}
                onPress={() => setSosModalVisible(false)}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.confirmSosBtn, isBroadcastingSos && styles.disabled]}
                onPress={handleBroadcastSos}
                disabled={isBroadcastingSos}
              >
                <Text style={styles.confirmSosBtnText}>
                  {isBroadcastingSos ? 'Broadcasting...' : '🚨 FLOOD SOS NOW'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F9FA' },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E8ECEF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#167D6A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: { color: 'white', fontSize: 23, fontWeight: '800' },
  headerText: { flex: 1, marginLeft: 11 },
  title: { color: '#17252D', fontSize: 19, fontWeight: '800' },
  subtitle: { color: '#778790', fontSize: 11, marginTop: 2 },
  sosButton: {
    backgroundColor: '#DC2626',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 10,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  myStatus: { alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E5A34B' },
  myId: { color: '#53636D', fontSize: 10, fontWeight: '700' },
  contactSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#E8ECEF',
  },
  contacts: { paddingHorizontal: 12, gap: 20 },
  contact: { alignItems: 'center', width: 66 },
  contactAvatar: {
    width: 49,
    height: 49,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAvatar: { borderWidth: 3, borderColor: '#B5E8DC' },
  avatarText: { color: '#FFFFFF', fontSize: 19, fontWeight: '700' },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#42B883',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  contactName: { color: '#667780', fontSize: 10, marginTop: 6 },
  selectedName: { color: '#167D6A', fontWeight: '800' },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E8ECEF',
  },
  chatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatName: { color: '#17252D', fontSize: 14, fontWeight: '800' },
  chatStatus: { color: '#778790', fontSize: 10, marginTop: 3 },
  more: { color: '#647781', fontSize: 19, letterSpacing: 2 },
  messageList: { flex: 1 },
  messageContent: { paddingHorizontal: 4, paddingVertical: 12 },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 25 },
  largeAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  largeAvatarText: { color: 'white', fontSize: 29, fontWeight: '800' },
  emptyTitle: { color: '#24343C', fontSize: 17, fontWeight: '800' },
  emptySubtitle: {
    color: '#84929A',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 9,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E7ECEF',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: '#F2F5F6',
    color: '#24343C',
    fontSize: 14,
  },
  inputOverLimit: {
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#167D6A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  sendIcon: { color: '#FFFFFF', fontSize: 19 },
  footerRow: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 7,
    paddingTop: 3,
    paddingHorizontal: 16,
  },
  footer: {
    color: '#95A1A7',
    fontSize: 9,
    letterSpacing: 1,
  },
  byteCount: {
    color: '#84929A',
    fontSize: 9,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  sosModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  sosModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sosModalTitle: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  closeBtn: {
    color: '#6B7280',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sosModalDesc: {
    color: '#4B5563',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  sosFieldLabel: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  categoryChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedCategoryChip: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },
  categoryChipText: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '700',
  },
  selectedCategoryChipText: {
    color: '#DC2626',
    fontWeight: '800',
  },
  sosInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#111827',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 50,
    marginBottom: 10,
  },
  gpsRow: {
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 6,
    marginBottom: 14,
  },
  gpsText: {
    color: '#991B1B',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  hazardAlertRow: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  hazardAlertText: {
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '800',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelModalBtnText: {
    color: '#4B5563',
    fontWeight: '700',
  },
  confirmSosBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmSosBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
