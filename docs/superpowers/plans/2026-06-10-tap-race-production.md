# Tap Race — Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Admin page protected by a bearer token: lists active rooms and lets you create one without the web UI. (2) Full environment variable configuration + Docker images so the app can be deployed anywhere. (3) Step-by-step guide to deploy on a VPS with HTTPS via Let's Encrypt.

**Architecture:** Admin API routes are added to the existing HTTP handler in `createApp.ts` behind a middleware check (`Authorization: Bearer <ADMIN_TOKEN>`). The admin React page lives at `/admin` and is hidden from the public nav. Docker: a `Dockerfile` per app (`apps/server`, `apps/web`) plus a `docker-compose.yml` at the root for local orchestration.

**Tech Stack:** Node.js built-in HTTP, React Router, Docker, nginx + certbot (for HTTPS, instructions only — no code to deploy).

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/server/src/createApp.ts` | Modify | Admin API middleware + routes |
| `apps/server/src/createApp.test.ts` | Modify | Tests for admin routes |
| `apps/web/src/pages/AdminPage.tsx` | Create | Admin UI: list rooms, create room |
| `apps/web/src/App.tsx` | Modify | Add `/admin` route |
| `apps/server/.env.example` | Create | Document all env vars |
| `apps/web/.env.example` | Create | Document all env vars |
| `apps/server/Dockerfile` | Create | Production Docker image for server |
| `apps/web/Dockerfile` | Create | Production Docker image for web (nginx) |
| `docker-compose.yml` | Create | Local orchestration (server + web + Redis) |
| `docs/deploy-vps.md` | Create | Step-by-step VPS + HTTPS deployment guide |

---

### Task 1: Admin API routes in createApp

**Files:**
- Modify: `apps/server/src/createApp.ts`
- Modify: `apps/server/src/createApp.test.ts`

The admin routes:
- `GET /api/admin/rooms` — returns list of active room codes
- `POST /api/admin/rooms` — creates a new room, returns `{ code }`

Protected by `Authorization: Bearer <ADMIN_TOKEN>` header. If `ADMIN_TOKEN` is not set in env, the routes return 503.

- [ ] **Step 1: Write failing tests**

Add to `apps/server/src/createApp.test.ts`:
```ts
describe('Admin API', () => {
  let server: ReturnType<typeof createApp>['httpServer']
  let baseUrl: string
  const TOKEN = 'test-admin-token'

  beforeAll(async () => {
    process.env.ADMIN_TOKEN = TOKEN
    const app = createApp(':memory:')
    server = app.httpServer
    await new Promise<void>((resolve) => server.listen(0, resolve))
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`
  })

  afterAll(() => { server.close(); delete process.env.ADMIN_TOKEN })

  it('GET /api/admin/rooms returns 401 without token', async () => {
    const res = await fetch(`${baseUrl}/api/admin/rooms`)
    expect(res.status).toBe(401)
  })

  it('GET /api/admin/rooms returns 200 with valid token', async () => {
    const res = await fetch(`${baseUrl}/api/admin/rooms`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.rooms)).toBe(true)
  })

  it('POST /api/admin/rooms creates a room', async () => {
    const res = await fetch(`${baseUrl}/api/admin/rooms`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(typeof body.code).toBe('string')
    expect(body.code.length).toBe(4)
  })

  it('POST /api/admin/rooms returns 401 without token', async () => {
    const res = await fetch(`${baseUrl}/api/admin/rooms`, { method: 'POST' })
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```powershell
$env:PATH = "C:\Users\natou\AppData\Roaming\npm;" + $env:PATH
pnpm --filter @arcade/server test --run
```
Expected: FAIL — 401/201 responses not yet implemented.

- [ ] **Step 3: Add admin routes to createApp.ts**

Update the HTTP handler in `createApp.ts` to handle admin routes. The `manager` needs to expose a `list()` method (see Step 4). Here is the updated HTTP handler section:

```ts
function isAdminAuthorized(req: IncomingMessage): boolean {
  const token = process.env.ADMIN_TOKEN
  if (!token) return false
  const auth = req.headers['authorization']
  return auth === `Bearer ${token}`
}

// Inside createServer callback, replace the existing handler:
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'GET' && req.url === '/api/leaderboard') {
    const scores = getTopScores(db)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(scores))
    return
  }

  if (req.url?.startsWith('/api/admin/')) {
    if (!isAdminAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }

    if (req.method === 'GET' && req.url === '/api/admin/rooms') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ rooms: manager.list() }))
      return
    }

    if (req.method === 'POST' && req.url === '/api/admin/rooms') {
      const code = manager.create()
      res.writeHead(201, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ code }))
      return
    }

    res.writeHead(404)
    res.end()
    return
  }

  res.writeHead(404)
  res.end()
})
```

Note: `manager` must be declared before `httpServer` — restructure `createApp.ts` so `manager` is created before the HTTP server callback, or use late initialization with `let manager: RoomManager`.

The simplest restructure: declare `let manager: RoomManager` before `createServer`, initialize it after with the `io` instance. Since `manager` is only accessed on HTTP requests (which come after the server starts), this works fine.

- [ ] **Step 4: Add `list()` to RoomManager**

In `games/tap-race/server/roomManager.ts`, add:
```ts
list(): string[] {
  return [...this.rooms.keys()]
}
```

- [ ] **Step 5: Run tests — verify they pass**

```powershell
$env:PATH = "C:\Users\natou\AppData\Roaming\npm;" + $env:PATH
pnpm --filter @arcade/server test --run
```
Expected: all tests PASS.

- [ ] **Step 6: Commit suggestion**

> Suggest commit: `feat(server): add admin API routes protected by ADMIN_TOKEN`

---

### Task 2: Admin React page

**Files:**
- Create: `apps/web/src/pages/AdminPage.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Create AdminPage.tsx**

