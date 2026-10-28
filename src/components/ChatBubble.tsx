import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SeaLinkMessage } from '../domain/message';
import { DELIVERY_STATE_METADATA } from '../domain/delivery';

interface ChatBubbleProps {
  message: SeaLinkMessage;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isMine = message.isOutgoing;
  const isSos = Boolean(message.isSos);
  const statusMeta = DELIVERY_STATE_METADATA[message.deliveryState];

  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isSos) {
    return (
      <View style={styles.sosContainer}>
        <View style={styles.sosCard}>
          <View style={styles.sosHeader}>
            <View style={styles.sosBadge}>
              <Text style={styles.sosBadgeText}>🚨 SOS DISTRESS ALERT</Text>
            </View>
            <Text style={styles.sosCategory}>
              {message.sosCategory || 'EMERGENCY'}
            </Text>
          </View>

          <Text style={styles.sosText}>{message.text}</Text>

          {message.latitude && message.longitude && (
            <View style={styles.coordsBox}>
              <Text style={styles.coordsText}>
                📍 Position: {message.latitude.toFixed(4)}°N, {message.longitude.toFixed(4)}°E
              </Text>
            </View>
          )}

          <View style={styles.sosFooter}>
            <View style={styles.row}>
              <Text style={styles.sosTime}>
                Vessel: {message.sourceBoatId} · {formattedTime} · Hop: {message.hopCount}
              </Text>
            </View>

            <View style={styles.cloudRow}>
              {message.cloudSynced ? (
                <View style={styles.cloudSyncedBadge}>
                  <Text style={styles.cloudSyncedText}>☁️ Shore Logged to Cloud DB</Text>
                </View>
              ) : (
                <View style={styles.floodingBadge}>
                  <Text style={styles.floodingText}>📡 Flooding Mesh & Shore Node</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.messageRow, isMine ? styles.myRow : styles.theirRow]}>
      <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
        {!isMine && message.senderName && (
          <Text style={styles.senderHeader}>{message.senderName}</Text>
        )}

        <Text style={styles.messageText}>{message.text}</Text>

        <View style={styles.messageFooter}>
          {message.isSimulation && (
            <Text style={styles.simBadge}>[SIM]</Text>
          )}

          {message.hopCount > 1 && (
            <Text style={styles.hopBadge}>{message.hopCount}h</Text>
          )}

          <Text style={styles.time}>{formattedTime}</Text>

          {isMine && (
            <Text style={[styles.check, { color: statusMeta.color }]}>
              {statusMeta.shortCode}
            </Text>
          )}
        </View>

        {message.deliveryState === 'failed' && message.errorDetail && (
          <Text style={styles.errorText}>⚠️ {message.errorDetail}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 14,
  },
  myRow: {
    justifyContent: 'flex-end',
  },
  theirRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 6,
    borderRadius: 15,
  },
  myBubble: {
    backgroundColor: '#D5F5E9',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E8ECEF',
  },
  senderHeader: {
    color: '#167D6A',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  messageText: {
    color: '#203039',
    fontSize: 14,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  simBadge: {
    color: '#8C6CA8',
    fontSize: 9,
    fontWeight: '700',
  },
  hopBadge: {
    color: '#5679A6',
    fontSize: 9,
    fontWeight: '600',
  },
  time: {
    color: '#7D8C93',
    fontSize: 9,
  },
  check: {
    fontSize: 11,
    fontWeight: '800',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 10,
    marginTop: 2,
  },
  // SOS Card Styling
  sosContainer: {
    paddingHorizontal: 14,
    marginVertical: 6,
  },
  sosCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  sosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sosBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sosBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sosCategory: {
    color: '#991B1B',
    fontSize: 11,
    fontWeight: '800',
  },
  sosText: {
    color: '#7F1D1D',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  coordsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  coordsText: {
    color: '#991B1B',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  sosFooter: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sosTime: {
    color: '#991B1B',
    fontSize: 10,
    fontWeight: '600',
  },
  cloudRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cloudSyncedBadge: {
    backgroundColor: '#E6F8F2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#B5E8DC',
  },
  cloudSyncedText: {
    color: '#167D6A',
    fontSize: 10,
    fontWeight: '800',
  },
  floodingBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  floodingText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '700',
  },
});
