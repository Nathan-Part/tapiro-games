import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  violet: boolean
}

const LINK_DIST = 120
const POINTER_DIST = 160

/**
 * Fond animé : réseau de particules cyan/violet sur canvas.
 * Purement décoratif — rAF, pause quand l'onglet est caché,
 * désactivé si prefers-reduced-motion.
 */
export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let particles: Particle[] = []
    let raf = 0
    let running = true
    const pointer = { x: -9999, y: -9999 }

    function resize() {
      if (!canvas || !ctx) return
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.min(95, Math.max(35, Math.round((width * height) / 16000)))
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 0.8 + Math.random() * 1.7,
        violet: Math.random() < 0.35,
      }))
    }

    function step() {
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)

      for (const p of particles) {
        // attraction douce vers le curseur
        const pdx = pointer.x - p.x
        const pdy = pointer.y - p.y
        const pd = Math.hypot(pdx, pdy)
        if (pd < POINTER_DIST && pd > 0.01) {
          p.vx += (pdx / pd) * 0.012
          p.vy += (pdy / pd) * 0.012
        }
        p.vx = Math.max(-0.6, Math.min(0.6, p.vx))
        p.vy = Math.max(-0.6, Math.min(0.6, p.vy))
        p.x += p.vx
        p.y += p.vy
        if (p.x < -20) p.x = width + 20
        if (p.x > width + 20) p.x = -20
        if (p.y < -20) p.y = height + 20
        if (p.y > height + 20) p.y = -20
      }

      // liens
      ctx.lineWidth = 1
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.16
            ctx.strokeStyle = `rgba(0, 245, 255, ${alpha.toFixed(3)})`
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      // points
      for (const p of particles) {
        ctx.fillStyle = p.violet ? 'rgba(123, 47, 255, 0.75)' : 'rgba(0, 245, 255, 0.8)'
        ctx.shadowColor = p.violet ? 'rgba(123, 47, 255, 0.9)' : 'rgba(0, 245, 255, 0.9)'
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.shadowBlur = 0

      if (running) raf = requestAnimationFrame(step)
    }

    function onPointerMove(e: PointerEvent) {
      pointer.x = e.clientX
      pointer.y = e.clientY
    }
    function onPointerLeave() {
      pointer.x = -9999
      pointer.y = -9999
    }
    function onVisibility() {
      running = !document.hidden
      cancelAnimationFrame(raf)
      if (running) raf = requestAnimationFrame(step)
    }

    resize()
    raf = requestAnimationFrame(step)
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerout', onPointerLeave)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerout', onPointerLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas ref={canvasRef} className="arc-particles" aria-hidden="true" />
}
