import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { io as clientIO, type Socket } from 'socket.io-client'
import type { Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp } from './createApp'

describe('Admin API', () => {
  let server: ReturnType<typeof createApp>['httpServer']
  let baseUrl: string
  const TOKEN = 'test-admin-token'

  beforeAll(async () => {
    process.env.ADMIN_TOKEN = TOKEN
    const app = createApp(':memory:')
    server = app.httpServer
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const addr = server.address() as AddressInfo
    baseUrl = `http://localhost:${addr.port}`
  })

  afterAll(() => {
    server.close()
    delete process.env.ADMIN_TOKEN
  })

  it('GET /api/admin/rooms returns 401 without token', async () => {
    const res = await fetch(`${baseUrl}/api/admin/rooms`)
    expect(res.status).toBe(401)
  })

  it('GET /api/admin/rooms returns 200 with valid token', async () => {
    const res = await fetch(`${baseUrl}/api/admin/rooms`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { rooms: string[] }
    expect(Array.isArray(body.rooms)).toBe(true)
  })

  it('POST /api/admin/rooms creates a room and returns 201', async () => {
    const res = await fetch(`${baseUrl}/api/admin/rooms`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { code: string }
    expect(typeof body.code).toBe('string')
    expect(body.code.length).toBe(4)
  })

  it('POST /api/admin/rooms returns 401 without token', async () => {
    const res = await fetch(`${baseUrl}/api/admin/rooms`, { method: 'POST' })
    expect(res.status).toBe(401)
  })
})

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
