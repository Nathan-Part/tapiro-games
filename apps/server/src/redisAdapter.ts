import { createAdapter } from '@socket.io/redis-adapter'
import { Redis } from 'ioredis'

export function createRedisAdapter(redisUrl: string) {
  const pubClient = new Redis(redisUrl)
  const subClient = pubClient.duplicate()
  // sans handler 'error', une coupure Redis émet un 'error' non géré = crash process
  pubClient.on('error', (err) => console.error('[redis:pub]', err))
  subClient.on('error', (err) => console.error('[redis:sub]', err))
  const adapter = createAdapter(pubClient, subClient)
  return { adapter, pubClient, subClient }
}
