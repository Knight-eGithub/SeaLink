import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatBubble } from '../../components/ChatBubble';
import { MessageComposer } from '../../components/MessageComposer';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { messageRepository } from '../../services/messages/MessageRepository';
import { messageService } from '../../services/messages/MessageService';
import { SeaLinkMessage } from '../../domain/message';
import { Boat } from '../../domain/boat';

export default function ChatScreen() {
  const { boatId } = useLocalSearchParams<{ boatId: string }>();
  const navigation = useNavigation();

  const [boat, setBoat] = useState<Boat | null>(null);
  const [messages, setMessages] = useState<SeaLinkMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const loadData = useCallback(async () => {
    if (!boatId) return;
    const [b, msgs] = await Promise.all([
      messageRepository.getBoatById(boatId),
      messageRepository.getMessagesByBoat(boatId),
    ]);

    if (b) {
      setBoat(b);
      navigation.setOptions({
        title: `${b.name}`,
      });
    } else {
      navigation.setOptions({
        title: boatId,
      });
    }

    setMessages(msgs);
    setIsLoading(false);
  }, [boatId, navigation]);

  useEffect(() => {
    loadData();

    // Trigger an immediate sync and poll every 2.5s while chat room is open
    messageService.syncGateway();
    const pollTimer = setInterval(() => {
      messageService.syncGateway();
    }, 2500);

    const unsub = messageService.subscribeMessages((updated) => {
      if (!boatId) return;
      const filtered = updated.filter(
        (m) => m.destinationBoatId === boatId || m.sourceBoatId === boatId
      );
      setMessages(filtered);
    });

    return () => {
      clearInterval(pollTimer);
      unsub();
    };
  }, [boatId, loadData]);

  const handleSend = async (text: string) => {
    if (!boatId) return;
    await messageService.sendMessage({
      destinationBoatId: boatId,
      text,
    });
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 80);
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Target Boat Subheader */}
      {boat && (
        <View style={styles.targetBar}>
          <View style={[styles.avatarSmall, { backgroundColor: boat.color || '#347F78' }]}>
            <Text style={styles.avatarLetter}>{boat.name[0]}</Text>
          </View>
          <View style={styles.targetInfo}>
            <Text style={styles.targetTitle}>{boat.name}</Text>
            <Text style={styles.targetSubtitle}>
              {boat.id} · {boat.linkType === 'direct' ? 'Direct 433 MHz LoRa' : `Mesh (${boat.hopCount} hops)`}
            </Text>
          </View>
        </View>
      )}

      <ConnectionBanner />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {isLoading ? (
          <View style={styles.loaderView}>
            <ActivityIndicator size="large" color="#167D6A" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ChatBubble message={item} />}
            contentContainerStyle={messages.length === 0 ? styles.emptyContainer : styles.listContent}
            onContentSizeChange={() => {
              if (messages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: false });
              }
            }}
            ListEmptyComponent={
              <View style={styles.emptyView}>
                <View
                  style={[
                    styles.emptyAvatar,
                    { backgroundColor: boat?.color || '#347F78' },
                  ]}
                >
                  <Text style={styles.emptyAvatarText}>
                    {boat ? boat.name[0] : 'S'}
                  </Text>
                </View>
                <Text style={styles.emptyTitle}>
                  {boat ? boat.name : boatId}
                </Text>
                <Text style={styles.emptySub}>
                  No messages yet. Send a radio packet below to begin offline communications.
                </Text>
              </View>
            }
          />
        )}

        <MessageComposer onSend={handleSend} />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FA' },
  keyboardContainer: { flex: 1 },
  targetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#E8ECEF',
    gap: 10,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  targetInfo: { flex: 1 },
  targetTitle: {
    color: '#17252D',
    fontSize: 14,
    fontWeight: '800',
  },
  targetSubtitle: {
    color: '#778790',
    fontSize: 10,
    marginTop: 1,
  },
  loaderView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyView: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emptyAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyAvatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  emptyTitle: {
    color: '#17252D',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySub: {
    color: '#778790',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
});