Create `apps/web/src/pages/AdminPage.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = 'http://localhost:4000'

export default function AdminPage() {
  const navigate = useNavigate()
  const [token, setToken] = useState(() => localStorage.getItem('admin-token') ?? '')
  const [rooms, setRooms] = useState<string[]>([])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  function headers() {
    return { Authorization: `Bearer ${token}` }
  }

  async function loadRooms() {
    setError('')
    try {
      const res = await fetch(`${API}/api/admin/rooms`, { headers: headers() })
      if (res.status === 401) { setError('Token invalide'); return }
      const data: { rooms: string[] } = await res.json()
      setRooms(data.rooms)
      localStorage.setItem('admin-token', token)
    } catch {
      setError('Impossible de contacter le serveur')
    }
  }

  async function createRoom() {
    setCreating(true)
    try {
      const res = await fetch(`${API}/api/admin/rooms`, {
        method: 'POST',
        headers: headers(),
      })
      if (res.status === 401) { setError('Token invalide'); return }
      const data: { code: string } = await res.json()
      setRooms(prev => [...prev, data.code])
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    if (token) loadRooms()
  }, [])

  return (
    <div style={s.screen}>
      <h1 style={s.title}>Admin — Tap Race</h1>

      <div style={s.form}>
        <input
          type="password"
          placeholder="Admin token"
          value={token}
          onChange={e => setToken(e.target.value)}
          style={s.input}
        />
        <button style={s.btn} onClick={loadRooms}>Actualiser</button>
      </div>

      {error && <p style={s.error}>{error}</p>}

      <div style={s.section}>
        <div style={s.sectionHeader}>
          <h2 style={s.subtitle}>Rooms actives ({rooms.length})</h2>
          <button style={s.createBtn} onClick={createRoom} disabled={creating}>
            {creating ? '…' : '+ Créer une room'}
          </button>
        </div>
        {rooms.length === 0
          ? <p style={s.empty}>Aucune room active</p>
          : (
            <ul style={s.list}>
              {rooms.map(code => (
                <li key={code} style={s.roomRow}>
                  <span style={s.code}>{code}</span>
                  <button style={s.linkBtn} onClick={() => navigate(`/host/${code}`)}>
                    Ouvrir hôte
                  </button>
                </li>
              ))}
            </ul>
          )
        }
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  screen: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    minHeight: '100dvh', fontFamily: 'monospace', background: '#0f0f0f',
    color: '#fff', padding: '2rem', gap: '1.5rem', boxSizing: 'border-box',
  },
  title: { fontSize: '2rem', margin: 0 },
  form: { display: 'flex', gap: '0.75rem', width: '100%', maxWidth: '500px' },
  input: {
    flex: 1, padding: '0.75rem 1rem', fontSize: '1rem', borderRadius: 8,
    border: '1px solid #333', background: '#1a1a1a', color: '#fff',
  },
  btn: {
    padding: '0.75rem 1.5rem', borderRadius: 8, border: 'none',
    background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '1rem',
  },
  error: { color: '#f87171', margin: 0 },
  section: { width: '100%', maxWidth: '500px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  subtitle: { fontSize: '1.2rem', margin: 0 },
  createBtn: {
    padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
    background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: '0.9rem',
  },
  empty: { color: '#555' },
  list: { listStyle: 'none', padding: 0, margin: '0.75rem 0 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  roomRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.75rem 1rem', background: '#1a1a1a', borderRadius: 8,
  },
  code: { fontSize: '1.5rem', fontWeight: 'bold', color: '#facc15', letterSpacing: '0.1em' },
  linkBtn: {
    padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid #333',
    background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: '0.85rem',
  },
}
```

