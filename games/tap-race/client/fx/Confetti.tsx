import { useEffect, useRef } from 'react'

const COLORS = ['#00f5ff', '#7b2fff', '#ff3860', '#ffc83d', '#f0f0ff']

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  w: number
  h: number
  color: string
  round: boolean
  delay: number
}

interface Props {
  /** nombre de confettis */
  count?: number
  /** délai avant le lancer (ms) — ex. attendre la montée du podium */
  delay?: number
}

/**
 * Pluie de confettis canvas, tirée une seule fois au montage (écran RESULTS).
 * S'arrête toute seule, désactivée si prefers-reduced-motion.
 */
export default function Confetti({ count = 190, delay = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // deux canons latéraux + une gerbe centrale
    const pieces: Piece[] = Array.from({ length: count }, (_, i) => {
      const source = i % 3
      const fromLeft = source === 0
      const central = source === 2
      const x = central ? width / 2 : fromLeft ? -10 : width + 10
      const angle = central
        ? -Math.PI / 2 + (Math.random() - 0.5) * 0.9
        : fromLeft
          ? -Math.PI / 3.2 + (Math.random() - 0.5) * 0.5
          : -Math.PI + Math.PI / 3.2 + (Math.random() - 0.5) * 0.5
      const speed = central ? 9 + Math.random() * 7 : 11 + Math.random() * 8
      return {
        x,
        y: central ? height * 0.22 : height * 0.75,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.32,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 7,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        round: Math.random() < 0.25,
        delay: Math.random() * 320,
      }
    })

    let raf = 0
    let stopped = false
    const t0 = performance.now() + delay

    function step(now: number) {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, width, height)
      let alive = 0
      for (const p of pieces) {
        if (now < t0 + p.delay) {
          alive++
          continue
        }
        p.vy += 0.32 // gravité
        p.vx *= 0.985
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        if (p.y < height + 30) {
          alive++
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rot)
          ctx.fillStyle = p.color
          if (p.round) {
            ctx.beginPath()
            ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2)
            ctx.fill()
          } else {
            // léger effet 3D par écrasement vertical
            ctx.scale(1, 0.55 + Math.abs(Math.sin(p.rot * 2)) * 0.45)
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
          }
          ctx.restore()
        }
      }
      if (alive > 0 && !stopped) {
        raf = requestAnimationFrame(step)
      } else {
        ctx.clearRect(0, 0, width, height)
      }
    }

    raf = requestAnimationFrame(step)
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
    }
  }, [count, delay])

  return <canvas ref={canvasRef} className="tr-confetti" aria-hidden="true" />
}
