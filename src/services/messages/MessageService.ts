import { messageRepository, MessageRepository } from './MessageRepository';
import { GatewayClient } from '../gateway/GatewayClient';
import {
  SeaLinkMessage,
  createOutgoingMessage,
  createSosEmergencyMessage,
  validateMessagePayload,
  SosEmergencyCategory,
} from '../../domain/message';
import { DeliveryState } from '../../domain/delivery';
import { Boat } from '../../domain/boat';
import { GatewayStatus, RouteEntry } from '../gateway/GatewayTypes';

type MessageListener = (messages: SeaLinkMessage[]) => void;
type StatusListener = (status: { isConnected: boolean; error?: string; gatewayStatus?: GatewayStatus }) => void;
type SosListener = (alert: SeaLinkMessage) => void;
type BoatListener = (boats: Boat[]) => void;

export class MessageService {
  private repository: MessageRepository;
  private gatewayClient: GatewayClient;
  private messageListeners: Set<MessageListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private sosListeners: Set<SosListener> = new Set();
  private boatListeners: Set<BoatListener> = new Set();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private cursor: string | undefined = undefined;
  private isConnected: boolean = false;
  private lastGatewayStatus?: GatewayStatus;
  private isSimulationMode: boolean = false;

  constructor(repository = messageRepository, gatewayClient = new GatewayClient()) {
    this.repository = repository;
    this.gatewayClient = gatewayClient;
  }

  public getGatewayClient(): GatewayClient {
    return this.gatewayClient;
  }

  public setSimulationMode(enabled: boolean): void {
    this.isSimulationMode = enabled;
    this.gatewayClient.updateConfig({ simulationMode: enabled });
    this.notifyStatusListeners();
  }

  public getSimulationMode(): boolean {
    return this.isSimulationMode;
  }

  public subscribeMessages(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener({
      isConnected: this.isConnected,
      gatewayStatus: this.lastGatewayStatus,
    });
    return () => this.statusListeners.delete(listener);
  }

  public subscribeSosAlerts(listener: SosListener): () => void {
    this.sosListeners.add(listener);
    return () => this.sosListeners.delete(listener);
  }

  public subscribeBoats(listener: BoatListener): () => void {
    this.boatListeners.add(listener);
    this.repository.getAllBoats().then((boats) => {
      try {
        listener(boats);
      } catch (err) {
        console.error('[MessageService] Initial boat listener error:', err);
      }
    });
    return () => this.boatListeners.delete(listener);
  }

  private notifyBoatListeners(boats: Boat[]): void {
    for (const listener of this.boatListeners) {
      try {
        listener(boats);
      } catch (err) {
        console.error('[MessageService] Boat listener error:', err);
      }
    }
  }

  private notifyMessageListeners(messages: SeaLinkMessage[]): void {
    for (const listener of this.messageListeners) {
      try {
        listener(messages);
      } catch (err) {
        console.error('[MessageService] Listener error:', err);
      }
    }
  }

  private notifyStatusListeners(error?: string): void {
    for (const listener of this.statusListeners) {
      try {
        listener({
          isConnected: this.isConnected,
          error,
          gatewayStatus: this.lastGatewayStatus,
        });
      } catch (err) {
        console.error('[MessageService] Status listener error:', err);
      }
    }
  }

  private notifySosListeners(alert: SeaLinkMessage): void {
    for (const listener of this.sosListeners) {
      try {
        listener(alert);
      } catch (err) {
        console.error('[MessageService] SOS listener error:', err);
      }
    }
  }

