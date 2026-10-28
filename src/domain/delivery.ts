/**
 * Explicit Delivery States for SeaLink Maritime Messaging.
 *
 * Crucial rule: LoRa.endPacket() success indicates ONLY 'accepted_by_gateway' or
 * 'transmitted_to_next_hop', NEVER 'delivered_to_destination_gateway' or
 * 'delivered_to_recipient'.
 */
export type DeliveryState =
  | 'queued_local'                     // Stored on phone, waiting to be sent to boat's ESP32
  | 'accepted_by_gateway'              // Transferred over Wi-Fi, buffered in local ESP32 queue
  | 'transmitted_to_next_hop'          // ESP32 transmitted packet over LoRa (endPacket succeeded)
  | 'delivered_to_destination_gateway' // LoRa ACK received from target boat gateway
  | 'delivered_to_recipient'           // Recipient's phone client fetched/read the message
  | 'failed'                           // Gateway rejected, timeout, or transmission retry exhausted
  | 'expired';                         // Hop limit reached or TTL expired in mesh

export interface DeliveryStatusInfo {
  label: string;
  shortCode: string;
  color: string;
  description: string;
}

export const DELIVERY_STATE_METADATA: Record<DeliveryState, DeliveryStatusInfo> = {
  queued_local: {
    label: 'Queued on Device',
    shortCode: '⏳',
    color: '#94A3B8',
    description: 'Message waiting to be synced to boat Wi-Fi gateway.',
  },
  accepted_by_gateway: {
    label: 'Accepted by ESP32',
    shortCode: '✓',
    color: '#38BDF8',
    description: 'Received by local boat gateway and queued for LoRa TX.',
  },
  transmitted_to_next_hop: {
    label: 'Transmitted over Radio',
    shortCode: '📡',
    color: '#F59E0B',
    description: 'Radio packet sent by local ESP32 onto 433 MHz LoRa channel.',
  },
  delivered_to_destination_gateway: {
    label: 'Delivered to Boat Gateway',
    shortCode: '🚢',
    color: '#10B981',
    description: 'Radio acknowledgement received from destination boat gateway.',
  },
  delivered_to_recipient: {
    label: 'Delivered to Crew Member',
    shortCode: '✓✓',
    color: '#06D6A0',
    description: 'Recipient crew phone has downloaded and verified this message.',
  },
  failed: {
    label: 'Transmission Failed',
    shortCode: '⚠️',
    color: '#EF4444',
    description: 'LoRa transmission failed or gateway rejected packet.',
  },
  expired: {
    label: 'Message Expired',
    shortCode: '⌛',
    color: '#6B7280',
    description: 'Message exceeded hop count or delivery TTL without reaching destination.',
  },
};
