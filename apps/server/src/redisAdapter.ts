import { createAdapter } from '@socket.io/redis-adapter'
import { Redis } from 'ioredis'

export function createRedisAdapter(redisUrl: string) {
  const pubClient = new Redis(redisUrl)
  const subClient = pubClient.duplicate()
  const adapter = createAdapter(pubClient, subClient)
  return { adapter, pubClient, subClient }
}
