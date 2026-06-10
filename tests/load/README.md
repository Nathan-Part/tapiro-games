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
   $env:PORT = "4000"; $env:REDIS_URL = "redis://localhost:6379"; pnpm --filter @arcade/server dev
   $env:PORT = "4001"; $env:REDIS_URL = "redis://localhost:6379"; pnpm --filter @arcade/server dev
   ```
3. Run k6 against a load balancer (nginx or HAProxy in front of both ports)
