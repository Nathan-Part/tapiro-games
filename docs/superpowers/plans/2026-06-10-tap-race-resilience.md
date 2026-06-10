# Tap Race — Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Allow a player who disconnects mid-game to reconnect and recover their score using a localStorage token. (2) Automatically clean up rooms that have been inactive for 30 minutes to prevent memory leaks.

**Architecture:** Each player receives a `playerId` token (UUID) on join; the token is stored in `TapRaceRoom` mapped to `{ socketId, name, score }`. On reconnect the player sends `REJOIN_ROOM { code, token }` and the room restores their score and re-registers their socket. Room cleanup uses a single `setInterval` in `RoomManager` that evicts rooms whose `lastActivity` timestamp is older than 30 minutes. The machine state is not changed — only the room management layer is affected.

**Tech Stack:** `node:crypto` (`randomUUID`), `localStorage` in the browser, Socket.IO (already installed), TypeScript strict.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `games/tap-race/server/tapRaceRoom.ts` | Modify | Store token→player map, handle rejoin, update lastActivity |
| `games/tap-race/server/roomManager.ts` | Modify | Track lastActivity per room, cleanup loop |
| `games/tap-race/shared/messages.ts` | Modify | Add `RejoinRoomSchema` |
| `apps/server/src/createApp.ts` | Modify | Handle `REJOIN_ROOM` event |
| `apps/web/src/pages/PlayerPage.tsx` | Modify | Read/write localStorage token, emit REJOIN_ROOM on mount if token exists |

---

### Task 1: Add RejoinRoomSchema to shared messages

**Files:**
- Modify: `games/tap-race/shared/messages.ts`

- [ ] **Step 1: Write the failing test**

Add to `games/tap-race/shared/messages.test.ts` (create if absent):
```ts
import { describe, it, expect } from 'vitest'
import { RejoinRoomSchema } from './messages'

describe('RejoinRoomSchema', () => {
  it('accepts valid rejoin data', () => {
    const result = RejoinRoomSchema.safeParse({ code: 'AB12', token: 'uuid-here' })
    expect(result.success).toBe(true)
  })

  it('rejects missing token', () => {
    const result = RejoinRoomSchema.safeParse({ code: 'AB12' })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```powershell
$env:PATH = "C:\Users\natou\AppData\Roaming\npm;" + $env:PATH
pnpm --filter @arcade/tap-race test --run
```
Expected: FAIL — `RejoinRoomSchema` not exported.

- [ ] **Step 3: Add schema to messages.ts**

Open `games/tap-race/shared/messages.ts` and add at the end:
```ts
export const RejoinRoomSchema = z.object({
  code: z.string().min(1).max(10),
  token: z.string().uuid(),
})
```

- [ ] **Step 4: Run test — verify it passes**

```powershell
$env:PATH = "C:\Users\natou\AppData\Roaming\npm;" + $env:PATH
pnpm --filter @arcade/tap-race test --run
```
Expected: all tests PASS.

- [ ] **Step 5: Commit suggestion**

> Suggest commit: `feat(tap-race): add RejoinRoomSchema for player reconnection`

---

### Task 2: Implement player token and rejoin in TapRaceRoom

**Files:**
- Modify: `games/tap-race/server/tapRaceRoom.ts`

- [ ] **Step 1: Write failing tests**

Create `games/tap-race/server/tapRaceRoom.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { TapRaceRoom } from './tapRaceRoom'
import type { Server, Socket } from 'socket.io'

function makeMockSocket(id = 'socket-1'): Socket {
  return {
    id,
    join: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
  } as unknown as Socket
}

function makeMockIo(): Server {
  return {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  } as unknown as Server
}

