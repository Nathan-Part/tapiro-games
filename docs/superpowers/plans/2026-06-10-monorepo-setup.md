# Arcade Platform — Monorepo Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialiser le monorepo pnpm avec trois workspaces (`apps/web`, `apps/server`, `packages/shared`), vérifier qu'ils compilent ensemble et qu'une connexion Socket.IO peut s'établir entre client et serveur.

**Architecture:** Racine pnpm workspaces avec une base tsconfig partagée. `packages/shared` exporte les schémas Zod des messages réseau, consommé par les deux apps. `apps/server` tourne sur Node + Socket.IO via tsx en dev — la logique est dans `createApp.ts` (factory testable) et le point d'entrée est `index.ts` (lance le serveur). `apps/web` tourne sur React 19 + Vite.

**Tech Stack:** pnpm workspaces, TypeScript 5.7, React 19, Vite 6, Socket.IO 4.8, Zod 3.24, Vitest 2.1, Biome 1.9, tsx 4.19

---

## Cartographie des fichiers

```
arcade/
├── .gitignore
├── .npmrc
├── biome.json
├── package.json                          ← root workspace (scripts globaux)
├── pnpm-workspace.yaml
├── tsconfig.base.json                    ← base TS partagée par tous
├── games/
│   └── .gitkeep
├── packages/
│   └── shared/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                  ← re-export
│           └── messages.ts              ← schémas Zod des messages socket
└── apps/
    ├── server/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vitest.config.ts
    │   └── src/
    │       ├── index.ts                  ← entry point (démarre le serveur)
    │       ├── createApp.ts             ← factory testable (httpServer + io)
    │       └── createApp.test.ts        ← test de connexion socket
    └── web/
        ├── package.json
        ├── tsconfig.json
        ├── vite.config.ts
        ├── index.html
        └── src/
            ├── main.tsx
            ├── App.tsx                   ← placeholder (affiche statut connexion)
            └── socket.ts                ← instance socket.io-client
```

---

## Task 1 — Root workspace scaffold

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `biome.json`
- Modify: `.gitignore`
- Create: `games/.gitkeep`

- [ ] **Step 1.1 — Créer pnpm-workspace.yaml**

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'games/*'
```

- [ ] **Step 1.2 — Créer .npmrc**

```ini
# .npmrc
shamefully-hoist=false
strict-peer-dependencies=false
```

- [ ] **Step 1.3 — Créer le package.json racine**

```json
{
  "name": "arcade",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "dev": "pnpm run --parallel dev",
    "build": "pnpm run --recursive build",
    "typecheck": "pnpm run --recursive typecheck",
    "lint": "biome lint .",
    "format": "biome format --write .",
    "check": "biome check --write ."
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 1.4 — Créer tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 1.5 — Créer biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded"
    }
  },
  "files": {
    "ignore": ["**/node_modules/**", "**/dist/**"]
  }
}
```

- [ ] **Step 1.6 — Mettre à jour .gitignore**

Créer ou compléter `.gitignore` :

```
node_modules/
dist/
.env
*.local
```

- [ ] **Step 1.7 — Créer le dossier games avec un placeholder**

```bash
mkdir -p games
```

Créer `games/.gitkeep` (fichier vide).

- [ ] **Step 1.8 — Commit**

```bash
git add pnpm-workspace.yaml .npmrc package.json tsconfig.base.json biome.json .gitignore games/.gitkeep
git commit -m "chore: initialize pnpm monorepo workspace"
```

---

## Task 2 — packages/shared — schémas de messages

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/messages.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 2.1 — Créer packages/shared/package.json**

```json
{
  "name": "@arcade/shared",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2.2 — Créer packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 2.3 — Créer packages/shared/src/messages.ts**

```ts
import { z } from 'zod'

export const MessageTypeSchema = z.enum(['INFRA', 'GAME'])

export const InfraEventSchema = z.enum(['JOIN', 'LEAVE', 'START', 'END'])

export const SocketMessageSchema = z.object({
  type: MessageTypeSchema,
  event: z.string(),
  roomCode: z.string().length(4),
  payload: z.unknown().optional(),
})

export type MessageType = z.infer<typeof MessageTypeSchema>
export type InfraEvent = z.infer<typeof InfraEventSchema>
export type SocketMessage = z.infer<typeof SocketMessageSchema>
```

- [ ] **Step 2.4 — Créer packages/shared/src/index.ts**

```ts
export * from './messages'
```

- [ ] **Step 2.5 — Vérifier la compilation**

```bash
pnpm --filter @arcade/shared typecheck
```

Résultat attendu : aucune erreur, processus sort avec code 0.

- [ ] **Step 2.6 — Commit**

```bash
git add packages/
git commit -m "feat: add shared message schemas with zod"
```

---

## Task 3 — apps/server — configuration

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/vitest.config.ts`

- [ ] **Step 3.1 — Créer apps/server/package.json**

```json
{
  "name": "@arcade/server",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@arcade/shared": "workspace:*",
    "socket.io": "^4.8.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "socket.io-client": "^4.8.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3.2 — Créer apps/server/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@arcade/shared": ["../../packages/shared/src/index.ts"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3.3 — Créer apps/server/vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

---

## Task 4 — apps/web — configuration

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`

- [ ] **Step 4.1 — Créer apps/web/package.json**

```json
{
  "name": "@arcade/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@arcade/shared": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "socket.io-client": "^4.8.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 4.2 — Créer apps/web/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "noEmit": true,
    "paths": {
      "@arcade/shared": ["../../packages/shared/src/index.ts"]
    }
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 4.3 — Créer apps/web/vite.config.ts**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
})
```

- [ ] **Step 4.4 — Créer apps/web/index.html**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Arcade</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## Task 5 — pnpm install

- [ ] **Step 5.1 — Installer toutes les dépendances depuis la racine**

```bash
pnpm install
```

Résultat attendu : résolution et installation de toutes les dépendances des 3 packages + création des symlinks workspaces. Pas d'erreur `WARN` critique.

---

## Task 6 — TDD : connexion Socket.IO

**Files:**
- Create: `apps/server/src/createApp.test.ts`
- Create: `apps/server/src/createApp.ts`
- Create: `apps/server/src/index.ts`

- [ ] **Step 6.1 — Écrire le test qui doit échouer**

Créer `apps/server/src/createApp.test.ts` :

```ts
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
```

- [ ] **Step 6.2 — Lancer le test pour vérifier qu'il échoue**

```bash
pnpm --filter @arcade/server test
```

Résultat attendu : FAIL — `Cannot find module './createApp'`

- [ ] **Step 6.3 — Implémenter createApp.ts**

Créer `apps/server/src/createApp.ts` :

```ts
import { createServer } from 'node:http'
import { Server } from 'socket.io'

export function createApp() {
  const httpServer = createServer()

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    },
  })

  io.on('connection', (socket) => {
    socket.emit('hello', { message: 'Connected to Arcade server' })

    socket.on('disconnect', () => {})
  })

  return { httpServer, io }
}
```

- [ ] **Step 6.4 — Implémenter index.ts**

Créer `apps/server/src/index.ts` :

```ts
import { createApp } from './createApp'

