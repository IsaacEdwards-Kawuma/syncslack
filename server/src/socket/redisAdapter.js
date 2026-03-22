/** Optional Redis adapter for Socket.IO (multi-instance). Set REDIS_URL. */
export async function setupRedisAdapter(io) {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return;
  try {
    const { createAdapter } = await import('@socket.io/redis-adapter');
    const { createClient } = await import('redis');
    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[socket] Redis adapter enabled');
  } catch (e) {
    console.error('[socket] Redis adapter failed:', e?.message || e);
  }
}
