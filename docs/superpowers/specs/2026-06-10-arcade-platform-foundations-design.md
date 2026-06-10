# Arcade Platform — Design Spec
**Date :** 2026-06-10  
**Statut :** validé en session  

---

## 1. Vision produit

Plateforme de mini-jeux multi-joueurs en temps réel, à la Kahoot. Chaque jeu oppose des candidats connectés depuis leur téléphone, pendant qu'un écran partagé (grand écran, vidéoprojecteur) affiche le classement en direct.

**Surfaces :**
- **Écran joueur** (`/play/:roomCode`) — interface de jeu sur téléphone, rejoint via QR code
- **Écran hôte** (`/host/:roomCode`) — grand écran partagé, classement live, spectacle
- **Page admin** (`/`) — catalogue des jeux disponibles, création de sessions. Accès interne uniquement, les utilisateurs finaux n'y accèdent jamais directement.

Chaque jeu est un module autonome. Ajouter ou supprimer un jeu ne touche à aucun autre fichier que celui du jeu lui-même.

---

## 2. Stack technique

| Couche | Choix | Justification |
|--------|-------|---------------|
| Frontend | React 19 + Vite + TypeScript | Richesse écosystème animation/UI, outillage mature |
| Temps réel | Socket.IO | Rooms natives, reconnexion automatique (critique sur mobile), adaptateur Redis disponible pour la scalabilité |
| Backend | Node.js + TypeScript | Partage de types client ↔ serveur via monorepo ; état autoritaire en mémoire |
| Base de données | Aucune (phase 1) | L'état de partie est éphémère. SQLite + Drizzle quand le besoin de persistance est prouvé |
| Monorepo | pnpm workspaces | Isolation structurelle des jeux, partage de types sans publish |

---

## 3. Architecture

### 3.1 Structure du repo

```
arcade/
├── apps/
│   ├── web/               # Client React — PlayerView + HostView + Admin
│   └── server/            # Serveur Node + Socket.IO
├── packages/
│   └── shared/            # Types communs, schémas zod des messages réseau
└── games/
    ├── tap-race/
    │   ├── shared/        # Types des messages propres à ce jeu
    │   ├── server/        # Logique de jeu (machine à états pure)
    │   └── client/        # PlayerView.tsx + HostView.tsx
    └── <futur-jeu>/
```

### 3.2 Contrat de jeu (GameDefinition)

Chaque jeu exporte une `GameDefinition` qui implémente ce contrat :

**Côté serveur — machine à états pure :**
```
(état, événement) → { nouvelÉtat, messages[] }
```
- Aucun effet de bord, aucun timer interne, aucune référence circulaire
- L'état doit être strictement sérialisable (prérequis Redis)
- Les timers vivent dans la couche infrastructure, pas dans le jeu

**Côté client — deux composants React :**
- `PlayerView` : reçoit l'état diffusé, émet des actions
- `HostView` : reçoit l'état diffusé (version enrichie), affiche le spectacle

**Métadonnées :**
```ts
{
  id: string            // identifiant unique, ex. "tap-race"
  name: string
  description: string
  minPlayers: number
  maxPlayers: number
}
```

### 3.3 Découverte dynamique des jeux

- Côté client : `import.meta.glob` Vite scanne `games/*/client/index.ts`
- Côté serveur : équivalent statique généré au build ou scan au démarrage
- **Ajouter un jeu = créer son dossier.** Aucun fichier existant modifié.

### 3.4 Rooms et rôles

- Identifiant de room : code court 4 lettres (collision improbable, lisible à voix haute)
- L'écran hôte crée la room et affiche le code + QR code pointant vers `/play/:code`
- Rôles déclarés à la connexion socket : `player` ou `host`
- Le serveur peut adresser des messages différenciés par rôle (ex. la réponse correcte n'est envoyée qu'au host)
- Reconnexion : token de session en `localStorage`, le serveur réattache le joueur à sa room sans perte de score

### 3.5 Protocole de messages

Enveloppe générique typée et validée par zod :
```ts
{
  type: "INFRA" | "GAME"
  event: string          // ex. "JOIN", "START", "TAP_BATCH"
  roomCode: string
  payload: unknown       // schéma défini par le jeu dans games/<id>/shared/
}
```
Messages d'infrastructure (JOIN, LEAVE, START, END) : communs à tous les jeux.  
Messages de jeu : payload libre, schéma zod du jeu validé à l'entrée serveur.

---

## 4. Scalabilité

### Principe : décisions de protocole maintenant, infrastructure plus tard

**Décisions actées dès maintenant** (gratuites à faire, coûteuses à retrofitter) :

1. **Batching côté client** — le joueur n'envoie pas chaque tap individuellement. Il accumule sur 200 ms et envoie `{ count: 12 }`. Cible : tap-race à 10 000 joueurs à 5 taps/s = 50 000 events/s sans batching → 500/s avec. Non négociable.

2. **Diffusion throttlée serveur → clients** — le serveur ne rebroadcast pas à chaque event reçu. Il recalcule et diffuse l'état à cadence fixe : 5×/s vers les joueurs, 10×/s vers l'hôte. Configurable par jeu.

3. **État sérialisable** — les machines à états ne contiennent aucune référence non-sérialisable. Prérequis pour le passage à Redis sans réécrire les jeux.

### Chemin de scalabilité documenté (non construit)

