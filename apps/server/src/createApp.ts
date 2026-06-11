import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { Server, type Socket } from 'socket.io'
import { z } from 'zod'
import {
  JoinRoomSchema,
  HostRoomSchema,
  StartGameSchema,
  LeaveRoomSchema,
  RejoinRoomSchema,
} from '@arcade/shared'
import { RoomManager } from '@arcade/tap-race/server/roomManager'
import { createDb, getTopScores, saveResults, getPlayerStats } from './db'
import { createRedisAdapter } from './redisAdapter'
import { createRateLimiter } from './rateLimiter'

/**
 * Enregistre un handler de message WS qui valide le payload via Zod avant de
 * l'exécuter, et isole toute exception : un message malformé répond `ERROR`
 * au lieu de remonter en `uncaughtException` (Socket.IO n'attrape pas les
 * exceptions de listener — cf. socket.js dispatch via process.nextTick).
 */
function onSafe<S extends z.ZodTypeAny>(
  socket: Socket,
  event: string,
  schema: S,
  handler: (data: z.infer<S>) => void,
): void {
  socket.on(event, (raw: unknown) => {
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      socket.emit('ERROR', { message: 'Requête invalide' })
      return
    }
    try {
      handler(parsed.data)
    } catch (err) {
      console.error(`[ws:${event}]`, err)
    }
  })
}

/**
 * Décide si une origine HTTP est autorisée par CORS. Par défaut (dev) seules
 * les origines localhost sont acceptées ; en prod, l'allowlist est CLIENT_ORIGIN.
 */
export function isOriginAllowed(origin: string | undefined, configured: string | undefined): boolean {
  if (!origin) return false
  if (configured) return origin === configured
  return /^http:\/\/localhost(:\d+)?$/.test(origin)
}

export function createApp(dbPath = process.env.DB_PATH ?? './arcade.db') {
  const db = createDb(dbPath)
  const httpLimiter = createRateLimiter({ max: Number(process.env.HTTP_RATE_MAX ?? 200), windowMs: 10_000 })
  const socketLimiter = createRateLimiter({ max: Number(process.env.WS_RATE_MAX ?? 100), windowMs: 10_000 })
  let manager: RoomManager

  function isAdminAuthorized(req: IncomingMessage): boolean {
    const token = process.env.ADMIN_TOKEN
    if (!token) return false
    const provided = req.headers['authorization']
    if (typeof provided !== 'string') return false
    const expected = `Bearer ${token}`
    const a = Buffer.from(provided)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  }

  function handleHttp(req: IncomingMessage, res: ServerResponse): void {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined
    if (origin && isOriginAllowed(origin, process.env.CLIENT_ORIGIN)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    }
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const ip = req.socket.remoteAddress ?? 'unknown'
    if (!httpLimiter(ip)) {
      res.writeHead(429, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Too Many Requests' }))
      return
    }

    if (req.method === 'GET' && req.url === '/api/leaderboard') {
      try {
        const scores = getTopScores(db)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(scores))
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Internal Server Error')
      }
      return
    }

    const playerMatch = req.method === 'GET' && req.url?.match(/^\/api\/players\/(.+)$/)
    if (playerMatch) {
      let name: string
      try {
        name = decodeURIComponent(playerMatch[1])
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Nom invalide' }))
        return
      }
      const stats = getPlayerStats(db, name)
      if (!stats) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Joueur introuvable' })); return }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(stats))
      return
    }

    const roomCheckMatch = req.method === 'GET' && req.url?.match(/^\/api\/rooms\/([A-Z0-9]+)$/)
    if (roomCheckMatch) {
      const room = manager.get(roomCheckMatch[1])
      if (!room) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ exists: false, mode: 'solo', teams: [] }))
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ exists: true, ...room.getConfig() }))
      }
      return
    }

    if (req.url?.startsWith('/api/admin/')) {
      if (!isAdminAuthorized(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Unauthorized' }))
        return
      }

      if (req.method === 'GET' && req.url === '/api/admin/rooms') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ rooms: manager.listWithStatus() }))
        return
      }

      if (req.method === 'POST' && req.url === '/api/admin/rooms') {
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => {
          let config: { mode: 'solo' | 'team'; teams: { id: string; name: string; color: string }[] } = { mode: 'solo', teams: [] }
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString())
            if (body.mode === 'team' && Array.isArray(body.teams)) config = { mode: 'team', teams: body.teams }
          } catch {}
          const code = manager.create(config)
          const hostToken = manager.get(code)?.hostToken
          res.writeHead(201, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ code, hostToken }))
        })
        return
      }

      const deleteMatch = req.method === 'DELETE' && req.url?.match(/^\/api\/admin\/rooms\/([A-Z0-9]+)$/)
      if (deleteMatch) {
        manager.delete(deleteMatch[1])
        res.writeHead(204)
        res.end()
        return
      }

      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  }

  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    try {
      handleHttp(req, res)
    } catch (err) {
      console.error('[http]', err)
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Internal Server Error' }))
      }
    }
  })

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN ?? /^http:\/\/localhost(:\d+)?$/,
      methods: ['GET', 'POST'],
    },
  })

  io.use((socket, next) => {
    if (socketLimiter(socket.handshake.address)) { next(); return }
    next(new Error('Too Many Requests'))
  })

  if (process.env.REDIS_URL) {
    const { adapter } = createRedisAdapter(process.env.REDIS_URL)
    io.adapter(adapter)
  }

  manager = new RoomManager(io, {
    saveResults: (players) => saveResults(db, players),
  })

  io.on('connection', (socket) => {
    socket.emit('hello', { message: 'Connected to Arcade server' })

    onSafe(socket, 'JOIN_ROOM', JoinRoomSchema, (data) => {
      for (const r of socket.rooms) { if (r !== socket.id) socket.leave(r) }
      const room = manager.get(data.code)
      if (!room) { socket.emit('ERROR', { message: 'Room introuvable' }); return }
      room.join(socket, data.name, data.teamId)
    })

    onSafe(socket, 'HOST_ROOM', HostRoomSchema, (data) => {
      const room = manager.get(data.code)
      if (!room) { socket.emit('ERROR', { message: 'Room introuvable' }); return }
      for (const r of socket.rooms) { if (r !== socket.id) socket.leave(r) }
      if (!room.watchAsHost(socket, data.token)) {
        socket.emit('ERROR', { message: 'Accès hôte refusé' })
      }
    })

    onSafe(socket, 'START_GAME', StartGameSchema, (data) => {
      manager.get(data.code)?.start(data.token)
    })

    onSafe(socket, 'LEAVE_ROOM', LeaveRoomSchema, (data) => {
      const room = manager.get(data.code)
      if (room) room.leave(socket)
    })

    onSafe(socket, 'REJOIN_ROOM', RejoinRoomSchema, (data) => {
      for (const r of socket.rooms) { if (r !== socket.id) socket.leave(r) }
      const room = manager.get(data.code)
      if (!room) { socket.emit('ERROR', { message: 'Room introuvable' }); return }
      const ok = room.rejoin(socket, data.token)
      if (!ok) socket.emit('ERROR', { message: 'Token invalide ou expiré' })
    })
  })

  return { httpServer, io }
}