- [ ] **Step 2: Add /admin route to App.tsx**

```tsx
import AdminPage from './pages/AdminPage'
// Add inside <Routes>:
<Route path="/admin" element={<AdminPage />} />
```

- [ ] **Step 3: Typecheck**

```powershell
$env:PATH = "C:\Users\natou\AppData\Roaming\npm;" + $env:PATH
pnpm --filter @arcade/web typecheck
```
Expected: exits 0.

- [ ] **Step 4: Manual test**

1. Start server with `ADMIN_TOKEN=mytoken`
2. Navigate to `http://localhost:5173/admin`
3. Enter token → rooms list loads
4. Click "+ Créer une room" → new room code appears
5. Click "Ouvrir hôte" → redirects to `/host/XXXX`

- [ ] **Step 5: Commit suggestion**

> Suggest commit: `feat(web): add /admin page for room management`

---

### Task 3: Environment variable documentation and .env.example files

**Files:**
- Create: `apps/server/.env.example`
- Create: `apps/web/.env.example`

- [ ] **Step 1: Create server .env.example**

Create `apps/server/.env.example`:
```dotenv
# Port the server listens on (default: 4000)
PORT=4000

# Allowed CORS origin (default: any localhost port — for production set to your domain)
# CLIENT_ORIGIN=https://yourdomain.com

# Path to SQLite database file (default: ./arcade.db)
# DB_PATH=./arcade.db

# Redis URL for multi-instance pub/sub (optional — single instance if not set)
# REDIS_URL=redis://localhost:6379

# Admin API token — required to use /api/admin/* routes
# ADMIN_TOKEN=change-me-in-production
```

- [ ] **Step 2: Create web .env.example**

Create `apps/web/.env.example`:
```dotenv
# URL of the backend server (default in dev: http://localhost:4000)
VITE_SERVER_URL=http://localhost:4000
```

Then update `apps/web/src/socket.ts` to use this env var:
```ts
import { io } from 'socket.io-client'
export const socket = io(import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000', { autoConnect: false })
```

And update `apps/web/src/pages/AdminPage.tsx` to use it:
```ts
const API = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000'
```

