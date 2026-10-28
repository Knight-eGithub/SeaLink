import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Boat } from '../domain/boat';
import { SeaLinkMessage } from '../domain/message';
import { Colors, Spacing } from '../constants/theme';

interface BoatListItemProps {
  boat: Boat;
  lastMessage?: SeaLinkMessage;
  unreadCount?: number;
  onPress: () => void;
}

export function BoatListItem({
  boat,
  lastMessage,
  unreadCount = 0,
  onPress,
}: BoatListItemProps) {
  const formatTime = (ts: number) => {
    const diffMin = Math.round((Date.now() - ts) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getLinkBadge = () => {
    if (boat.linkType === 'direct') {
      return (
        <View style={[styles.badge, styles.badgeDirect]}>
          <Text style={styles.badgeText}>
            Direct 1-Hop {boat.rssi ? `(${boat.rssi} dBm)` : ''}
          </Text>
        </View>
      );
    }
    if (boat.linkType === 'mesh') {
      return (
        <View style={[styles.badge, styles.badgeMesh]}>
          <Text style={styles.badgeText}>
            Mesh: {boat.hopCount} hops {boat.nextHopBoatId ? `via ${boat.nextHopBoatId}` : ''}
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, styles.badgeOffline]}>
        <Text style={styles.badgeText}>Offline</Text>
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>🚢</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.boatName} numberOfLines={1}>
            {boat.name}
          </Text>
          <Text style={styles.timeText}>
            {lastMessage ? formatTime(lastMessage.createdAt) : formatTime(boat.lastSeen)}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.callSignText}>
            {boat.callSign} • {boat.id}
          </Text>
          {getLinkBadge()}
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.messagePreview} numberOfLines={1}>
            {lastMessage ? (
              `${lastMessage.isOutgoing ? 'You: ' : ''}${lastMessage.text}`
            ) : (
              <Text style={styles.noMessagesText}>No radio messages yet</Text>
            )}
          </Text>

          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: Spacing.md,
    backgroundColor: '#112240',
    borderRadius: 12,
    marginHorizontal: Spacing.md,
    marginVertical: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1D3557',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: 22,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  boatName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  callSignText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeDirect: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  badgeMesh: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  badgeOffline: {
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messagePreview: {
    color: '#CBD5E1',
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  noMessagesText: {
    color: '#64748B',
    fontStyle: 'italic',
  },
  unreadBadge: {
    backgroundColor: '#0077B6',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
