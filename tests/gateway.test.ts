import { GatewayClient, GatewayError } from '../src/services/gateway/GatewayClient';

describe('GatewayClient HTTP & Error Handling', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('successfully fetches gateway status from ESP32 endpoint', async () => {
    const mockStatus = {
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
      packetsReceived: 5,
      packetsTransmitted: 3,
      knownRoutes: [],
      timestamp: Date.now(),
    };

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockStatus,
    } as any);

    const client = new GatewayClient({ host: '192.168.4.1' });
    const status = await client.getStatus();

    expect(status.boatId).toBe('BOAT-ALPHA');
    expect(status.loraStatus).toBe('ready');
    expect(status.frequency).toBe(433000000);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://192.168.4.1/api/v1/status',
      expect.anything()
    );
  });

  test('handles HTTP error responses from gateway', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: 'Payload exceeds 200 bytes limit' }),
    } as any);

    const client = new GatewayClient({ host: '192.168.4.1' });

    await expect(
      client.sendMessage({
        id: 'msg_test',
        destinationBoatId: 'BOAT-BRAVO',
        senderUserId: 'CREW-01',
        recipientUserId: '*',
        senderName: 'Captain',
        text: 'A'.repeat(250),
      })
    ).rejects.toThrow('Payload exceeds 200 bytes limit');
  });

  test('handles timeout when ESP32 gateway is unreachable', async () => {
    globalThis.fetch = jest.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const client = new GatewayClient({ host: '192.168.4.1', timeoutMs: 50 });

    try {
      await client.getStatus();
      fail('Should have thrown GatewayError');
    } catch (err: unknown) {
      const gErr = err as GatewayError;
      expect(gErr.name).toBe('GatewayError');
      expect(gErr.code).toBe('TIMEOUT');
      expect(gErr.message).toContain('timed out');
    }
  });

  test('supports clearly marked simulation mode without network requests', async () => {
    const client = new GatewayClient({ simulationMode: true });
    const status = await client.getStatus();

    expect(status.boatId).toContain('SIM');
    expect(status.loraStatus).toBe('ready');

    const sendResp = await client.sendMessage({
      id: 'sim_test',
      destinationBoatId: 'BOAT-BRAVO',
      senderUserId: 'CREW-01',
      recipientUserId: '*',
      senderName: 'Captain',
      text: 'Simulated transmission',
    });

    expect(sendResp.success).toBe(true);
    expect(sendResp.status).toBe('accepted_by_gateway');
  });
});
