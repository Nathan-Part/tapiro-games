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
