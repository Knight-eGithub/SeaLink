import { DeliveryState } from './delivery';

export type SosEmergencyCategory =
  | 'GENERAL'
  | 'SINKING'
  | 'FIRE'
  | 'MEDICAL'
  | 'COLLISION'
  | 'ENGINE_FAILURE'
  | 'PIRACY';

export interface SeaLinkMessage {
  id: string;                     // Stable UUID / packet message ID
  sourceBoatId: string;           // Sending vessel ID
  destinationBoatId: string;      // Target vessel ID or "SOS-ALL"
  senderUserId: string;           // Sending crew member ID
  recipientUserId: string;        // Target crew member ID or '*' for all crew
  senderName: string;             // Human readable sender name
  text: string;                   // Message body
  createdAt: number;              // Timestamp (ms)
  deliveryState: DeliveryState;   // Tracked state
  isOutgoing: boolean;            // Sent by user vs received
  hopCount: number;               // 1 = direct, >1 = relay
  routePath?: string[];           // List of boat IDs traversed in mesh
  retryCount: number;             // Transmission attempts made
  lastAttemptAt?: number;         // Last TX timestamp
  isSimulation?: boolean;         // Explicit flag
  errorDetail?: string;           // Failure reason if state is 'failed'
  rssi?: number;                  // LoRa RSSI if received over radio
  snr?: number;                   // LoRa SNR if received over radio
  // Emergency SOS extensions
  isSos?: boolean;                // True if this is an SOS distress flood
  sosCategory?: SosEmergencyCategory;
  latitude?: number;              // GPS coordinates (if available)
  longitude?: number;
  cloudSynced?: boolean;          // True once Shore Station uploaded to cloud DB
  cloudSyncTimestamp?: number;
}

export interface ConversationSummary {
  boatId: string;
  boatName: string;
  callSign: string;
  lastMessage?: SeaLinkMessage;
  unreadCount: number;
  lastActivity: number;
  hasActiveSos?: boolean;
}

export function createOutgoingMessage(params: {
  id?: string;
  sourceBoatId: string;
  destinationBoatId: string;
  senderUserId: string;
  recipientUserId?: string;
  senderName: string;
  text: string;
  isSimulation?: boolean;
  isSos?: boolean;
  sosCategory?: SosEmergencyCategory;
  latitude?: number;
  longitude?: number;
}): SeaLinkMessage {
  const generatedId = params.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  return {
    id: generatedId,
    sourceBoatId: params.sourceBoatId,
    destinationBoatId: params.destinationBoatId,
    senderUserId: params.senderUserId,
    recipientUserId: params.recipientUserId || '*',
    senderName: params.senderName,
    text: params.text.trim(),
    createdAt: Date.now(),
    deliveryState: 'queued_local',
    isOutgoing: true,
    hopCount: 1,
    retryCount: 0,
    isSimulation: Boolean(params.isSimulation),
    isSos: Boolean(params.isSos),
    sosCategory: params.sosCategory,
    latitude: params.latitude,
    longitude: params.longitude,
  };
}

export function createSosEmergencyMessage(params: {
  sourceBoatId: string;
  senderUserId: string;
  senderName: string;
  category: SosEmergencyCategory;
  additionalDetails?: string;
  latitude?: number;
  longitude?: number;
  isSimulation?: boolean;
}): SeaLinkMessage {
  const id = `sos_${Date.now()}_${params.sourceBoatId.replace(/[^A-Za-z0-9]/g, '')}`;
  const coordsStr = params.latitude && params.longitude
    ? ` [POS: ${params.latitude.toFixed(4)}N, ${params.longitude.toFixed(4)}E]`
    : '';
  const detailsStr = params.additionalDetails ? ` - ${params.additionalDetails.trim()}` : '';
  const text = `MAYDAY MAYDAY! ${params.sourceBoatId} (${params.category})${coordsStr}${detailsStr}`;

  return {
    id,
    sourceBoatId: params.sourceBoatId,
    destinationBoatId: 'SOS-ALL',
    senderUserId: params.senderUserId,
    recipientUserId: '*',
    senderName: params.senderName,
    text,
    createdAt: Date.now(),
    deliveryState: 'queued_local',
    isOutgoing: true,
    hopCount: 1,
    retryCount: 0,
    isSimulation: Boolean(params.isSimulation),
    isSos: true,
    sosCategory: params.category,
    latitude: params.latitude,
    longitude: params.longitude,
  };
}

export function validateMessagePayload(text: string, maxBytes = 200): { valid: boolean; error?: string; bytes: number } {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes === 0) {
    return { valid: false, error: 'Message cannot be empty', bytes: 0 };
  }
  if (bytes > maxBytes) {
    return {
      valid: false,
      error: `Message size (${bytes} bytes) exceeds LoRa payload limit (${maxBytes} bytes)`,
      bytes,
    };
  }
  return { valid: true, bytes };
}