| Étape | Quand | Ce qu'on fait |
|-------|-------|---------------|
| 1 | Maintenant | 1 process Node, état en mémoire. Tient plusieurs milliers de connexions avec batching. |
| 2 | Avant un event > 1 000 joueurs | Plusieurs instances Node + Redis pub/sub (adaptateur Socket.IO officiel). La room reste sur un nœud ; seul le fan-out se distribue. |
| 3 | Avant mise en production publique | Tests de charge k6/Artillery. On ne découvre pas la limite en production. |

---

## 5. Design system

**Direction : néo-arcade festif**  
Énergie party-game (couleurs franches, gros boutons, feedback immédiat) + identité arcade (typographie display, effets de score). Moderne, pas pixel-art rétro strict.

**Deux contextes d'affichage :**
- **Téléphone (joueur)** : mobile-first, zones tactiles ≥ 48px, feedback haptique/visuel, zéro scroll pendant la partie
- **Grand écran (hôte)** : lisible à 4 mètres, typographie géante, classement animé. C'est cet écran qui porte le spectacle — il mérite le plus d'effort visuel.

**Outils :**
- Tailwind CSS v4 — tokens du design system en CSS variables
- shadcn/ui — composants pour les écrans "froids" (admin, lobby)
- Motion (ex-Framer Motion) — animations de classement, compteurs, countdowns. Non négociable sur ce projet.
- Howler.js — gestion audio (sons de feedback, countdown, fin de partie)
- canvas-confetti — célébrations de victoire
- qrcode — génération QR code côté client pour l'écran hôte

---

## 6. Bibliothèques & outils

**Production**
```
socket.io / socket.io-client
zod
zustand          # état client, adapté aux mises à jour socket
motion
howler
canvas-confetti
qrcode
react-router
```

**Dev & qualité**
```
pnpm workspaces
Vitest           # tests unitaires des machines à états (fonctions pures → très testables)
Playwright       # tests E2E multi-onglets : 1 hôte + N joueurs simulés
Biome            # lint + format (remplace ESLint + Prettier)
tsx              # exécution TypeScript serveur en dev
```

---

## 7. Premier jeu : Tap Race

### Mécanique
- Durée : 60 secondes
- Objectif : taper l'écran le plus de fois possible
- Classement : top 10 affiché sur l'écran hôte, mis à jour en temps réel
- Pas de triche possible : les scores sont calculés et validés côté serveur

### Protocole spécifique
- **Joueur → serveur** : `TAP_BATCH { count: number }` toutes les 200 ms
- **Serveur → hôte** : `LEADERBOARD_UPDATE { players: { id, name, score }[] }` à 10×/s pendant la partie
- **Serveur → joueur** : `SCORE_UPDATE { score: number }` à 5×/s (confirmation du score validé)

### État de jeu (machine à états)
```
WAITING → COUNTDOWN(3s) → PLAYING(60s) → RESULTS
```
- `WAITING` : les joueurs rejoignent, l'hôte voit la liste se remplir
- `COUNTDOWN` : compte à rebours affiché sur les deux écrans
- `PLAYING` : taps acceptés, classement mis à jour en live
- `RESULTS` : classement final figé, possibilité de rejouer

### Ordre de développement (itératif, validé avant de passer à l'étape suivante)
1. Jeu local sans réseau — mécanique de tap + timer dans une seule page, aucun socket
2. Deux vues isolées — PlayerView et HostView avec état mocké (props statiques)
3. Temps réel mono-joueur — un seul joueur connecté via socket, score remonte à l'hôte
4. Multi-joueurs — plusieurs joueurs, classement live
5. Rooms + QR code — plusieurs parties en parallèle, rejoindre via QR code

---

## 8. Agents IA et outillage

### Agents disponibles sans configuration
- **Explore** : recherche dans le code quand le projet grossit
- **Plan** : conception de chaque nouveau jeu
- Développement parallèle de jeux dans des worktrees git isolés

### Jalon futur : après le premier jeu livré
Une fois le contrat `GameDefinition` validé par un cas réel :
- **Skill `add-game`** : processus pas-à-pas encodé (scaffold, enregistrement, doc CLAUDE.md)
- **Sous-agent `game-developer`** : agent projet instruit du contrat et de la structure imposée, capable de développer un jeu en autonomie dans un worktree isolé

### MCP navigateur (à installer)
Chrome DevTools MCP — permet à Claude de piloter un vrai navigateur pour vérifier visuellement les deux écrans et inspecter le trafic WebSocket en développement.

```
claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest
```

À installer avant le développement du premier jeu.

---

## 9. Décisions actées

| Sujet | Décision |
|-------|----------|
| Hébergement | Node.js sur VPS/cloud. WAMP/PHP écarté. |
| Échelle cible | Jusqu'à 10 000 joueurs simultanés par room pour tap-race |
| Surface utilisateur | Les joueurs accèdent directement à l'URL du jeu, jamais à la page admin |
| Base de données | Aucune en phase 1. SQLite + Drizzle le jour où la persistance est prouvée nécessaire. |
| Batching | Obligatoire dès le jour 1, protocole figé avant d'écrire une ligne de socket |
| Pixel-art vs néo-arcade | Néo-arcade moderne — chaque jeu garde sa liberté visuelle interne |

---

## 10. Décisions délibérément non prises

| Sujet | Pourquoi on attend |
|-------|-------------------|
| Auth page admin | Pas de besoin immédiat, complexifie le setup initial |
| Persistance des scores | Parties éphémères en phase 1 ; ajouter quand un vrai besoin se manifeste |
| Redis / multi-instances | Étape 2, déclenchée par un event réel > 1 000 joueurs |
| Liste des jeux après tap-race | On attend que le contrat soit validé par le premier jeu réel |
