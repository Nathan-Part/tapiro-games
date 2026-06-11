# Tap Race — Audit sécurité & roadmap

> Document de référence (maj **2026-06-11**). Sert à reprendre le travail dans une autre session :
> il décrit **ce qui a été corrigé et comment**, puis **ce qui reste à faire et pourquoi**.
> Ce n'est pas un plan d'implémentation détaillé — juste assez pour comprendre et décider.

## Contexte rapide

- Stack : Node `node:http` brut + **Socket.IO** · React 19 + Vite · **SQLite** (`better-sqlite3`) · adaptateur Redis optionnel.
- Monorepo pnpm : `apps/server`, `apps/web`, `packages/shared`, `games/tap-race`.
- L'app web est servie sous la base **`/tapi/`** (`vite.config.ts` + `basename` dans `App.tsx`).

### Lancer les vérifs (Windows / PowerShell)
- `pnpm` n'est pas dans le PATH → `corepack pnpm …` (ou `npx pnpm …`).
- Tests : `corepack pnpm -r test` — **68 tests** (39 tap-race + 29 server).
- Types : `corepack pnpm -r typecheck`.
- Audit deps : `corepack pnpm audit`.
- La sortie stderr est enrobée par PowerShell en `NativeCommandError` même à exit 0 → ignorer ce bruit.

### ⚠️ Biome
Le repo **n'est pas conforme** au formateur Biome (style compact en one-liners voulu, ~54 erreurs de lint
pré-existantes : boutons sans `type`, commentaires `///` de design, `!` dans les tests). **Ne pas lancer
`biome check/format --write` à l'échelle du repo** (diff massif sans rapport). Matcher le style existant.

### Constantes / réglages (où ajuster)
| Réglage | Valeur | Emplacement |
|---------|--------|-------------|
| Plafond taps/s par joueur | `MAX_TAPS_PER_SEC = 25` | `games/tap-race/server/tapRaceRoom.ts` |
| Borne dure par message `TAP_BATCH` | `.max(500)` | `games/tap-race/shared/messages.ts` |
| Longueur des codes de room | `ROOM_CODE_LENGTH = 6` | `packages/shared/src/messages.ts` |
| Capacité max par room | `maxPlayers = 10_000` | `tapRaceRoom.ts` (param constructeur) |
| Rate limit HTTP / WS par IP | `200` / `100` par 10 s | `apps/server/src/createApp.ts` (env `HTTP_RATE_MAX` / `WS_RATE_MAX`) |
| Timeout d'inactivité room | 30 min | `roomManager.ts` |

### Changements de contrat réseau à retenir
- **`HOST_ROOM` et `START_GAME` exigent `{ code, token }`** (un `hostToken` par room). Le token vient de
  `POST /api/admin/rooms` (et de `GET /api/admin/rooms`), est stocké par l'AdminPage en `localStorage`
  (`host-token-<code>`) et renvoyé par le HostPage. → **Ouvrir l'écran hôte via la page Admin**, sinon
  « Accès hôte refusé ».
- **L'event socket `CREATE_ROOM` n'existe plus** → création uniquement via `POST /api/admin/rooms` (admin).
- Codes de room = **6 caractères**.

---

## ✅ Failles corrigées — sécurité (passe 1)

- **V1 — Score arbitraire (`TAP_BATCH` non borné).** On pouvait envoyer `{count: 1e9}` et gagner.
  Corrigé : schéma `.max(500)` **+ plafond glissant 25 taps/s par socket** dans `registerSocket` (`tapRaceRoom.ts`).
- **V2 — Pas d'autorisation hôte.** N'importe qui pouvait `START_GAME`/`HOST_ROOM`/`CREATE_ROOM` sur n'importe quelle room.
  Corrigé : `hostToken` par room exigé pour démarrer/héberger ; `CREATE_ROOM` socket supprimé.
- **V3 — Codes devinables + oracle d'énumération.** Codes 4 car. + `GET /api/rooms/:code` sans limite.
  Corrigé : codes **6 car.** (~1 milliard) + rate limit. L'endpoint d'existence subsiste mais est throttlé,
  et l'espionnage via `HOST_ROOM` est désormais bloqué par le token.
- **V4 — DoS (pas de rate limit / cap joueurs / noms non bornés).**
  Corrigé : limiteur par IP (HTTP+WS), `MAX_PLAYERS` dans `join()`, pseudo borné 1–20 par `JoinRoomSchema`.
