import {
  createOutgoingMessage,
  validateMessagePayload,
} from '../src/domain/message';
import { validateIdentity } from '../src/domain/identity';
import { DELIVERY_STATE_METADATA } from '../src/domain/delivery';

describe('Domain Models & Validation', () => {
  test('creates outgoing message with queued_local state by default', () => {
    const msg = createOutgoingMessage({
      sourceBoatId: 'BOAT-ALPHA',
      destinationBoatId: 'BOAT-BRAVO',
      senderUserId: 'CREW-01',
      senderName: 'Captain Ramesh',
      text: 'Coordinates 12.9141 N, 74.8560 E. Sea state calm.',
    });

    expect(msg.id).toBeDefined();
    expect(msg.deliveryState).toBe('queued_local');
    expect(msg.isOutgoing).toBe(true);
    expect(msg.sourceBoatId).toBe('BOAT-ALPHA');
    expect(msg.destinationBoatId).toBe('BOAT-BRAVO');
    expect(msg.text).toBe('Coordinates 12.9141 N, 74.8560 E. Sea state calm.');
    expect(msg.hopCount).toBe(1);
    expect(msg.isSimulation).toBe(false);
  });

  test('validates payload against LoRa SX1278 byte capacity', () => {
    const validResult = validateMessagePayload('Mayday! Engine failure.');
    expect(validResult.valid).toBe(true);
    expect(validResult.bytes).toBeGreaterThan(0);

    const emptyResult = validateMessagePayload('');
    expect(emptyResult.valid).toBe(false);
    expect(emptyResult.error).toContain('cannot be empty');

    // Create string exceeding 200 bytes
    const longString = 'A'.repeat(201);
    const overflowResult = validateMessagePayload(longString, 200);
    expect(overflowResult.valid).toBe(false);
    expect(overflowResult.error).toContain('exceeds LoRa payload limit');
  });

  test('validates crew identity parameters', () => {
    expect(
      validateIdentity({
        boatId: 'BOAT-ALPHA',
        userId: 'CREW-01',
        displayName: 'Skipper',
      }).valid
    ).toBe(true);

    expect(
      validateIdentity({
        boatId: '',
        userId: 'CREW-01',
        displayName: 'Skipper',
      }).valid
    ).toBe(false);
  });

  test('contains complete delivery state metadata', () => {
    expect(DELIVERY_STATE_METADATA.queued_local).toBeDefined();
    expect(DELIVERY_STATE_METADATA.accepted_by_gateway).toBeDefined();
    expect(DELIVERY_STATE_METADATA.transmitted_to_next_hop).toBeDefined();
    expect(DELIVERY_STATE_METADATA.delivered_to_destination_gateway).toBeDefined();
    expect(DELIVERY_STATE_METADATA.delivered_to_recipient).toBeDefined();
    expect(DELIVERY_STATE_METADATA.failed).toBeDefined();
    expect(DELIVERY_STATE_METADATA.expired).toBeDefined();
  });
});