  /**
   * Check connection to the ESP32 gateway and update status.
   */
  async checkGatewayConnection(): Promise<{ isConnected: boolean; error?: string; status?: GatewayStatus }> {
    try {
      const status = await this.gatewayClient.getStatus();
      this.isConnected = true;
      this.lastGatewayStatus = status;

      // Automatically align local crew identity with whichever vessel gateway we connected to
      if (status.boatId && status.boatId !== 'UNKNOWN') {
        const currentIdentity = await this.repository.getIdentity();
        if (currentIdentity.boatId !== status.boatId) {
          await this.repository.saveIdentity({
            ...currentIdentity,
            boatId: status.boatId,
            boatName: status.boatName || `Vessel ${status.boatId}`,
          });
        }
      }

      // Dynamically discover all boats and multi-hop mesh routes reported by gateway radio
      if (status.knownRoutes && status.knownRoutes.length > 0) {
        await this.syncMeshRoutes(status.knownRoutes);
      }

      this.notifyStatusListeners();
      return { isConnected: true, status };
    } catch (err: unknown) {
      this.isConnected = false;
      this.lastGatewayStatus = undefined;
      const errorMsg = (err as Error)?.message || 'Unable to connect to ESP32 Gateway';
      this.notifyStatusListeners(errorMsg);
      return { isConnected: false, error: errorMsg };
    }
  }

