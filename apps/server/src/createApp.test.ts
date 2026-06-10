import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { io as clientIO, type Socket } from 'socket.io-client'
import type { Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp } from './createApp'

describe('createApp', () => {
  let httpServer: HttpServer
  let port: number
  let baseUrl: string

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        ;({ httpServer } = createApp(':memory:'))
        httpServer.listen(0, () => {
          const addr = httpServer.address()
          port = typeof addr === 'object' && addr !== null ? addr.port : 0
          baseUrl = `http://localhost:${port}`
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
      const client: Socket = clientIO(baseUrl)

      client.on('hello', (data: { message: string }) => {
        expect(data.message).toBe('Connected to Arcade server')
        client.disconnect()
        resolve()
      })

      setTimeout(() => reject(new Error('timeout: hello non reçu')), 3000)
    }))

  describe('GET /api/leaderboard', () => {
    it('returns 200 with an array', async () => {
      const res = await fetch(`${baseUrl}/api/leaderboard`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
    })

    it('returns 404 for unknown routes', async () => {
      const res = await fetch(`${baseUrl}/unknown`)
      expect(res.status).toBe(404)
    })
  })
})
