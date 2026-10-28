import { storageService } from '../storage/StorageService';
import { SeaLinkMessage, ConversationSummary } from '../../domain/message';
import { DeliveryState } from '../../domain/delivery';
import { Boat, INITIAL_KNOWN_BOATS } from '../../domain/boat';
import { CrewIdentity, DEFAULT_IDENTITY } from '../../domain/identity';

const STORAGE_KEYS = {
  MESSAGES: '@sealink:messages',
  BOATS: '@sealink:boats',
  IDENTITY: '@sealink:identity',
  GATEWAY_CONFIG: '@sealink:gateway_config',
} as const;

export class MessageRepository {
  private messagesCache: SeaLinkMessage[] | null = null;
  private boatsCache: Boat[] | null = null;
  private identityCache: CrewIdentity | null = null;

  async getIdentity(): Promise<CrewIdentity> {
    if (this.identityCache) return this.identityCache;
    const identity = await storageService.getItem<CrewIdentity>(
      STORAGE_KEYS.IDENTITY,
      DEFAULT_IDENTITY
    );
    this.identityCache = identity;
    return identity;
  }

  async saveIdentity(identity: CrewIdentity): Promise<void> {
    this.identityCache = identity;
    await storageService.setItem(STORAGE_KEYS.IDENTITY, identity);
  }

  async getAllMessages(): Promise<SeaLinkMessage[]> {
    if (this.messagesCache) return [...this.messagesCache];
    const messages = await storageService.getItem<SeaLinkMessage[]>(STORAGE_KEYS.MESSAGES, []);
    this.messagesCache = messages;
    return [...messages];
  }

  async getMessagesByBoat(boatId: string): Promise<SeaLinkMessage[]> {
    const all = await this.getAllMessages();
    const identity = await this.getIdentity();
    return all.filter((m) => {
      if (boatId === 'ONBOARD-CREW' || boatId === identity.boatId) {
        return m.destinationBoatId === 'ONBOARD-CREW' || (m.destinationBoatId === identity.boatId && m.sourceBoatId === identity.boatId);
      }
      return m.destinationBoatId === boatId || m.sourceBoatId === boatId;
    }).sort((a, b) => a.createdAt - b.createdAt);
  }

  async saveMessage(message: SeaLinkMessage): Promise<void> {
    const all = await this.getAllMessages();
    const existingIndex = all.findIndex((m) => m.id === message.id);
    if (existingIndex >= 0) {
      all[existingIndex] = message;
    } else {
      all.push(message);
    }
    this.messagesCache = all;
    await storageService.setItem(STORAGE_KEYS.MESSAGES, all);
  }

  async updateDeliveryState(
    messageId: string,
    state: DeliveryState,
    errorDetail?: string
  ): Promise<SeaLinkMessage | null> {
    const all = await this.getAllMessages();
    const target = all.find((m) => m.id === messageId);
    if (!target) return null;

    target.deliveryState = state;
    if (errorDetail) target.errorDetail = errorDetail;
    if (state === 'transmitted_to_next_hop') {
      target.lastAttemptAt = Date.now();
    }

    this.messagesCache = all;
    await storageService.setItem(STORAGE_KEYS.MESSAGES, all);
    return target;
  }

  async deduplicateAndSave(incomingMessages: SeaLinkMessage[]): Promise<SeaLinkMessage[]> {
    if (!incomingMessages.length) return [];
    const all = await this.getAllMessages();
    const added: SeaLinkMessage[] = [];

    for (const msg of incomingMessages) {
      const idx = all.findIndex((m) => m.id === msg.id);
      if (idx === -1) {
        all.push(msg);
        added.push(msg);
      }
    }

    if (added.length > 0) {
      this.messagesCache = all;
      await storageService.setItem(STORAGE_KEYS.MESSAGES, all);
    }
    return added;
  }

  async getAllBoats(): Promise<Boat[]> {
    if (this.boatsCache) return [...this.boatsCache];
    const boats = await storageService.getItem<Boat[]>(STORAGE_KEYS.BOATS, INITIAL_KNOWN_BOATS);
    this.boatsCache = boats;
    return [...boats];
  }

  async saveBoat(boat: Boat): Promise<void> {
    const boats = await this.getAllBoats();
    const idx = boats.findIndex((b) => b.id === boat.id);
    if (idx >= 0) {
      boats[idx] = { ...boats[idx], ...boat };
    } else {
      boats.push(boat);
    }
    this.boatsCache = boats;
    await storageService.setItem(STORAGE_KEYS.BOATS, boats);
  }

  async getBoatById(boatId: string): Promise<Boat | undefined> {
    const boats = await this.getAllBoats();
    return boats.find((b) => b.id === boatId);
  }

  async getConversations(): Promise<ConversationSummary[]> {
    const [boats, messages] = await Promise.all([this.getAllBoats(), this.getAllMessages()]);
    const summaries: ConversationSummary[] = [];

    for (const boat of boats) {
      const boatMessages = messages
        .filter((m) => m.destinationBoatId === boat.id || m.sourceBoatId === boat.id)
        .sort((a, b) => b.createdAt - a.createdAt);

      const lastMessage = boatMessages[0];
      const unreadCount = boatMessages.filter((m) => !m.isOutgoing && m.deliveryState !== 'delivered_to_recipient').length;

      summaries.push({
        boatId: boat.id,
        boatName: boat.name,
        callSign: boat.callSign,
        lastMessage,
        unreadCount,
        lastActivity: lastMessage ? lastMessage.createdAt : boat.lastSeen,
      });
    }

    return summaries.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  async clearAll(): Promise<void> {
    this.messagesCache = null;
    this.boatsCache = null;
    this.identityCache = null;
    await storageService.clear();
  }
}

export const messageRepository = new MessageRepository();
