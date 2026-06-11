export interface RateLimiterOptions {
  max: number
  windowMs: number
}

/**
 * Limiteur de débit en mémoire (fenêtre fixe) par clé (ex: adresse IP).
 * Retourne `true` si la requête est autorisée, `false` si la limite est atteinte.
 * Suffisant pour une instance unique ; derrière plusieurs instances, déléguer
 * au reverse-proxy / à Redis.
 */
export function createRateLimiter({ max, windowMs }: RateLimiterOptions): (key: string) => boolean {
  const hits = new Map<string, { count: number; resetAt: number }>()
  return (key: string): boolean => {
    const now = Date.now()
    const entry = hits.get(key)
    if (!entry || now >= entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      return true
    }
    if (entry.count >= max) return false
    entry.count++
    return true
  }
}