describe('TapRaceRoom — player token', () => {
  it('emits JOINED with a token when player joins', () => {
    const io = makeMockIo()
    const room = new TapRaceRoom(io, 'TEST')
    const socket = makeMockSocket()
    room.join(socket, 'Alice')
    const emitCalls = (socket.emit as ReturnType<typeof vi.fn>).mock.calls
    const joinedCall = emitCalls.find(([event]) => event === 'JOINED')
    expect(joinedCall).toBeDefined()
    expect(joinedCall[1]).toHaveProperty('token')
    expect(typeof joinedCall[1].token).toBe('string')
  })

  it('rejoin restores score and emits GAME_STATE', () => {
    const io = makeMockIo()
    const room = new TapRaceRoom(io, 'TEST')
    const socket1 = makeMockSocket('socket-1')
    room.join(socket1, 'Alice')

    const joinedCall = (socket1.emit as ReturnType<typeof vi.fn>).mock.calls
      .find(([event]) => event === 'JOINED')
    const { token } = joinedCall[1] as { token: string }

    const socket2 = makeMockSocket('socket-2')
    const result = room.rejoin(socket2, token)
    expect(result).toBe(true)
    const emitCalls = (socket2.emit as ReturnType<typeof vi.fn>).mock.calls
    const gameStateCall = emitCalls.find(([event]) => event === 'GAME_STATE')
    expect(gameStateCall).toBeDefined()
  })

  it('rejoin with unknown token returns false', () => {
    const io = makeMockIo()
    const room = new TapRaceRoom(io, 'TEST')
    const socket = makeMockSocket()
    expect(room.rejoin(socket, 'unknown-token')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```powershell
$env:PATH = "C:\Users\natou\AppData\Roaming\npm;" + $env:PATH
pnpm --filter @arcade/tap-race test --run
```
Expected: FAIL — `JOINED` event not emitted, `rejoin` method does not exist.

- [ ] **Step 3: Implement token storage and rejoin**

Replace `games/tap-race/server/tapRaceRoom.ts` with:
```ts
import { randomUUID } from 'node:crypto'
import type { Server, Socket } from 'socket.io'
import { serverReducer, getLeaderboard, initialServerState, type ServerGameState } from './tapRaceGame'
import { TapBatchSchema } from '../shared/messages'

type SaveResultsFn = (players: { name: string; score: number }[]) => void

interface PlayerSession {
  socketId: string
  name: string
  score: number
}

export class TapRaceRoom {
  private state: ServerGameState = { ...initialServerState }
  private tickInterval: ReturnType<typeof setInterval> | null = null
  private leaderboardInterval: ReturnType<typeof setInterval> | null = null
  private scoreInterval: ReturnType<typeof setInterval> | null = null
  private sessions = new Map<string, PlayerSession>()
  lastActivity: number = Date.now()

  constructor(
    private readonly io: Server,
    private readonly roomId: string,
    private readonly saveResults: SaveResultsFn = () => {},
  ) {}

  join(socket: Socket, name: string) {
    const token = randomUUID()
    this.sessions.set(token, { socketId: socket.id, name, score: 0 })
    this.lastActivity = Date.now()

    socket.join(this.roomId)
    this.state = serverReducer(this.state, { type: 'PLAYER_JOIN', id: socket.id, name })

    socket.emit('JOINED', { token })
    socket.emit('GAME_STATE', {
      phase: this.state.phase,
      countdown: this.state.countdown,
      timeLeft: this.state.timeLeft,
    })
    this.io.to(this.roomId).emit('LEADERBOARD_UPDATE', { players: getLeaderboard(this.state) })

    this.registerTapHandler(socket)

    socket.on('disconnect', () => {
      const session = [...this.sessions.entries()].find(([, s]) => s.socketId === socket.id)
      if (session) {
        const [, playerSession] = session
        const currentPlayer = this.state.players[socket.id]
        if (currentPlayer) playerSession.score = currentPlayer.score
      }
      this.state = serverReducer(this.state, { type: 'PLAYER_LEAVE', id: socket.id })
    })
  }

  rejoin(socket: Socket, token: string): boolean {
    const session = this.sessions.get(token)
    if (!session) return false

    this.lastActivity = Date.now()
    session.socketId = socket.id

    socket.join(this.roomId)
    this.state = serverReducer(this.state, { type: 'PLAYER_JOIN', id: socket.id, name: session.name })

    if (this.state.players[socket.id]) {
      this.state = {
        ...this.state,
        players: {
          ...this.state.players,
          [socket.id]: { ...this.state.players[socket.id], score: session.score },
        },
      }
    }

    socket.emit('GAME_STATE', {
      phase: this.state.phase,
      countdown: this.state.countdown,
      timeLeft: this.state.timeLeft,
    })
    socket.emit('SCORE_UPDATE', { score: session.score })

    this.registerTapHandler(socket)

    socket.on('disconnect', () => {
      const s = this.sessions.get(token)
      if (s) {
        const currentPlayer = this.state.players[socket.id]
        if (currentPlayer) s.score = currentPlayer.score
      }
      this.state = serverReducer(this.state, { type: 'PLAYER_LEAVE', id: socket.id })
    })

    return true
  }

  watchAsHost(socket: Socket) {
    socket.join(this.roomId)
    socket.emit('GAME_STATE', {
      phase: this.state.phase,
      countdown: this.state.countdown,
      timeLeft: this.state.timeLeft,
    })
    socket.emit('LEADERBOARD_UPDATE', { players: getLeaderboard(this.state) })
  }

  start() {
    if (this.state.phase === 'RESULTS') {
      this.state = { ...initialServerState }
    }
    if (this.state.phase !== 'WAITING') return
    this.lastActivity = Date.now()
    this.state = serverReducer(this.state, { type: 'START' })
    this.broadcast()

    this.tickInterval = setInterval(() => {
      this.state = serverReducer(this.state, { type: 'TICK' })
      this.broadcast()
      if (this.state.phase === 'RESULTS') {
        this.stopIntervals()
        const leaderboard = getLeaderboard(this.state)
        this.io.to(this.roomId).emit('LEADERBOARD_UPDATE', { players: leaderboard })
        this.saveResults(Object.values(this.state.players).map(p => ({ name: p.name, score: p.score })))
      }
    }, 1000)

    this.leaderboardInterval = setInterval(() => {
      if (this.state.phase === 'PLAYING') {
        this.io.to(this.roomId).emit('LEADERBOARD_UPDATE', { players: getLeaderboard(this.state) })
      }
    }, 100)

    this.scoreInterval = setInterval(() => {
      if (this.state.phase === 'PLAYING') {
        for (const player of Object.values(this.state.players)) {
          this.io.to(player.id).emit('SCORE_UPDATE', { score: player.score })
        }
      }
    }, 200)
  }

  private registerTapHandler(socket: Socket) {
    socket.on('TAP_BATCH', (raw: unknown) => {
      const result = TapBatchSchema.safeParse(raw)
      if (!result.success) return
      this.lastActivity = Date.now()
      this.state = serverReducer(this.state, {
        type: 'TAP_BATCH',
        playerId: socket.id,
        count: result.data.count,
      })
    })
  }

  private broadcast() {
    this.io.to(this.roomId).emit('GAME_STATE', {
      phase: this.state.phase,
      countdown: this.state.countdown,
      timeLeft: this.state.timeLeft,
    })
  }

  private stopIntervals() {
    if (this.tickInterval) clearInterval(this.tickInterval)
    if (this.leaderboardInterval) clearInterval(this.leaderboardInterval)
    if (this.scoreInterval) clearInterval(this.scoreInterval)
    this.tickInterval = null
    this.leaderboardInterval = null
    this.scoreInterval = null
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```powershell
$env:PATH = "C:\Users\natou\AppData\Roaming\npm;" + $env:PATH
pnpm --filter @arcade/tap-race test --run
```
Expected: all tests PASS (new 3 + existing 8 server + 8 client = 19).

- [ ] **Step 5: Commit suggestion**

> Suggest commit: `feat(tap-race): add player token and rejoin support`

---

### Task 3: Handle REJOIN_ROOM in createApp

**Files:**
- Modify: `apps/server/src/createApp.ts`

- [ ] **Step 1: Add REJOIN_ROOM handler**

In the `io.on('connection', ...)` block of `createApp.ts`, add after the `JOIN_ROOM` handler:
```ts
socket.on('REJOIN_ROOM', (data: { code: string; token: string }) => {
  const room = manager.get(data.code?.toUpperCase())
  if (!room) { socket.emit('ERROR', { message: 'Room introuvable' }); return }
  const ok = room.rejoin(socket, data.token)
  if (!ok) socket.emit('ERROR', { message: 'Token invalide ou expiré' })
})
```

- [ ] **Step 2: Run typecheck**

```powershell
$env:PATH = "C:\Users\natou\AppData\Roaming\npm;" + $env:PATH
pnpm --filter @arcade/server typecheck
```
Expected: exits 0.

- [ ] **Step 3: Commit suggestion**

> Suggest commit: `feat(server): handle REJOIN_ROOM socket event`

---

### Task 4: Store and restore token in PlayerPage

**Files:**
- Modify: `apps/web/src/pages/PlayerPage.tsx`

- [ ] **Step 1: Update PlayerPage.tsx**

Replace `apps/web/src/pages/PlayerPage.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PlayerView from '@arcade/tap-race/client/PlayerView'
import type { PlayerViewState } from '@arcade/tap-race/client/types'
import type { Phase } from '@arcade/tap-race/client/game'
import { socket } from '../socket'

const STORAGE_KEY = (code: string) => `tap-race-token-${code}`

export default function PlayerPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)
  const [phase, setPhase] = useState<Phase>('WAITING')
  const [countdown, setCountdown] = useState(3)
  const [timeLeft, setTimeLeft] = useState(60)
  const [score, setScore] = useState(0)
  const tapBuffer = useRef(0)

  useEffect(() => {
    if (!code) return
    const existingToken = localStorage.getItem(STORAGE_KEY(code))
    if (existingToken) {
      socket.connect()
      socket.once('connect', () => {
        socket.emit('REJOIN_ROOM', { code: code.toUpperCase(), token: existingToken })
      })
      socket.once('ERROR', () => {
        localStorage.removeItem(STORAGE_KEY(code))
      })
      setJoined(true)
    }
  }, [code])

  useEffect(() => {
    if (!joined) return
    socket.on('GAME_STATE', (d: { phase: Phase; countdown?: number; timeLeft?: number }) => {
      setPhase(d.phase)
      if (d.countdown !== undefined) setCountdown(d.countdown)
      if (d.timeLeft !== undefined) setTimeLeft(d.timeLeft)
    })
    socket.on('SCORE_UPDATE', (d: { score: number }) => setScore(d.score))
    socket.on('JOINED', (d: { token: string }) => {
      if (code) localStorage.setItem(STORAGE_KEY(code), d.token)
    })
    const flush = setInterval(() => {
      if (tapBuffer.current > 0) {
        socket.emit('TAP_BATCH', { count: tapBuffer.current })
        tapBuffer.current = 0
      }
    }, 200)
    return () => {
      socket.off('GAME_STATE')
      socket.off('SCORE_UPDATE')
      socket.off('JOINED')
      clearInterval(flush)
    }
  }, [joined, code])

  function join() {
    socket.connect()
    socket.emit('JOIN_ROOM', { code: code?.toUpperCase(), name: name || 'Anonyme' })
    setJoined(true)
  }

  if (!joined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: '1rem', fontFamily: 'monospace', background: '#0f0f0f', color: '#fff' }}>
        <h1 style={{ margin: 0 }}>Tap Race</h1>
        <p style={{ color: '#aaa', margin: 0 }}>Room : <strong style={{ color: '#facc15' }}>{code}</strong></p>
        <input placeholder="Votre nom" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && join()}
          style={{ padding: '0.75rem 1rem', fontSize: '1.1rem', borderRadius: 8, border: 'none', textAlign: 'center' }} />
        <button onClick={join}
          style={{ padding: '0.75rem 2rem', fontSize: '1.1rem', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer' }}>
          Rejoindre
        </button>
      </div>
    )
  }

  const state: PlayerViewState = { phase, countdown, timeLeft, score, playerName: name || 'Anonyme' }
  return (
    <PlayerView
      state={state}
      onTap={() => { tapBuffer.current += 1 }}
      onViewGlobalLeaderboard={() => navigate('/leaderboard')}
    />
  )
}
```

- [ ] **Step 2: Run typecheck**

```powershell
$env:PATH = "C:\Users\natou\AppData\Roaming\npm;" + $env:PATH
pnpm --filter @arcade/web typecheck
```
Expected: exits 0.

- [ ] **Step 3: Manual test**

1. Start server + web dev servers
2. Open `/play/XXXX` in a browser, enter name, join
3. Open DevTools → Application → Local Storage — verify token is saved
4. Close and reopen the tab — verify auto-rejoin happens without name form

- [ ] **Step 4: Commit suggestion**

> Suggest commit: `feat(web): persist and restore player token for reconnection`

---

### Task 5: Inactive room cleanup in RoomManager

**Files:**
- Modify: `games/tap-race/server/roomManager.ts`

- [ ] **Step 1: Write failing test**

Add to `games/tap-race/server/roomManager.test.ts` (create if absent):
```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { RoomManager } from './roomManager'
import type { Server } from 'socket.io'

function makeMockIo(): Server {
  return {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  } as unknown as Server
}

describe('RoomManager — cleanup', () => {
  afterEach(() => vi.restoreAllMocks())

  it('removes room after inactivity timeout', () => {
    vi.useFakeTimers()
    const io = makeMockIo()
    const TIMEOUT_MS = 100
    const manager = new RoomManager(io, undefined, TIMEOUT_MS)
    const code = manager.create()
    expect(manager.get(code)).toBeDefined()

    vi.advanceTimersByTime(TIMEOUT_MS + 1)
    expect(manager.get(code)).toBeUndefined()
    vi.useRealTimers()
  })

  it('keeps active room alive', () => {
    vi.useFakeTimers()
    const io = makeMockIo()
    const TIMEOUT_MS = 500
    const manager = new RoomManager(io, undefined, TIMEOUT_MS)
    const code = manager.create()
    const room = manager.get(code)!
    room.lastActivity = Date.now()

    vi.advanceTimersByTime(TIMEOUT_MS - 100)
    expect(manager.get(code)).toBeDefined()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```powershell
$env:PATH = "C:\Users\natou\AppData\Roaming\npm;" + $env:PATH
pnpm --filter @arcade/tap-race test --run
```
Expected: FAIL — `RoomManager` doesn't accept a timeout parameter.

- [ ] **Step 3: Implement cleanup in roomManager.ts**

Replace `games/tap-race/server/roomManager.ts`:
```ts
import type { Server } from 'socket.io'
import { TapRaceRoom } from './tapRaceRoom'

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export class RoomManager {
  private rooms = new Map<string, TapRaceRoom>()
  private cleanupInterval: ReturnType<typeof setInterval>

  constructor(
    private readonly io: Server,
    private readonly db?: { saveResults: (players: { name: string; score: number }[]) => void },
    private readonly inactivityTimeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {
    this.cleanupInterval = setInterval(() => this.cleanup(), Math.min(inactivityTimeoutMs, 60_000))
  }

  create(): string {
    let code = generateCode()
    while (this.rooms.has(code)) code = generateCode()
    const saveResults = this.db
      ? (players: { name: string; score: number }[]) => this.db!.saveResults(players)
      : () => {}
    this.rooms.set(code, new TapRaceRoom(this.io, code, saveResults))
    return code
  }

  get(code: string): TapRaceRoom | undefined {
    return this.rooms.get(code)
  }

  destroy() {
    clearInterval(this.cleanupInterval)
  }

  private cleanup() {
    const now = Date.now()
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivity > this.inactivityTimeoutMs) {
        this.rooms.delete(code)
      }
    }
  }
}
```

- [ ] **Step 4: Update createApp.ts to pass db to RoomManager**

In `createApp.ts`, change the `RoomManager` instantiation:
```ts
const manager = new RoomManager(io, {
  saveResults: (players) => saveResults(db, players),
})
```

Remove the direct `saveResults` import from `db.ts` in `roomManager.ts` — `roomManager.ts` now receives a db-like interface, keeping the cross-package coupling minimal.

- [ ] **Step 5: Run all tests**

```powershell
$env:PATH = "C:\Users\natou\AppData\Roaming\npm;" + $env:PATH
pnpm --filter @arcade/tap-race test --run
pnpm --filter @arcade/server test --run
```
Expected: all tests PASS.

- [ ] **Step 6: Commit suggestion**

> Suggest commit: `feat(tap-race): auto-cleanup inactive rooms after 30 minutes`
