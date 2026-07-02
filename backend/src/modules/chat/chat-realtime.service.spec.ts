import { ChatRealtimeService } from './chat-realtime.service';

describe('ChatRealtimeService', () => {
  let service: ChatRealtimeService;
  const OLD_ENV = process.env;

  beforeEach(() => {
    service = new ChatRealtimeService();
    // Fresh env per test; restore after.
    process.env = { ...OLD_ENV };
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.restoreAllMocks();
  });

  it('isConfigured reflects the env', () => {
    expect(service.isConfigured()).toBe(false);
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
    expect(service.isConfigured()).toBe(true);
  });

  it('degrades (no fetch) when unconfigured', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    await expect(
      service.broadcastToUser('u1', { id: 'm1' }),
    ).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts to the private channel topic with the service-role key when configured', async () => {
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key';
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 202 }));

    await service.broadcastToUser('u1', { conversationId: 'c1', id: 'm1' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://proj.supabase.co/realtime/v1/api/broadcast');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.apikey).toBe('svc-key');
    expect(headers.Authorization).toBe('Bearer svc-key');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0]).toMatchObject({
      topic: 'chat:user:u1',
      event: 'message',
      private: true,
      payload: { conversationId: 'c1', id: 'm1' },
    });
  });

  it('throws on a non-2xx so the caller can log', async () => {
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key';
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 403 }));
    await expect(service.broadcastToUser('u1', { id: 'm1' })).rejects.toThrow(
      /broadcast failed/i,
    );
  });
});
