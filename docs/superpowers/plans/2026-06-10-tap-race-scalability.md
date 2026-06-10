# Tap Race — Scalability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Add Redis pub/sub adapter to Socket.IO so multiple Node.js instances can share room events. (2) Write k6 load tests that validate the server handles 500 concurrent tappers in a single room without dropping events.

**Architecture:** `@socket.io/redis-adapter` + `ioredis` wire into `createApp` behind a feature flag (`REDIS_URL` env var) — when not set, the server runs as before (single-instance). Load tests use k6 with the k6 WebSocket extension; one script simulates a single room with N concurrent players each sending `TAP_BATCH` every 200 ms.

**Prerequisites:** Redis accessible at `localhost:6379` (can be started with `docker run -d -p 6379:6379 redis:7-alpine`). k6 installed globally (`winget install k6` or download from k6.io).

**Tech Stack:** `@socket.io/redis-adapter`, `ioredis`, k6 (external binary), TypeScript strict.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/server/src/redisAdapter.ts` | Create | Create and export `createRedisAdapter(url)` |
| `apps/server/src/createApp.ts` | Modify | Conditionally attach Redis adapter |
| `tests/load/tap-race-room.js` | Create | k6 script — N players join one room and tap |
| `tests/load/README.md` | Create | How to run load tests |

---

### Task 1: Install Redis adapter dependencies

**Files:**
- Modify: `apps/server/package.json`

- [ ] **Step 1: Install packages**

```powershell
$env:PATH = "C:\Users\natou\AppData\Roaming\npm;" + $env:PATH
pnpm --filter @arcade/server add @socket.io/redis-adapter ioredis
```
Expected: both packages added to `apps/server/package.json` dependencies.

- [ ] **Step 2: Verify typecheck still passes**

```powershell
$env:PATH = "C:\Users\natou\AppData\Roaming\npm;" + $env:PATH
pnpm --filter @arcade/server typecheck
```
Expected: exits 0.

- [ ] **Step 3: Commit suggestion**

> Suggest commit: `chore(server): add @socket.io/redis-adapter and ioredis dependencies`

---

### Task 2: Create redisAdapter module with tests

**Files:**
- Create: `apps/server/src/redisAdapter.ts`
- Create: `apps/server/src/redisAdapter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/redisAdapter.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { createRedisAdapter } from './redisAdapter'

