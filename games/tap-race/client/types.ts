import type { Phase } from './game'

export interface LeaderboardEntry {
  id: string
  name: string
  score: number
}

export interface PlayerViewState {
  phase: Phase
  countdown: number
  timeLeft: number
  score: number
  playerName: string
  waitingPlayers?: { id: string; name: string }[]
  totalPlayers?: number
}

export interface HostViewState {
  phase: Phase
  countdown: number
  timeLeft: number
  leaderboard: LeaderboardEntry[]
  roomCode?: string
}