const { httpServer } = createApp()
const PORT = Number(process.env.PORT ?? 3001)

httpServer.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`)
})
```

- [ ] **Step 6.5 — Relancer le test pour vérifier qu'il passe**

```bash
pnpm --filter @arcade/server test
```

Résultat attendu :

```
✓ apps/server/src/createApp.test.ts (1)
  ✓ createApp (1)
    ✓ émet hello à la connexion

Test Files  1 passed (1)
Tests  1 passed (1)
```

- [ ] **Step 6.6 — Vérifier la compilation TypeScript du serveur**

```bash
pnpm --filter @arcade/server typecheck
```

Résultat attendu : aucune erreur.

- [ ] **Step 6.7 — Commit**

```bash
git add apps/server/
git commit -m "feat: add server with Socket.IO createApp factory (TDD)"
```

---

## Task 7 — apps/web — sources React

**Files:**
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/socket.ts`
- Create: `apps/web/src/App.tsx`

- [ ] **Step 7.1 — Créer apps/web/src/socket.ts**

```ts
import { io } from 'socket.io-client'

export const socket = io('http://localhost:3001', {
  autoConnect: false,
})
```

- [ ] **Step 7.2 — Créer apps/web/src/main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 7.3 — Créer apps/web/src/App.tsx**

```tsx
import { useEffect, useState } from 'react'
import { socket } from './socket'

type Status = 'disconnected' | 'connecting' | 'connected'

export default function App() {
  const [status, setStatus] = useState<Status>('disconnected')

  useEffect(() => {
    setStatus('connecting')
    socket.connect()

    socket.on('connect', () => setStatus('connected'))
    socket.on('disconnect', () => setStatus('disconnected'))

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.disconnect()
    }
  }, [])

  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem' }}>
      <h1>Arcade</h1>
      <p>
        Serveur :{' '}
        <strong style={{ color: status === 'connected' ? 'green' : 'red' }}>{status}</strong>
      </p>
    </div>
  )
}
```

- [ ] **Step 7.4 — Vérifier la compilation TypeScript du client**

```bash
pnpm --filter @arcade/web typecheck
```

Résultat attendu : aucune erreur.

- [ ] **Step 7.5 — Commit**

```bash
git add apps/web/
git commit -m "feat: add React web app with socket connection placeholder"
```

---

## Task 8 — Smoke test d'intégration

- [ ] **Step 8.1 — Démarrer le serveur dans un terminal**

```bash
pnpm --filter @arcade/server dev
```

Résultat attendu :

```
[server] listening on port 3001
```

- [ ] **Step 8.2 — Démarrer le client dans un second terminal**

```bash
pnpm --filter @arcade/web dev
```

Résultat attendu :

```
  VITE v6.x  ready in Xms
  ➜  Local:   http://localhost:5173/
```

- [ ] **Step 8.3 — Vérifier dans le navigateur**

Ouvrir `http://localhost:5173`.

Résultat attendu : la page affiche **"Serveur : connected"** en vert.

Dans le terminal du serveur, la ligne suivante doit apparaître :

```
[server] client connected: <socket-id>
```

- [ ] **Step 8.4 — Vérifier le typecheck global**

```bash
pnpm typecheck
```

Résultat attendu : tous les packages passent sans erreur.

- [ ] **Step 8.5 — Commit final**

```bash
git add .
git commit -m "chore: verify full integration — server + web + shared compile and connect"
```

---

## Résumé de ce que ce plan produit

À la fin de ces 8 tâches :
- Le monorepo pnpm est initialisé avec 3 workspaces fonctionnels
- `packages/shared` exporte les schémas Zod des messages — prêt à être étendu par les jeux
- `apps/server` démarre un serveur Socket.IO, testé unitairement
- `apps/web` démarre un client React qui se connecte au serveur
- Le navigateur affiche la confirmation de connexion
- Tous les types compilent sans erreur

Ce setup est la fondation sur laquelle tout le reste (rooms, jeux, tap-race) sera construit.
