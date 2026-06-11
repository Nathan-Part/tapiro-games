import { z } from 'zod'

export const TapBatchSchema = z.object({ count: z.number().int().min(0).max(500) })
export const ScoreUpdateSchema = z.object({ score: z.number().int().min(0), eliminated: z.boolean().optional() })
export const LeaderboardEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  score: z.number().int().min(0),
  totalScore: z.number().int().min(0).optional(),
  eliminated: z.boolean().optional(),
})
export const LeaderboardUpdateSchema = z.object({
  players: z.array(LeaderboardEntrySchema),
  ropePosition: z.number().optional(),
  isFinalResults: z.boolean().optional(),
})
export const GameStateUpdateSchema = z.object({
  phase: z.enum(['WAITING', 'COUNTDOWN', 'PLAYING', 'RESULTS']),
  countdown: z.number().int().optional(),
  timeLeft: z.number().int().optional(),
  gameDuration: z.number().int().optional(),
  frenzy: z.boolean().optional(),
  currentRound: z.number().int().optional(),
  totalRounds: z.number().int().optional(),
})
export const FrenzyStateSchema = z.object({ active: z.boolean() })
export const EliminationSchema = z.object({ ids: z.array(z.string()) })

export type TapBatch = z.infer<typeof TapBatchSchema>
export type ScoreUpdate = z.infer<typeof ScoreUpdateSchema>
export type LeaderboardUpdate = z.infer<typeof LeaderboardUpdateSchema>
export type GameStateUpdate = z.infer<typeof GameStateUpdateSchema>
export type FrenzyState = z.infer<typeof FrenzyStateSchema>
export type Elimination = z.infer<typeof EliminationSchema>

export const RejoinRoomSchema = z.object({
  code: z.string().min(1).max(10),
  token: z.string().uuid(),
})

export type RejoinRoom = z.infer<typeof RejoinRoomSchema>