And update `apps/web/src/pages/LeaderboardPage.tsx` to use it:
```ts
fetch(`${import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000'}/api/leaderboard`)
```

- [ ] **Step 3: Update server index to use PORT env var**

In `apps/server/src/index.ts` (or wherever `httpServer.listen()` is called):
```ts
const PORT = Number(process.env.PORT ?? 4000)
httpServer.listen(PORT, () => console.log(`Server listening on :${PORT}`))
```

- [ ] **Step 4: Commit suggestion**

> Suggest commit: `chore: add .env.example files and use VITE_SERVER_URL + PORT env vars`

---

### Task 4: Dockerfiles and docker-compose

**Files:**
- Create: `apps/server/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create server Dockerfile**

Create `apps/server/Dockerfile`:
```dockerfile
FROM node:22-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY games/tap-race/package.json ./games/tap-race/
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY . .
RUN pnpm --filter @arcade/server build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

Note: This requires a `build` script in `apps/server/package.json` that compiles TypeScript. Add it:
```json
"build": "tsc --project tsconfig.json --outDir dist"
```
And ensure `tsconfig.json` has `"noEmit": false` (or remove `noEmit`) for the build target.

- [ ] **Step 2: Create web Dockerfile**

Create `apps/web/Dockerfile`:
```dockerfile
FROM node:22-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY games/tap-race/package.json ./games/tap-race/
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
ARG VITE_SERVER_URL=http://localhost:4000
ENV VITE_SERVER_URL=$VITE_SERVER_URL
RUN pnpm --filter @arcade/web build

FROM nginx:alpine AS runner
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Create `apps/web/nginx.conf`:
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 3: Create docker-compose.yml**

Create `docker-compose.yml` at the monorepo root:
```yaml
version: '3.9'

services:
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'

  server:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
    ports:
      - '4000:4000'
    environment:
      PORT: '4000'
      REDIS_URL: redis://redis:6379
      DB_PATH: /data/arcade.db
      ADMIN_TOKEN: ${ADMIN_TOKEN:-change-me}
      CLIENT_ORIGIN: ${CLIENT_ORIGIN:-http://localhost:5173}
    volumes:
      - arcade_data:/data
    depends_on:
      - redis

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        VITE_SERVER_URL: ${VITE_SERVER_URL:-http://localhost:4000}
    ports:
      - '80:80'
    depends_on:
      - server

volumes:
  arcade_data:
```

- [ ] **Step 4: Verify Docker builds**

```powershell
docker compose build
```
Expected: both images build without errors.

```powershell
docker compose up -d
```
Open `http://localhost` — the app should be running.

- [ ] **Step 5: Commit suggestion**

> Suggest commit: `feat: add Dockerfiles and docker-compose for production deployment`

---

### Task 5: VPS + HTTPS deployment guide

**Files:**
- Create: `docs/deploy-vps.md`

- [ ] **Step 1: Create the guide**

Create `docs/deploy-vps.md`:
```markdown
# Deploying Arcade to a VPS with HTTPS

## Prerequisites

- A VPS running Ubuntu 22.04+ (Hetzner, OVH, DigitalOcean, etc.)
- A domain name pointed at your VPS IP (A record: `yourdomain.com` → VPS IP)
- Docker and Docker Compose installed on the VPS

## 1. Install Docker on VPS

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

## 2. Clone the repository

```bash
git clone <your-repo-url> /opt/arcade
cd /opt/arcade
```

## 3. Configure environment

```bash
cp apps/server/.env.example apps/server/.env
# Edit with your values:
nano apps/server/.env
```

Required values for production:
- `ADMIN_TOKEN` — a long random string: `openssl rand -hex 32`
- `CLIENT_ORIGIN` — your domain: `https://yourdomain.com`
- `REDIS_URL` — `redis://redis:6379` (as in docker-compose)

## 4. Configure the web build URL

```bash
export VITE_SERVER_URL=https://yourdomain.com
```

Or create an `.env` file at the repo root:
```
VITE_SERVER_URL=https://yourdomain.com
```

## 5. Start the stack

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 6. Install nginx and certbot (on the VPS host, outside Docker)

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

## 7. Configure nginx as reverse proxy

Create `/etc/nginx/sites-available/arcade`:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/arcade /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 8. Get SSL certificate

```bash
sudo certbot --nginx -d yourdomain.com
```

Certbot will automatically modify the nginx config to add HTTPS and redirect HTTP → HTTPS.

## 9. Socket.IO with HTTPS

Socket.IO works over HTTPS/WSS automatically when the client connects to `https://yourdomain.com`. The `CLIENT_ORIGIN` on the server must match exactly: `https://yourdomain.com`.

## 10. Auto-renewal

Certbot installs a systemd timer that renews certificates automatically. Verify:

```bash
sudo systemctl status certbot.timer
```

## 11. Update deployment

```bash
cd /opt/arcade
git pull
docker compose build
docker compose up -d
```

## Port summary

| Port | Service | Exposed to |
|------|---------|------------|
| 4000 | Node.js server | nginx proxy only (not public) |
| 80 | nginx / web app | public (redirected to 443) |
| 443 | nginx HTTPS | public |
| 6379 | Redis | internal Docker network only |
```

- [ ] **Step 2: Commit suggestion**

> Suggest commit: `docs: add VPS + HTTPS deployment guide`
