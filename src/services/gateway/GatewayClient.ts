import {
  GatewayConnectionConfig,
  GatewayIdentity,
  GatewayStatus,
  SendMessagePayload,
  SendMessageResponse,
  FetchMessagesResponse,
  MessageStatusResponse,
  SensorTelemetry,
} from './GatewayTypes';
import { DEFAULT_GATEWAY_CONFIG } from '../../config/network';
import { Boat } from '../../domain/boat';

export class GatewayError extends Error {
  code: 'TIMEOUT' | 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'REJECTED';
  constructor(message: string, code: 'TIMEOUT' | 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'REJECTED') {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
  }
}

export class GatewayClient {
  private config: GatewayConnectionConfig;

  constructor(customConfig?: Partial<GatewayConnectionConfig>) {
    this.config = {
      host: customConfig?.host || DEFAULT_GATEWAY_CONFIG.host,
      port: customConfig?.port || DEFAULT_GATEWAY_CONFIG.port,
      useHttps: customConfig?.useHttps ?? false,
      timeoutMs: customConfig?.timeoutMs || DEFAULT_GATEWAY_CONFIG.requestTimeoutMs,
      simulationMode: customConfig?.simulationMode ?? false,
    };
  }

  public getConfig(): GatewayConnectionConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<GatewayConnectionConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public getBaseUrl(): string {
    const proto = this.config.useHttps ? 'https' : 'http';
    const portStr = this.config.port === 80 || this.config.port === 443 ? '' : `:${this.config.port}`;
    return `${proto}://${this.config.host}${portStr}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(options.headers || {}),
        },
      });
      clearTimeout(timer);

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status} ${response.statusText}`;
        try {
          const body = await response.json();
          if (body.error) errorDetail = body.error;
        } catch {
          // Ignore JSON parse error on non-ok response
        }
        throw new GatewayError(`Gateway returned error: ${errorDetail}`, 'REJECTED');
      }

