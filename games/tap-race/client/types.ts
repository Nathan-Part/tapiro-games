import type { Phase } from './game'

export interface TeamScore {
  id: string
  name: string
  color: string
  score: number
}

export interface LeaderboardEntry {
  id: string
  name: string
  score: number
  teamId?: string
}

export interface PlayerViewState {
  phase: Phase
  countdown: number
  timeLeft: number
  score: number
  playerName: string
  teamId?: string
  teams?: TeamScore[]
  waitingPlayers?: { id: string; name: string; teamId?: string }[]
  totalPlayers?: number
}

export interface HostViewState {
  phase: Phase
  countdown: number
  timeLeft: number
  leaderboard: LeaderboardEntry[]
  roomCode?: string
  teams?: TeamScore[]
}