  /**
   * Syncs mesh routes discovered by the ESP32 SX1278 transceiver into the mobile app's boat directory.
   */
  public async syncMeshRoutes(routes: RouteEntry[]): Promise<void> {
    if (!routes || routes.length === 0) return;

    let hasChanges = false;
    const existingBoats = await this.repository.getAllBoats();

    for (const route of routes) {
      if (!route.destinationBoatId) continue;

      const idx = existingBoats.findIndex((b) => b.id === route.destinationBoatId);
      const isMesh = route.hopCount > 1;

      if (idx >= 0) {
        const boat = existingBoats[idx];
        const changed =
          boat.hopCount !== route.hopCount ||
          boat.nextHopBoatId !== route.nextHopBoatId ||
          boat.linkType !== (isMesh ? 'mesh' : 'direct') ||
          (route.rssi !== undefined && boat.rssi !== route.rssi);

        if (changed) {
          const updatedBoat: Boat = {
            ...boat,
            hopCount: route.hopCount,
            nextHopBoatId: route.nextHopBoatId,
            linkType: isMesh ? 'mesh' : 'direct',
            rssi: route.rssi ?? boat.rssi,
            lastSeen: Date.now(),
          };
          existingBoats[idx] = updatedBoat;
          await this.repository.saveBoat(updatedBoat);
          hasChanges = true;
        }
      } else {
        // Discovered a brand new boat over the 433 MHz mesh!
        const newBoat: Boat = {
          id: route.destinationBoatId,
          name: route.destinationBoatId === 'SHORE-BASE'
            ? 'Coastal Guard Shore Station'
            : `Vessel ${route.destinationBoatId}`,
          callSign: route.destinationBoatId,
          color: this.generateBoatColor(route.destinationBoatId),
          lastSeen: Date.now(),
          hopCount: route.hopCount,
          nextHopBoatId: route.nextHopBoatId,
          rssi: route.rssi,
          linkType: isMesh ? 'mesh' : 'direct',
          isShoreStation: route.destinationBoatId === 'SHORE-BASE',
        };
        existingBoats.push(newBoat);
        await this.repository.saveBoat(newBoat);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.notifyBoatListeners(existingBoats);
    }
  }

  private generateBoatColor(id: string): string {
    const palette = ['#347F78', '#5679A6', '#8C6CA8', '#A77A48', '#2E8B57', '#4682B4', '#D97706'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
    }
    return palette[Math.abs(hash) % palette.length];
  }

  /**
   * Broadcast an SOS emergency distress packet that floods the LoRa mesh network
   * and reaches the Shore Station for Cloud DB ingestion.
   */
  async broadcastSosDistress(params: {
    category: SosEmergencyCategory;
    details?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<SeaLinkMessage> {
    const identity = await this.repository.getIdentity();

    const sosMessage = createSosEmergencyMessage({
      sourceBoatId: identity.boatId,
      senderUserId: identity.userId,
      senderName: identity.displayName,
      category: params.category,
      additionalDetails: params.details,
      latitude: params.latitude,
      longitude: params.longitude,
      isSimulation: this.isSimulationMode,
    });

    // 1. Immediately store in local database
    await this.repository.saveMessage(sosMessage);
    const all = await this.repository.getAllMessages();
    this.notifyMessageListeners(all);
    this.notifySosListeners(sosMessage);

    // 2. If simulation mode is active, simulate realistic network flood and cloud sync
    if (this.isSimulationMode) {
      setTimeout(async () => {
        await this.repository.updateDeliveryState(sosMessage.id, 'accepted_by_gateway');
        const msgs = await this.repository.getAllMessages();
        this.notifyMessageListeners(msgs);

        setTimeout(async () => {
          await this.repository.updateDeliveryState(sosMessage.id, 'transmitted_to_next_hop');
          // Mark cloud synced by shore
          sosMessage.cloudSynced = true;
          sosMessage.cloudSyncTimestamp = Date.now();
          await this.repository.saveMessage(sosMessage);
          const finalMsgs = await this.repository.getAllMessages();
          this.notifyMessageListeners(finalMsgs);
        }, 1200);
      }, 500);

      return sosMessage;
    }

    // 3. Hardware mode: submit to physical ESP32 gateway over Wi-Fi
    try {
      const response = await this.gatewayClient.sendMessage({
        id: sosMessage.id,
        destinationBoatId: 'SOS-ALL',
        senderUserId: sosMessage.senderUserId,
        recipientUserId: '*',
        senderName: sosMessage.senderName,
        text: sosMessage.text,
        hopLimit: 7, // High hop limit for SOS mesh flood
        isSos: true,
        sosCategory: params.category,
        latitude: params.latitude,
        longitude: params.longitude,
      });

      if (response.success) {
        sosMessage.deliveryState = 'accepted_by_gateway';
        await this.repository.updateDeliveryState(sosMessage.id, 'accepted_by_gateway');
      } else {
        sosMessage.deliveryState = 'failed';
        await this.repository.updateDeliveryState(
          sosMessage.id,
          'failed',
          response.error || 'Gateway refused SOS flood'
        );
      }
    } catch (err: unknown) {
      const errMsg = (err as Error)?.message || 'Failed to dispatch SOS to gateway';
      sosMessage.deliveryState = 'failed';
      await this.repository.updateDeliveryState(sosMessage.id, 'failed', errMsg);
    }

    const updated = await this.repository.getAllMessages();
    this.notifyMessageListeners(updated);
    return sosMessage;
  }

  /**
   * Send a standard chat message to a destination boat.
   */
  async sendMessage(params: {
    destinationBoatId: string;
    text: string;
    recipientUserId?: string;
  }): Promise<SeaLinkMessage> {
    const identity = await this.repository.getIdentity();

    // 1. Validate payload length against SX1278 limits
    const validation = validateMessagePayload(params.text);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 2. Create message in queued_local state
    const message = createOutgoingMessage({
      sourceBoatId: identity.boatId,
      destinationBoatId: params.destinationBoatId,
      senderUserId: identity.userId,
      recipientUserId: params.recipientUserId || '*',
      senderName: identity.displayName,
      text: params.text,
      isSimulation: this.isSimulationMode,
    });

    // 3. Persist locally immediately
    await this.repository.saveMessage(message);
    const currentMessages = await this.repository.getMessagesByBoat(params.destinationBoatId);
    this.notifyMessageListeners(currentMessages);

    // 4. If simulation mode is active, simulate realistic synthetic local progress
    if (this.isSimulationMode) {
      setTimeout(async () => {
        await this.repository.updateDeliveryState(message.id, 'accepted_by_gateway');
        const msgs = await this.repository.getMessagesByBoat(params.destinationBoatId);
        this.notifyMessageListeners(msgs);

        setTimeout(async () => {
          await this.repository.updateDeliveryState(message.id, 'transmitted_to_next_hop');
          const finalMsgs = await this.repository.getMessagesByBoat(params.destinationBoatId);
          this.notifyMessageListeners(finalMsgs);
        }, 800);
      }, 500);

      return message;
    }

    // 5. Hardware mode: submit to physical ESP32 gateway over Wi-Fi
    try {
      const response = await this.gatewayClient.sendMessage({
        id: message.id,
        destinationBoatId: message.destinationBoatId,
        senderUserId: message.senderUserId,
        recipientUserId: message.recipientUserId,
        senderName: message.senderName,
        text: message.text,
      });

      if (response.success) {
        message.deliveryState = 'accepted_by_gateway';
        await this.repository.updateDeliveryState(message.id, 'accepted_by_gateway');
      } else {
        message.deliveryState = 'failed';
        await this.repository.updateDeliveryState(
          message.id,
          'failed',
          response.error || 'Gateway refused message'
        );
      }
    } catch (err: unknown) {
      const errMsg = (err as Error)?.message || 'Failed to dispatch to gateway';
      message.deliveryState = 'failed';
      await this.repository.updateDeliveryState(message.id, 'failed', errMsg);
    }

    const updated = await this.repository.getMessagesByBoat(params.destinationBoatId);
    this.notifyMessageListeners(updated);
    return message;
  }

  /**
   * Poll incoming messages and delivery status from the ESP32 gateway.
   */
  async syncGateway(): Promise<void> {
    if (!this.isConnected && !this.isSimulationMode) {
      await this.checkGatewayConnection();
      if (!this.isConnected) return;
    }

    try {
      const fetchResp = await this.gatewayClient.fetchMessages(this.cursor);
      if (fetchResp.messages && fetchResp.messages.length > 0) {
        const identity = await this.repository.getIdentity();
        const incoming: SeaLinkMessage[] = fetchResp.messages.map((packet) => ({
          id: packet.id,
          sourceBoatId: packet.sourceBoatId,
          destinationBoatId: packet.destinationBoatId,
          senderUserId: packet.senderUserId,
          recipientUserId: packet.recipientUserId,
          senderName: packet.senderName,
          text: packet.text,
          createdAt: packet.createdAt || Date.now(),
          deliveryState: 'delivered_to_recipient',
          isOutgoing: packet.sourceBoatId === identity.boatId && packet.senderUserId === identity.userId,
          hopCount: packet.hopCount || (packet.destinationBoatId === 'ONBOARD-CREW' ? 0 : 1),
          routePath: packet.routePath,
          retryCount: 0,
          rssi: packet.rssi,
          snr: packet.snr,
          isSimulation: false,
          isSos: packet.isSos,
          sosCategory: packet.sosCategory as SosEmergencyCategory | undefined,
          latitude: packet.latitude,
          longitude: packet.longitude,
          cloudSynced: packet.cloudSynced,
        }));

        const added = await this.repository.deduplicateAndSave(incoming);
        if (added.length > 0) {
          const all = await this.repository.getAllMessages();
          this.notifyMessageListeners(all);

          // Discover any unseen boats from incoming message headers
          let boatsChanged = false;
          const currentBoats = await this.repository.getAllBoats();
          for (const msg of added) {
            if (msg.sourceBoatId && msg.sourceBoatId !== identity.boatId) {
              const exists = currentBoats.some((b) => b.id === msg.sourceBoatId);
              if (!exists) {
                const isMesh = (msg.hopCount || 1) > 1;
                const newBoat: Boat = {
                  id: msg.sourceBoatId,
                  name: msg.senderName ? `${msg.senderName}'s Vessel` : `Vessel ${msg.sourceBoatId}`,
                  callSign: msg.sourceBoatId,
                  color: this.generateBoatColor(msg.sourceBoatId),
                  lastSeen: Date.now(),
                  hopCount: msg.hopCount || 1,
                  rssi: msg.rssi,
                  snr: msg.snr,
                  linkType: isMesh ? 'mesh' : 'direct',
                  isShoreStation: msg.sourceBoatId === 'SHORE-BASE',
                };
                currentBoats.push(newBoat);
                await this.repository.saveBoat(newBoat);
                boatsChanged = true;
              }
            }
          }
          if (boatsChanged) {
            this.notifyBoatListeners(currentBoats);
          }

          // If any newly received packet is an SOS, sound the emergency listener
          for (const msg of added) {
            if (msg.isSos) {
              this.notifySosListeners(msg);
            }
          }
        }
      }

      if (fetchResp.nextCursor) {
        this.cursor = fetchResp.nextCursor;
      }
    } catch (err) {
      console.warn('[MessageService] Sync gateway failed:', err);
    }
  }

  /**
   * Start periodic background polling when connected.
   */
  public startPolling(intervalMs = 3000): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      this.syncGateway();
    }, intervalMs);
  }

  public stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

export const messageService = new MessageService();
