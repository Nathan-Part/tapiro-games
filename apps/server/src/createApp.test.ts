import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { io as clientIO, type Socket } from 'socket.io-client'
import type { Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp, isOriginAllowed } from './createApp'

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
    expect(body.code.length).toBe(6)
  })

  it('POST /api/admin/rooms returns 401 without token', async () => {
    const res = await fetch(`${baseUrl}/api/admin/rooms`, { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('POST /api/admin/rooms returns a hostToken', async () => {
    const res = await fetch(`${baseUrl}/api/admin/rooms`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    const body = await res.json() as { code: string; hostToken: string }
    expect(typeof body.hostToken).toBe('string')
    expect(body.hostToken.length).toBeGreaterThan(10)
  })

  it('HOST_ROOM avec un mauvais token est refusé', async () => {
    const createRes = await fetch(`${baseUrl}/api/admin/rooms`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    const { code } = await createRes.json() as { code: string }
    const client: Socket = clientIO(baseUrl)
    await new Promise<void>((resolve) => client.on('connect', () => resolve()))
    const refused = new Promise<void>((resolve, reject) => {
      client.on('ERROR', () => resolve())
      setTimeout(() => reject(new Error('aucun refus reçu')), 2000)
    })
    client.emit('HOST_ROOM', { code, token: 'mauvais-token' })
    await refused
    client.disconnect()
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

    it('returns 404 with a JSON body for unknown routes', async () => {
      const res = await fetch(`${baseUrl}/unknown`)
      expect(res.status).toBe(404)
      const body = await res.json() as { error?: string }
      expect(body.error).toBeDefined()
    })
  })

  describe('GET /api/players/:name', () => {
    it('returns 400 for malformed percent-encoding instead of crashing', async () => {
      const res = await fetch(`${baseUrl}/api/players/%`)
      expect(res.status).toBe(400)
    })

    it('server stays alive after a malformed players request', async () => {
      await fetch(`${baseUrl}/api/players/%C0`).catch(() => {})
      const res = await fetch(`${baseUrl}/api/leaderboard`)
      expect(res.status).toBe(200)
    })
  })

  describe('WebSocket — robustesse des payloads', () => {
    it('un JOIN_ROOM malformé répond ERROR sans planter le serveur', async () => {
      const client: Socket = clientIO(baseUrl)
      await new Promise<void>((resolve) => client.on('connect', () => resolve()))
      const errorReceived = new Promise<void>((resolve, reject) => {
        client.on('ERROR', () => resolve())
        setTimeout(() => reject(new Error('pas de réponse ERROR — serveur planté ?')), 2000)
      })
      client.emit('JOIN_ROOM') // payload manquant
      await errorReceived
      const res = await fetch(`${baseUrl}/api/leaderboard`)
      expect(res.status).toBe(200)
      client.disconnect()
    })

    it('ne plante pas sur divers payloads malformés', async () => {
      const client: Socket = clientIO(baseUrl)
      await new Promise<void>((resolve) => client.on('connect', () => resolve()))
      client.emit('START_GAME', null)
      client.emit('HOST_ROOM', 42)
      client.emit('LEAVE_ROOM')
      client.emit('REJOIN_ROOM', { code: 123 })
      await new Promise((r) => setTimeout(r, 150))
      const res = await fetch(`${baseUrl}/api/leaderboard`)
      expect(res.status).toBe(200)
      client.disconnect()
    })
  })
})

describe('isOriginAllowed', () => {
  it('autorise localhost par défaut (dev)', () => {
    expect(isOriginAllowed('http://localhost:5173', undefined)).toBe(true)
  })
  it('refuse une origine inconnue', () => {
    expect(isOriginAllowed('http://evil.example', undefined)).toBe(false)
  })
  it('respecte CLIENT_ORIGIN quand configuré', () => {
    expect(isOriginAllowed('https://arcade.app', 'https://arcade.app')).toBe(true)
    expect(isOriginAllowed('http://localhost:5173', 'https://arcade.app')).toBe(false)
  })
  it('refuse une requête sans origine', () => {
    expect(isOriginAllowed(undefined, undefined)).toBe(false)
  })
})