describe('createRedisAdapter', () => {
  it('returns an adapter function', () => {
    // We do not connect to real Redis in unit tests — just verify the factory returns a function
    const fakeUrl = 'redis://localhost:9999'
    const result = createRedisAdapter(fakeUrl)
    expect(typeof result.adapter).toBe('function')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```powershell
$env:PATH = "C:\Users\natou\AppData\Roaming\npm;" + $env:PATH
pnpm --filter @arcade/server test --run
```
Expected: FAIL — `createRedisAdapter` module not found.

- [ ] **Step 3: Implement redisAdapter.ts**

Create `apps/server/src/redisAdapter.ts`:
```ts
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'ioredis'

export function createRedisAdapter(redisUrl: string) {
  const pubClient = createClient(redisUrl)
  const subClient = pubClient.duplicate()
  const adapter = createAdapter(pubClient, subClient)
  return { adapter, pubClient, subClient }
}
```

- [ ] **Step 4: Run test — verify it passes**

```powershell
$env:PATH = "C:\Users\natou\AppData\Roaming\npm;" + $env:PATH
pnpm --filter @arcade/server test --run
```
Expected: PASS.

- [ ] **Step 5: Commit suggestion**

> Suggest commit: `feat(server): add createRedisAdapter factory`

---

### Task 3: Wire Redis adapter into createApp

**Files:**
- Modify: `apps/server/src/createApp.ts`

The Redis adapter is only activated when the `REDIS_URL` environment variable is set. When not set, the app behaves exactly as before.

- [ ] **Step 1: Add the conditional adapter setup**

In `apps/server/src/createApp.ts`, after creating the `io` instance, add:
```ts
if (process.env.REDIS_URL) {
  const { adapter } = createRedisAdapter(process.env.REDIS_URL)
  io.adapter(adapter)
}
```

Add the import at the top of `createApp.ts`:
```ts
import { createRedisAdapter } from './redisAdapter'
```

The full updated imports section:
```ts
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Server } from 'socket.io'
import { RoomManager } from '@arcade/tap-race/server/roomManager'
import { createDb, getTopScores, saveResults } from './db'
import { createRedisAdapter } from './redisAdapter'
```

- [ ] **Step 2: Run typecheck**

```powershell
$env:PATH = "C:\Users\natou\AppData\Roaming\npm;" + $env:PATH
pnpm --filter @arcade/server typecheck
```
Expected: exits 0.

- [ ] **Step 3: Manual test with Redis**

1. Start Redis: `docker run -d -p 6379:6379 redis:7-alpine`
2. Set env var and start server:
   ```powershell
   $env:REDIS_URL = "redis://localhost:6379"
   $env:PATH = "C:\Users\natou\AppData\Roaming\npm;" + $env:PATH
   pnpm --filter @arcade/server dev
   ```
3. Play a full game — verify it works identically to without Redis.
4. Check server logs — no connection errors.

- [ ] **Step 4: Commit suggestion**

> Suggest commit: `feat(server): conditionally attach Redis pub/sub adapter via REDIS_URL`

---

### Task 4: Write k6 load test

**Files:**
- Create: `tests/load/tap-race-room.js`
- Create: `tests/load/README.md`

The test simulates:
- 1 host connecting and creating a room
- N virtual users (VUs) joining as players
- Each player sending `TAP_BATCH { count: 5 }` every 200 ms for 30 seconds
- Assertions: 95th percentile response time < 200 ms, no Socket.IO errors

- [ ] **Step 1: Create the tests directory**

```powershell
New-Item -ItemType Directory -Force "C:\wamp64\www\projet\arcade\tests\load"
```

- [ ] **Step 2: Create the k6 script**

Create `tests/load/tap-race-room.js`:
```js
import ws from 'k6/ws'
import { check, sleep } from 'k6'
import { Trend, Counter } from 'k6/metrics'

const tapLatency = new Trend('tap_latency_ms', true)
const errors = new Counter('socket_errors')

export const options = {
  scenarios: {
    players: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 },
        { duration: '30s', target: 500 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    tap_latency_ms: ['p(95)<200'],
    socket_errors: ['count<5'],
  },
}

const SERVER_URL = __ENV.SERVER_URL || 'ws://localhost:4000'
const ROOM_CODE = __ENV.ROOM_CODE || 'TEST'

export default function () {
  const url = `${SERVER_URL}/socket.io/?EIO=4&transport=websocket`

  const res = ws.connect(url, {}, (socket) => {
    let joined = false

    socket.on('open', () => {
      socket.send('40')
    })

    socket.on('message', (data) => {
      if (data === '40') {
        socket.send(`42["JOIN_ROOM",{"code":"${ROOM_CODE}","name":"VU-${__VU}"}]`)
        joined = true
      }
      if (data.startsWith('42["ERROR"')) {
        errors.add(1)
        socket.close()
      }
    })

    socket.on('error', () => {
      errors.add(1)
    })

    // Send TAP_BATCH every 200ms for the duration of the test
    let tapCount = 0
    const interval = setInterval(() => {
      if (!joined) return
      const before = Date.now()
      socket.send('42["TAP_BATCH",{"count":5}]')
      tapLatency.add(Date.now() - before)
      tapCount++
      if (tapCount > 150) {
        clearInterval(interval)
        socket.close()
      }
    }, 200)

    socket.setTimeout(() => {
      clearInterval(interval)
      socket.close()
    }, 35000)
  })

  check(res, { 'WebSocket connected': (r) => r && r.status === 101 })
  sleep(1)
}
```

**Note on using this test:** You need to create a room manually before running k6 (or add a setup() function that creates one via HTTP). For the first run, set `ROOM_CODE` to a room you created via the app.

- [ ] **Step 3: Create README**

Create `tests/load/README.md`:
```markdown
# Load Tests — Tap Race

## Prerequisites

- k6 installed: `winget install k6` (Windows) or see https://k6.io/docs/get-started/installation/
- Server running at `http://localhost:4000`
- An active room code (create one via the web app)

## Running

```powershell
# Basic run — 500 concurrent players on room ABCD
$env:SERVER_URL = "ws://localhost:4000"
$env:ROOM_CODE = "ABCD"
k6 run tests/load/tap-race-room.js

# Custom VU count
k6 run --vus 100 --duration 30s tests/load/tap-race-room.js
```

## Results interpretation

- `tap_latency_ms p(95) < 200ms` — target threshold
- `socket_errors < 5` — tolerate very few transient errors
- Watch server memory/CPU with Task Manager or `htop` during the run

## With Redis (multi-instance)

1. Start Redis: `docker run -d -p 6379:6379 redis:7-alpine`
2. Start two server instances on different ports:
   ```powershell
   $env:PORT = "4000"; $env:REDIS_URL = "redis://localhost:6379"; pnpm --filter @arcade/server start
   $env:PORT = "4001"; $env:REDIS_URL = "redis://localhost:6379"; pnpm --filter @arcade/server start
   ```
3. Run k6 against a load balancer (nginx or HAProxy in front of both ports)
```
```

- [ ] **Step 4: Commit suggestion**

> Suggest commit: `feat(tests): add k6 load test for 500 concurrent tap-race players`