- **V5 — CORS `*`.** Corrigé : allowlist via `isOriginAllowed(origin, CLIENT_ORIGIN)` + `Vary: Origin`.
- **V6 — Validation Zod partielle.** Seul `TAP_BATCH` était validé.
  Corrigé : **tous** les events passent par le wrapper `onSafe` (schémas dans `packages/shared`).

## ✅ Failles corrigées — crashs / bugs / robustesse (passe 2)

- **#1 — Crash HTTP `decodeURIComponent`.** `curl /api/players/%` tuait le process (URIError non gérée).
  Corrigé : garde → 400 + **try/catch global** autour du routage HTTP (`createApp.ts`).
- **#2 — Crash WS sur payload malformé.** `socket.emit('JOIN_ROOM')` (sans data) crashait (Socket.IO ne catch
  pas les exceptions de listener, elles remontent en `uncaughtException`).
  Corrigé : `onSafe` (Zod + try/catch) + gardes `process.on('uncaughtException'/'unhandledRejection')` (`index.ts`).
- **#3 — Empilement de listeners `TAP_BATCH` (triche ×N).** Chaque re-join ajoutait un handler → taps comptés N fois
  (déclenché aussi par un simple double-clic « Rejoindre »). **N'était pas réglé par la seule borne de V1.**
  Corrigé : `registerSocket` retire les anciens handlers avant d'en remettre un.
- **#4 — QR code → page blanche.** Le QR encodait `/play/:code` sans la base `/tapi/`.
  Corrigé : `import.meta.env.BASE_URL` dans `HostPage.tsx`.
- **#5 — Client Redis sans handler `error`.** Une coupure Redis crashait le process.
  Corrigé : `.on('error', …)` sur pub et sub (`redisAdapter.ts`).
- **#6 — `delete()`/`cleanup()` ne libéraient pas les intervals.** Fuite de timers sur room supprimée en cours de partie.
  Corrigé : `TapRaceRoom.dispose()` appelé par le `RoomManager`.
- **#7 — « Rejouer » effaçait les joueurs.** `start()` en RESULTS remettait `players: {}`.
  Corrigé : joueurs conservés, scores remis à 0.
- **#8 — `initialServerState` partagé (mutable).** Référence `players` partagée entre rooms (bombe à retardement).
  Corrigé : factory `makeInitialState()` (`tapRaceGame.ts`).
- **#9 — 404 à corps vide.** Réponses API blanches. Corrigé : corps JSON `{ error }`.
- **#10 — `getPlayerStats` non borné / `Math.max(...n)`.** Risque de débordement de pile + grosse réponse.
  Corrigé : agrégats en SQL (`COUNT/MAX/AVG`) + historique `LIMIT 100` (`db.ts`).
- **#11 — `maxLength={4}` codé en dur** (Landing). Corrigé : passé à 6.
- **#12 — `LeaderboardPage` `fetch` sans `r.ok`.** Corrigé : gardes ajoutées.

## 🔵 Vérifié non vulnérable (rien à faire)
- **XSS pseudos** — React échappe tout le texte, zéro `dangerouslySetInnerHTML`.
- **Injection SQL/NoSQL** — SQLite avec requêtes paramétrées (`?`), aucune concaténation.

---

## ⬜ À faire — sécurité / robustesse

- **V7 — Dépendances dev vulnérables.** `vitest` (critique GHSA-5xrq), `vite`/`esbuild` (modéré). **Dev-only**
  (hors runtime de prod), exposition réelle quasi nulle.
  *Quoi faire :* `corepack pnpm up -r vitest@latest` (montée 2.x→3.x = breaking, relancer la suite).
- **V8 — Token admin en clair dans `localStorage`.** Pas d'XSS exploitable aujourd'hui → risque faible, mais
  défense en profondeur. *Quoi faire :* token de session à durée limitée plutôt que le mot de passe = token,
  et comparaison `crypto.timingSafeEqual` côté serveur (`isAdminAuthorized` dans `createApp.ts`). Optionnel : `sessionStorage`.
- **V9 — Headers de sécurité incomplets (⚠️ partiel).** `X-Content-Type-Options: nosniff` est posé ; il manque une
  CSP / le reste. *Quoi faire :* CSP sur l'app web (servie par Vite/CDN, pas l'API JSON).
- **V10 — Tokens de session rejoin non purgés (⚠️ partiel).** Les handlers `disconnect` sont nettoyés et `dispose()`
  existe, mais la `Map sessions` (tokens de rejoin) n'est vidée qu'au cleanup de la room (30 min). *Quoi faire :*
  purger le token à la déconnexion avec un délai de grâce pour permettre le rejoin.
