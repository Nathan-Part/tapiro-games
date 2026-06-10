import { createServer } from 'node:http'
import { Server } from 'socket.io'

export function createApp() {
  const httpServer = createServer()

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    socket.emit('hello', { message: 'Connected to Arcade server' })

    socket.on('disconnect', () => {})
  })

  return { httpServer, io }
}
