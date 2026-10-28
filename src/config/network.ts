/**
 * Network and Radio Configuration for SeaLink
 */

export const DEFAULT_GATEWAY_CONFIG = {
  // Proven default ESP32 SoftAP IP address
  host: '192.168.4.1',
  port: 80,
  protocol: 'http',
  // Timeout for local HTTP requests to ESP32 gateway (ms)
  requestTimeoutMs: 4000,
  // Poll interval when connected to ESP32 AP (ms)
  pollIntervalMs: 2500,
  // Known default Wi-Fi AP settings on ESP32
  defaultApSsid: 'SOS-LoRa',
  defaultApPassword: 'maritime123',
} as const;

export const LORA_RADIO_CONSTRAINTS = {
  // Legal Maritime/Amateur Frequency (Hz)
  frequencyHz: 433000000, // 433.0 MHz
  // LoRa SX1278 max theoretical packet is 255 bytes.
  // Reserving 55 bytes for envelope headers, mesh routing metadata, and auth tags leaves ~200 bytes for message payload.
  maxPacketBytes: 255,
  maxPayloadBytes: 200,
  // Safe retry limit for unacknowledged packets
  maxRetries: 3,
  // Exponential backoff base (ms)
  backoffBaseMs: 1200,
  // Packet TTL (hops) to prevent routing loops
  defaultHopLimit: 4,
} as const;
