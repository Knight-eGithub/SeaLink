import { MessageService } from '../src/services/messages/MessageService';
import { MessageRepository } from '../src/services/messages/MessageRepository';
import { GatewayClient } from '../src/services/gateway/GatewayClient';

describe('MessageService Workflow and State Machine', () => {
  let repository: MessageRepository;
  let gatewayClient: GatewayClient;
  let service: MessageService;

  beforeEach(async () => {
    repository = new MessageRepository();
    await repository.clearAll();
    gatewayClient = new GatewayClient();
    service = new MessageService(repository, gatewayClient);
  });

  test('queues message locally and transitions to accepted_by_gateway on ESP32 success', async () => {
    jest.spyOn(gatewayClient, 'sendMessage').mockResolvedValue({
      success: true,
      messageId: 'test_msg_id',
      status: 'accepted_by_gateway',
      queuePosition: 1,
    });

    const sent = await service.sendMessage({
      destinationBoatId: 'BOAT-BRAVO',
      text: 'Echo sounder reading 25 fathoms.',
    });

    expect(sent.deliveryState).toBe('accepted_by_gateway');

    const persisted = await repository.getMessagesByBoat('BOAT-BRAVO');
    expect(persisted).toHaveLength(1);
    expect(persisted[0].deliveryState).toBe('accepted_by_gateway');
  });

  test('marks message as failed with error detail when gateway is offline', async () => {
    jest.spyOn(gatewayClient, 'sendMessage').mockRejectedValue(
      new Error('ESP32 Gateway timed out (192.168.4.1)')
    );

    const sent = await service.sendMessage({
      destinationBoatId: 'BOAT-BRAVO',
      text: 'Testing gateway offline failure state.',
    });

    expect(sent.deliveryState).toBe('failed');
    expect(sent.errorDetail).toContain('ESP32 Gateway timed out');

    const persisted = await repository.getMessagesByBoat('BOAT-BRAVO');
    expect(persisted[0].deliveryState).toBe('failed');
  });

  test('syncs incoming radio messages from gateway cursor endpoint', async () => {
    jest.spyOn(gatewayClient, 'getStatus').mockResolvedValue({
      boatId: 'BOAT-ALPHA',
      boatName: 'INS Matsya',
      firmwareVersion: '1.0.0',
      protocolVersion: 'v1',
      wifiApStatus: 'active',
      apSsid: 'SOS-LoRa',
      ipAddress: '192.168.4.1',
      loraStatus: 'ready',
      frequency: 433000000,
      queueLength: 0,
      freeHeap: 180000,
      packetsReceived: 1,
      packetsTransmitted: 0,
      knownRoutes: [],
      timestamp: Date.now(),
    });

    jest.spyOn(gatewayClient, 'fetchMessages').mockResolvedValue({
      messages: [
        {
          id: 'rx_pkt_999',
          sourceBoatId: 'BOAT-BRAVO',
          destinationBoatId: 'BOAT-ALPHA',
          senderUserId: 'CREW-BRAVO-01',
          recipientUserId: '*',
          senderName: 'Officer Rao',
          text: 'Harbor beacon in sight.',
          createdAt: Date.now(),
          hopCount: 1,
          rssi: -74,
          snr: 9.1,
        },
      ],
      nextCursor: 'cursor_1',
      hasMore: false,
      totalPending: 0,
    });

    await service.syncGateway();

    const stored = await repository.getMessagesByBoat('BOAT-BRAVO');
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('rx_pkt_999');
    expect(stored[0].text).toBe('Harbor beacon in sight.');
    expect(stored[0].rssi).toBe(-74);
    expect(stored[0].snr).toBe(9.1);
    expect(stored[0].isOutgoing).toBe(false);
  });

  test('broadcasts SOS emergency distress with mesh flood hopLimit 7 and destination SOS-ALL', async () => {
    const sendSpy = jest.spyOn(gatewayClient, 'sendMessage').mockResolvedValue({
      success: true,
      messageId: 'sos_12345',
      status: 'accepted_by_gateway',
      queuePosition: 1,
    });

    let sosAlertReceived = false;
    service.subscribeSosAlerts((alert) => {
      if (alert.isSos && alert.sosCategory === 'SINKING') {
        sosAlertReceived = true;
      }
    });

    const sosPkt = await service.broadcastSosDistress({
      category: 'SINKING',
      details: 'Taking on water in engine bay',
      latitude: 12.9141,
      longitude: 74.8560,
    });

    expect(sosPkt.isSos).toBe(true);
    expect(sosPkt.destinationBoatId).toBe('SOS-ALL');
    expect(sosPkt.sosCategory).toBe('SINKING');
    expect(sosPkt.latitude).toBe(12.9141);
    expect(sosPkt.longitude).toBe(74.8560);
    expect(sosPkt.deliveryState).toBe('accepted_by_gateway');
    expect(sosAlertReceived).toBe(true);

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationBoatId: 'SOS-ALL',
        isSos: true,
        hopLimit: 7,
      })
    );
  });
});