      const data = await response.json();
      return data as T;
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof GatewayError) throw err;

      const anyErr = err as { name?: string; message?: string };
      if (anyErr?.name === 'AbortError') {
        throw new GatewayError(
          `Request to ESP32 at ${this.config.host} timed out after ${this.config.timeoutMs}ms. Verify you are connected to the 'SOS-LoRa' Wi-Fi network.`,
          'TIMEOUT'
        );
      }

      throw new GatewayError(
        `Unable to connect to ESP32 gateway at ${this.config.host}. Check phone Wi-Fi connection. Details: ${anyErr?.message || 'Network request failed'}`,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * GET /api/v1/status
   */
  async getStatus(): Promise<GatewayStatus> {
    if (this.config.simulationMode) {
      return {
        boatId: 'BOAT-SIM-ALPHA',
        boatName: 'INS Simulated',
        firmwareVersion: '1.0.0-sim',
        protocolVersion: 'v1',
        wifiApStatus: 'active',
        apSsid: 'SOS-LoRa-SIM',
        ipAddress: '192.168.4.1',
        loraStatus: 'ready',
        frequency: 433000000,
        queueLength: 0,
        freeHeap: 184320,
        packetsReceived: 12,
        packetsTransmitted: 8,
        rssi: -65,
        snr: 9.2,
        knownRoutes: [
          { destinationBoatId: 'BOAT-BRAVO', nextHopBoatId: 'BOAT-BRAVO', hopCount: 1, lastSeen: Date.now() - 60000, rssi: -72 },
          { destinationBoatId: 'BOAT-CHARLIE', nextHopBoatId: 'BOAT-BRAVO', hopCount: 2, lastSeen: Date.now() - 120000, rssi: -88 },
        ],
        timestamp: Date.now(),
        telemetry: {
          gps: {
            hasFix: true,
            latitude: 12.9141,
            longitude: 74.8560,
            satellites: 8,
            speedKmph: 11.5,
          },
          gas: {
            hazardDetected: false,
            digitalValue: 1,
            status: 'NORMAL',
          },
          motion: {
            pitch: 2.1,
            roll: -1.2,
            totalAccelG: 1.02,
            capsizingAlert: false,
            impactAlert: false,
          },
        },
      };
    }

    try {
      return await this.request<GatewayStatus>('/api/v1/status');
    } catch (primaryErr) {
      // If primary IP fails (e.g. phone switched between SeaLink-BOAT-001 [192.168.4.1] and SeaLink-BOAT-104 [192.168.5.1])
      const candidateHosts = ['192.168.4.1', '192.168.5.1', '192.168.6.1'].filter((h) => h !== this.config.host);
      for (const altHost of candidateHosts) {
        try {
          const altUrl = `http://${altHost}/api/v1/status`;
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 1200);
          const res = await fetch(altUrl, { signal: ctrl.signal });
          clearTimeout(timer);
          if (res.ok) {
            const data = await res.json();
            this.config.host = altHost;
            return data as GatewayStatus;
          }
        } catch {
          // Probe next
        }
      }
      throw primaryErr;
    }
  }

  /**
   * GET /api/v1/telemetry
   */
  async getTelemetry(): Promise<SensorTelemetry> {
    if (this.config.simulationMode) {
      return {
        gps: {
          hasFix: true,
          latitude: 12.9141,
          longitude: 74.8560,
          satellites: 8,
          speedKmph: 11.5,
        },
        gas: {
          hazardDetected: false,
          digitalValue: 1,
          status: 'NORMAL',
        },
        motion: {
          pitch: 2.1,
          roll: -1.2,
          totalAccelG: 1.02,
          capsizingAlert: false,
          impactAlert: false,
        },
      };
    }
    return this.request<SensorTelemetry>('/api/v1/telemetry');
  }

  /**
   * GET /api/v1/identity
   */
  async getIdentity(): Promise<GatewayIdentity> {
    if (this.config.simulationMode) {
      return {
        boatId: 'BOAT-SIM-ALPHA',
        boatName: 'INS Simulated',
        callSign: 'SIM-01',
        apSsid: 'SOS-LoRa-SIM',
        firmwareVersion: '1.0.0-sim',
        protocolVersion: 'v1',
      };
    }

    return this.request<GatewayIdentity>('/api/v1/identity');
  }

  /**
   * POST /api/v1/messages
   */
  async sendMessage(payload: SendMessagePayload): Promise<SendMessageResponse> {
    if (this.config.simulationMode) {
      // In simulation mode, simulate accepting packet
      return {
        success: true,
        messageId: payload.id,
        status: 'accepted_by_gateway',
        queuePosition: 1,
      };
    }

    return this.request<SendMessageResponse>('/api/v1/messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * GET /api/v1/messages?cursor=<cursor>
   */
  async fetchMessages(cursor?: string): Promise<FetchMessagesResponse> {
    if (this.config.simulationMode) {
      return {
        messages: [],
        nextCursor: cursor,
        hasMore: false,
        totalPending: 0,
      };
    }

    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return this.request<FetchMessagesResponse>(`/api/v1/messages${query}`);
  }

  /**
   * GET /api/v1/messages/<messageId>
   */
  async getMessageStatus(messageId: string): Promise<MessageStatusResponse> {
    if (this.config.simulationMode) {
      return {
        messageId,
        status: 'transmitted_to_next_hop',
        retryCount: 0,
        lastAttemptAt: Date.now(),
      };
    }

    return this.request<MessageStatusResponse>(`/api/v1/messages/${encodeURIComponent(messageId)}`);
  }

  /**
   * GET /api/v1/boats
   */
  async getBoats(): Promise<Boat[]> {
    if (this.config.simulationMode) {
      return [];
    }

    const resp = await this.request<{ boats: Boat[] }>('/api/v1/boats');
    return resp.boats || [];
  }
}
