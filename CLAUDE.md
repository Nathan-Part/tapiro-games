# Mini Games Platform — CLAUDE.md

## Projet

Plateforme de mini-jeux multi-joueurs en temps réel. Chaque jeu oppose des candidats connectés depuis leur téléphone (jusqu'à 10 000 simultanés), pendant qu'un écran partagé (grand écran, vidéoprojecteur) affiche le classement en direct, style Kahoot.

## Vision produit

- **Écran joueur** (`/play/:roomCode`) — interface de jeu sur téléphone, rejoint via QR code
- **Écran hôte** (`/host/:roomCode`) — grand écran partagé, classement live, spectacle
- **Page admin** (`/`) — accès interne uniquement (liste des jeux, création de sessions). Les utilisateurs finaux accèdent directement aux URLs des jeux, jamais à la page admin.
- Chaque jeu fonctionne de manière totalement indépendante (pas de couplage entre jeux)
- Architecture modulaire : ajouter un jeu = créer son dossier, aucun fichier existant modifié

## Décisions actées (session 2026-06-10)

| Sujet | Décision |
|-------|----------|
| Stack frontend | React 19 + Vite + TypeScript |
| Temps réel | Socket.IO (rooms natives, reconnexion automatique, adaptateur Redis prévu) |
| Backend | Node.js + TypeScript (partage de types client ↔ serveur) |
| Monorepo | pnpm workspaces — `apps/web`, `apps/server`, `packages/shared`, `games/*` |
| Base de données | Aucune en phase 1 (état éphémère en mémoire) |
| Style visuel | Néo-arcade festif (Tailwind v4, shadcn/ui, Motion pour les animations) |
| Hébergement | VPS/cloud Node.js — WAMP/PHP écarté |
| Échelle cible | Jusqu'à 10 000 joueurs simultanés par room |
| Batching | Obligatoire dès le jour 1 — le client envoie des lots toutes les 200 ms, pas chaque event |
| Premier jeu | Tap Race (voir section dédiée) |

## Principes directeurs

- **Autonomie des jeux** : chaque jeu doit pouvoir être développé, modifié et supprimé sans impacter les autres
- **Serveur autoritaire** : toute la logique de score et d'état se calcule côté serveur — pas de triche possible, état testable unitairement
- **Modularité** : la découverte des jeux est dynamique (`import.meta.glob`), pas via une liste hard-codée
- **Pas de sur-ingénierie** : commencer simple, complexifier seulement quand le besoin est prouvé
- **État sérialisable** : les machines à états des jeux ne contiennent aucune référence non-sérialisable (prérequis Redis)

## Architecture

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

Chaque jeu exporte une `GameDefinition` : métadonnées + machine à états serveur + deux composants React (PlayerView, HostView).

## Chemin de scalabilité

| Étape | Déclencheur | Action |
|-------|-------------|--------|
| 1 (actuel) | — | 1 process Node, état en mémoire |
| 2 | Avant un event > 1 000 joueurs | Redis pub/sub + plusieurs instances Node |
| 3 | Avant mise en prod publique | Tests de charge k6/Artillery |

## Processus d'ajout d'un nouveau jeu

> Processus complet à formaliser après la livraison du premier jeu (tap-race), une fois le contrat `GameDefinition` validé par un cas réel.

Structure attendue :
1. Créer `games/<id>/` avec les trois sous-dossiers (`shared/`, `server/`, `client/`)
2. Implémenter la `GameDefinition` (métadonnées + machine à états + vues)
3. Le jeu est automatiquement découvert — aucun fichier existant à modifier
4. Documenter le jeu dans ce fichier

## Conventions

- Toujours TypeScript strict, aucun `any`
- Zod pour valider tous les messages réseau entrants (côté serveur)
- Les machines à états des jeux sont des fonctions pures — pas d'effets de bord, pas de timers internes
- Biome pour le lint et le format

## Outils MCP à installer (avant le développement du premier jeu)

```
claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest
```

Permet à Claude de piloter un vrai navigateur : vérifier visuellement les deux écrans et inspecter le trafic WebSocket pendant le développement.

## Premier jeu : Tap Race

**Mécanique** : 60 secondes, taper l'écran le plus de fois possible, classement top 10 live sur l'écran hôte.

**Machine à états** : `WAITING → COUNTDOWN(3s) → PLAYING(60s) → RESULTS`

**Protocole** :
- Joueur → serveur : `TAP_BATCH { count }` toutes les 200 ms
- Serveur → hôte : `LEADERBOARD_UPDATE` à 10×/s
- Serveur → joueur : `SCORE_UPDATE` à 5×/s

**Ordre de développement itératif** :
1. Jeu local sans réseau (mécanique + timer, une seule page)
2. Deux vues isolées (PlayerView + HostView avec état mocké)
3. Temps réel mono-joueur (socket, score remonte à l'hôte)
4. Multi-joueurs (classement live)
5. Rooms + QR code (plusieurs parties en parallèle)

## Spec complète

`docs/superpowers/specs/2026-06-10-arcade-platform-foundations-design.md`

## Sessions passées

| Session | Date | Travail effectué |
|---------|------|-----------------|
| 1 | 2026-06-10 | Setup initial du projet, rédaction CLAUDE.md |
| 2 | 2026-06-10 | Brainstorming complet — stack, architecture, scalabilité, design system. Toutes les décisions fondatrices actées. Spec rédigée. |
