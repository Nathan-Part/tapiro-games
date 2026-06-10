import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Server } from 'socket.io'
import { RoomManager } from '@arcade/tap-race/server/roomManager'
import { createDb, getTopScores, saveResults } from './db'

export function createApp(dbPath = process.env.DB_PATH ?? './arcade.db') {
  const db = createDb(dbPath)
  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET' && req.url === '/api/leaderboard') {
      try {
        const scores = getTopScores(db)
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
        res.end(JSON.stringify(scores))
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Internal Server Error')
      }
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

  const manager = new RoomManager(io, {
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