- **Rate limiter multi-instances.** Le limiteur actuel est en mémoire (mono-process). *Quoi faire :* le déléguer
  à Redis / au reverse-proxy quand on passera à plusieurs instances Node (étape 2 de scalabilité).
- **Centraliser la longueur de code dans l'UI.** `maxLength={6}` est un literal dans `LandingPage.tsx`.
  *Quoi faire :* importer `ROOM_CODE_LENGTH` depuis `@arcade/shared`.
- **Tests de charge** (k6/Artillery) avant prod publique — déjà prévu (étape 3 de CLAUDE.md).

---

## ✅ Fait — améliorations produit (Block A Gameplay — session 2026-06-11)

### A. Gameplay
- **Golden Tap** ✅ — `FRENZY_START/END` dans le reducer ; room tire le délai aléatoire (12-25 s), frenzy dure 5 s
  puis se reprogramme. Multiplier ×2 dans `TAP_BATCH`. Visuel : ambient doré, banner `⚡ GOLDEN TAP ×2`, timer doré.
- **Décroissance du score** ✅ — dans le `TICK` reducer (PLAYING) : `ticksSinceLastTap++` ; après 3 s sans tap
  le score perd 1 pt/s. Un tap remet le compteur à zéro. Score plancher = 0.
- **Plusieurs manches** ✅ — `rounds?: number` dans `RoomConfig` (1-5). État `currentRound/totalRounds` dans
  `ServerGameState`. Après RESULTS : si `currentRound < totalRounds`, la room attend 5 s puis dispatch `NEXT_ROUND`
  (→ COUNTDOWN direct, scores remis à 0, éliminés réhabilités). Admin UI : sélecteur 1/2/3 manches.
- **Mode Survie / élimination** ✅ — `mode: 'survival'` dans `RoomConfig`. `eliminated: boolean` sur `PlayerRecord`
  + session. Toutes les 10 s : 20 % des joueurs actifs les moins bien classés sont éliminés (min 1). Éliminés :
  taps ignorés, decay ignorée, affichage barré côté hôte, overlay ÉLIMINÉ côté joueur.
- **Tir à la corde** ✅ — `mode: 'tug'`. Fin anticipée si une équipe dépasse 80 % des taps (min 30 taps total)
  via `FORCE_END`. `ropePosition` (0-1) dans le payload leaderboard. Visualisation corde animée côté hôte.
- **Power-ups / sabotage** *(Complexe / Fort)* — non fait. Dépend de l'identité persistante (B).

### Ordre conseillé pour reprendre
1. **V7** (1 commande, ferme le dernier point d'audit ouvert simple).
2. **Game-feel mobile (C)** — `navigator.vibrate`, Wake Lock, sons WebAudio. Court chemin vers « démo qui claque ».
3. Puis **identité persistante (B)** qui débloque tout l'axe rétention.

## ⬜ À faire — améliorations produit

### B. Engagement & rétention
- **Identité persistante (`playerId`)** *(Moyen / Fort — socle)* — UUID durable côté client envoyé au `JOIN_ROOM`,
  persisté en base. **Prérequis n°1** : aujourd'hui les scores sont indexés sur un pseudo libre (spoofable).
- **XP / niveaux / titres** *(Moyen / Fort)* — dépend de l'identité. Nouvelles tables `players` / `matches`.
- **Carte de résultat partageable** *(Facile / Fort)* — image canvas + Web Share API → boucle d'acquisition.
- **Leaderboards périodiques** *(Facile / Moyen-Fort)* — vues jour/semaine/all-time + room vs global (filtre SQL sur `playedAt`).
- **Achievements / badges** *(Moyen)* — calculés au passage en RESULTS.
- **Stats perso enrichies** *(Facile)* — `getPlayerStats` existe déjà ; ajouter meilleur taps/s, taux de victoire, percentile.

### C. Quick wins techniques (< 1 jour)
- **Game-feel mobile** *(Facile / Fort)* — `navigator.vibrate`, **Wake Lock** (l'écran se met en veille en pleine
  partie aujourd'hui), sons WebAudio.
- **Perf WebSocket** *(Facile / Fort à l'échelle)* — `volatile.emit` sur les flux haute fréquence + leaderboard
  en delta + n'émettre que si changé.
- **Score optimiste client** *(Facile)* — incrémenter localement à chaque tap, réconcilier avec `SCORE_UPDATE`.
- **État de reconnexion visible** *(Facile)* — bandeau sur les events `disconnect`/`reconnect`.
- **`prefers-reduced-motion`** *(Facile)* — atténuer `ParticleField`/animations (a11y + perf).


> Les correctifs de sécurité de cette session sont dans l'arbre de travail (non commités au moment de l'écriture).
