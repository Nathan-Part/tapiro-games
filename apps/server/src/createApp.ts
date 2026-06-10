import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { RoomManager } from '@arcade/tap-race/server/roomManager'

export function createApp() {
  const httpServer = createServer()

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN ?? /^http:\/\/localhost(:\d+)?$/,
      methods: ['GET', 'POST'],
    },
  })

  const manager = new RoomManager(io)

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
  })

  return { httpServer, io }
}
