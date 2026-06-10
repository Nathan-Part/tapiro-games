import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Server } from 'socket.io'
import { RoomManager } from '@arcade/tap-race/server/roomManager'
import { createDb, getTopScores, saveResults, getPlayerStats } from './db'
import { createRedisAdapter } from './redisAdapter'

export function createApp(dbPath = process.env.DB_PATH ?? './arcade.db') {
  const db = createDb(dbPath)
  let manager: RoomManager

  function isAdminAuthorized(req: IncomingMessage): boolean {
    const token = process.env.ADMIN_TOKEN
    if (!token) return false
    return req.headers['authorization'] === `Bearer ${token}`
  }

  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
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
      const stats = getPlayerStats(db, decodeURIComponent(playerMatch[1]))
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
          res.writeHead(201, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ code }))
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

      res.writeHead(404)
      res.end()
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end()
  })

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN ?? /^http:\/\/localhost(:\d+)?$/,
      methods: ['GET', 'POST'],
    },
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

    socket.on('CREATE_ROOM', () => {
      const code = manager.create()
      socket.emit('ROOM_CREATED', { code })
    })

    socket.on('JOIN_ROOM', (data: { code: string; name: string; teamId?: string }) => {
      for (const r of socket.rooms) { if (r !== socket.id) socket.leave(r) }
      const room = manager.get(data.code?.toUpperCase())
      if (!room) { socket.emit('ERROR', { message: 'Room introuvable' }); return }
      room.join(socket, data.name ?? 'Anonyme', data.teamId)
    })

    socket.on('HOST_ROOM', (data: { code: string }) => {
      for (const r of socket.rooms) { if (r !== socket.id) socket.leave(r) }
      const room = manager.get(data.code?.toUpperCase())
      if (!room) { socket.emit('ERROR', { message: 'Room introuvable' }); return }
      room.watchAsHost(socket)
    })

    socket.on('START_GAME', (data: { code: string }) => {
      manager.get(data.code?.toUpperCase())?.start()
    })

    socket.on('LEAVE_ROOM', (data: { code: string }) => {
      const room = manager.get(data.code?.toUpperCase())
      if (room) room.leave(socket)
    })

    socket.on('REJOIN_ROOM', (data: { code: string; token: string }) => {
      for (const r of socket.rooms) { if (r !== socket.id) socket.leave(r) }
      const room = manager.get(data.code?.toUpperCase())
      if (!room) { socket.emit('ERROR', { message: 'Room introuvable' }); return }
      const ok = room.rejoin(socket, data.token)
      if (!ok) socket.emit('ERROR', { message: 'Token invalide ou expiré' })
    })
  })

  return { httpServer, io }
}
