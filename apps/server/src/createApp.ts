import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Server } from 'socket.io'
import { RoomManager } from '@arcade/tap-race/server/roomManager'
import { createDb, getTopScores, saveResults } from './db'
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

    const roomCheckMatch = req.method === 'GET' && req.url?.match(/^\/api\/rooms\/([A-Z0-9]+)$/)
    if (roomCheckMatch) {
      const exists = manager.get(roomCheckMatch[1]) !== undefined
      res.writeHead(exists ? 200 : 404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ exists }))
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
        res.end(JSON.stringify({ rooms: manager.list() }))
        return
      }

      if (req.method === 'POST' && req.url === '/api/admin/rooms') {
        const code = manager.create()
        res.writeHead(201, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ code }))
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

    socket.on('JOIN_ROOM', (data: { code: string; name: string }) => {
      const room = manager.get(data.code?.toUpperCase())
      if (!room) { socket.emit('ERROR', { message: 'Room introuvable' }); return }
      room.join(socket, data.name ?? 'Anonyme')
    })

    socket.on('HOST_ROOM', (data: { code: string }) => {
      const room = manager.get(data.code?.toUpperCase())
      if (!room) { socket.emit('ERROR', { message: 'Room introuvable' }); return }
      room.watchAsHost(socket)
    })

    socket.on('START_GAME', (data: { code: string }) => {
      manager.get(data.code?.toUpperCase())?.start()
    })

    socket.on('REJOIN_ROOM', (data: { code: string; token: string }) => {
      const room = manager.get(data.code?.toUpperCase())
      if (!room) { socket.emit('ERROR', { message: 'Room introuvable' }); return }
      const ok = room.rejoin(socket, data.token)
      if (!ok) socket.emit('ERROR', { message: 'Token invalide ou expiré' })
    })
  })

  return { httpServer, io }
}
