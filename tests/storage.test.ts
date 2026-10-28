import { messageRepository } from '../src/services/messages/MessageRepository';
import { createOutgoingMessage } from '../src/domain/message';
import { DEFAULT_IDENTITY } from '../src/domain/identity';

describe('MessageRepository and Persistence', () => {
  beforeEach(async () => {
    await messageRepository.clearAll();
  });

  test('saves and retrieves crew identity', async () => {
    const custom = {
      ...DEFAULT_IDENTITY,
      boatId: 'BOAT-ZULU',
      boatName: 'Samudra Shakti',
      displayName: 'Commander Rao',
    };

    await messageRepository.saveIdentity(custom);
    const retrieved = await messageRepository.getIdentity();

    expect(retrieved.boatId).toBe('BOAT-ZULU');
    expect(retrieved.boatName).toBe('Samudra Shakti');
    expect(retrieved.displayName).toBe('Commander Rao');
  });

  test('persists messages locally across queries', async () => {
    const msg1 = createOutgoingMessage({
      sourceBoatId: 'BOAT-ALPHA',
      destinationBoatId: 'BOAT-BRAVO',
      senderUserId: 'CREW-01',
      senderName: 'Captain',
      text: 'Heading north at 10 knots',
    });

    const msg2 = createOutgoingMessage({
      sourceBoatId: 'BOAT-ALPHA',
      destinationBoatId: 'BOAT-CHARLIE',
      senderUserId: 'CREW-01',
      senderName: 'Captain',
      text: 'Entering harbor channel',
    });

    await messageRepository.saveMessage(msg1);
    await messageRepository.saveMessage(msg2);

    const bravoMessages = await messageRepository.getMessagesByBoat('BOAT-BRAVO');
    expect(bravoMessages).toHaveLength(1);
    expect(bravoMessages[0].text).toBe('Heading north at 10 knots');

    const charlieMessages = await messageRepository.getMessagesByBoat('BOAT-CHARLIE');
    expect(charlieMessages).toHaveLength(1);
    expect(charlieMessages[0].text).toBe('Entering harbor channel');
  });

  test('updates message delivery state cleanly', async () => {
    const msg = createOutgoingMessage({
      sourceBoatId: 'BOAT-ALPHA',
      destinationBoatId: 'BOAT-BRAVO',
      senderUserId: 'CREW-01',
      senderName: 'Captain',
      text: 'Testing delivery state transition',
    });

    await messageRepository.saveMessage(msg);

    const updated = await messageRepository.updateDeliveryState(
      msg.id,
      'accepted_by_gateway'
    );
    expect(updated?.deliveryState).toBe('accepted_by_gateway');

    const transmitted = await messageRepository.updateDeliveryState(
      msg.id,
      'transmitted_to_next_hop'
    );
    expect(transmitted?.deliveryState).toBe('transmitted_to_next_hop');
    expect(transmitted?.lastAttemptAt).toBeDefined();
  });

  test('deduplicates incoming messages with identical IDs', async () => {
    const msg = createOutgoingMessage({
      id: 'unique_packet_100',
      sourceBoatId: 'BOAT-BRAVO',
      destinationBoatId: 'BOAT-ALPHA',
      senderUserId: 'CREW-02',
      senderName: 'Officer',
      text: 'Beacon ping received',
    });

    const firstAdd = await messageRepository.deduplicateAndSave([msg]);
    expect(firstAdd).toHaveLength(1);

    // Second insertion of identical message ID
    const secondAdd = await messageRepository.deduplicateAndSave([msg]);
    expect(secondAdd).toHaveLength(0);

    const all = await messageRepository.getAllMessages();
    expect(all).toHaveLength(1);
  });
});
