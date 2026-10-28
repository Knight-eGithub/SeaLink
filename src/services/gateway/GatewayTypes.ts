import { DeliveryState } from '../../domain/delivery';
import { Boat } from '../../domain/boat';

export interface RouteEntry {
  destinationBoatId: string;
  nextHopBoatId: string;
  hopCount: number;
  lastSeen: number;
  rssi?: number;
}

export interface GpsTelemetry {
  hasFix: boolean;
  latitude: number;
  longitude: number;
  satellites: number;
  speedKmph: number;
}

export interface GasTelemetry {
  hazardDetected: boolean;
  digitalValue: number;
  status: 'NORMAL' | 'HAZARDOUS_GAS_DETECTED';
}

export interface MotionTelemetry {
  pitch: number;
  roll: number;
  totalAccelG: number;
  capsizingAlert: boolean;
  impactAlert: boolean;
}

export interface SensorTelemetry {
  gps: GpsTelemetry;
  gas: GasTelemetry;
  motion: MotionTelemetry;
}

export interface GatewayStatus {
  boatId: string;
  boatName: string;
  firmwareVersion: string;
  protocolVersion: string;
  wifiApStatus: 'active' | 'error';
  apSsid: string;
  ipAddress: string;
  loraStatus: 'ready' | 'tx_active' | 'rx_active' | 'error';
  frequency: number; // e.g. 433000000
  queueLength: number;
  freeHeap: number;
  packetsReceived: number;
  packetsTransmitted: number;
  rssi?: number;
  snr?: number;
  knownRoutes: RouteEntry[];
  timestamp: number;
  isShoreGateway?: boolean;
  cloudSyncAvailable?: boolean;
  telemetry?: SensorTelemetry;
}

export interface GatewayIdentity {
  boatId: string;
  boatName: string;
  callSign: string;
  apSsid: string;
  firmwareVersion: string;
  protocolVersion: string;
  isShoreGateway?: boolean;
}

export interface SendMessagePayload {
  id: string;
  destinationBoatId: string;
  senderUserId: string;
  recipientUserId: string;
  senderName: string;
  text: string;
  hopLimit?: number;
  isSos?: boolean;
  sosCategory?: string;
  latitude?: number;
  longitude?: number;
}

export interface SendMessageResponse {
  success: boolean;
  messageId: string;
  status: DeliveryState;
  queuePosition?: number;
  error?: string;
  floodedHops?: number;
}

export interface GatewayPacket {
  id: string;
  sourceBoatId: string;
  destinationBoatId: string;
  senderUserId: string;
  recipientUserId: string;
  senderName: string;
  text: string;
  createdAt: number;
  hopCount: number;
  routePath?: string[];
  rssi?: number;
  snr?: number;
  isSos?: boolean;
  sosCategory?: string;
  latitude?: number;
  longitude?: number;
  cloudSynced?: boolean;
}

export interface FetchMessagesResponse {
  messages: GatewayPacket[];
  nextCursor?: string;
  hasMore: boolean;
  totalPending: number;
}

export interface MessageStatusResponse {
  messageId: string;
  status: DeliveryState;
  retryCount: number;
  lastAttemptAt?: number;
  error?: string;
  cloudSynced?: boolean;
}

export interface GatewayBoatsResponse {
  boats: Boat[];
}

export interface GatewayConnectionConfig {
  host: string;
  port: number;
  useHttps: boolean;
  timeoutMs: number;
  simulationMode: boolean;
}
