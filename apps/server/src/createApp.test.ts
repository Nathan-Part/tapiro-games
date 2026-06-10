import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { io as clientIO, type Socket } from 'socket.io-client'
import type { Server as HttpServer } from 'node:http'
import { createApp } from './createApp'

describe('createApp', () => {
  let httpServer: HttpServer
  let port: number

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        ;({ httpServer } = createApp())
        httpServer.listen(0, () => {
          const addr = httpServer.address()
          port = typeof addr === 'object' && addr !== null ? addr.port : 0
          resolve()
        })
      }),
  )

  afterAll(
    () =>
      new Promise<void>((resolve) => {
        httpServer.close(() => resolve())
      }),
  )

  it('émet hello à la connexion', () =>
    new Promise<void>((resolve, reject) => {
      const client: Socket = clientIO(`http://localhost:${port}`)

      client.on('hello', (data: { message: string }) => {
        expect(data.message).toBe('Connected to Arcade server')
        client.disconnect()
        resolve()
      })

      setTimeout(() => reject(new Error('timeout: hello non reçu')), 3000)
    }))
})
