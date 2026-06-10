import { useEffect, useRef } from 'react'

interface Props {
  onTap: () => void
}

const MAX_FX_NODES = 26

/**
 * Bouton de tap géant : anneau conique rotatif, halo qui pulse avec la
 * fréquence des taps, ondes concentriques et « +1 » flottants.
 *
 * Tous les effets sont impératifs (DOM + animations CSS) : aucun setState
 * par tap, le chemin chaud reste hors du cycle de rendu React.
 */
export default function TapButton({ onTap }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const fxRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const heatRef = useRef(0)
  const decayRafRef = useRef(0)
  const reducedRef = useRef(false)

  useEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return () => cancelAnimationFrame(decayRafRef.current)
  }, [])

  function scheduleDecay() {
    cancelAnimationFrame(decayRafRef.current)
    let last = performance.now()
    const decay = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      heatRef.current = Math.max(0, heatRef.current - dt * 0.55)
      applyHeat()
      if (heatRef.current > 0) decayRafRef.current = requestAnimationFrame(decay)
    }
    decayRafRef.current = requestAnimationFrame(decay)
  }

  function applyHeat() {
    const glow = glowRef.current
    if (!glow) return
    const h = heatRef.current
    glow.style.opacity = String(0.3 + h * 0.7)
    glow.style.transform = `scale(${1 + h * 0.16})`
  }

  function spawnFx(x: number, y: number) {
    const layer = fxRef.current
    if (!layer) return
    while (layer.childElementCount >= MAX_FX_NODES && layer.firstChild) {
      layer.removeChild(layer.firstChild)
    }

    const ripple = document.createElement('span')
    ripple.className = 'tr-ripple'
    ripple.style.left = `${x}px`
    ripple.style.top = `${y}px`
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true })
    layer.appendChild(ripple)

    const float = document.createElement('span')
    float.className = 'tr-float'
    float.textContent = '+1'
    float.style.left = `${x}px`
    float.style.top = `${y}px`
    float.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 56)}px`)
    float.addEventListener('animationend', () => float.remove(), { once: true })
    layer.appendChild(float)
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault()
    onTap()

    if (reducedRef.current) return

    const btn = btnRef.current
    if (btn) {
      // micro-secousse : on relance l'animation CSS à chaque tap
      btn.classList.remove('tr-tap--pop')
      void btn.offsetWidth
      btn.classList.add('tr-tap--pop')
    }

    const layer = fxRef.current
    if (layer) {
      const rect = layer.getBoundingClientRect()
      spawnFx(e.clientX - rect.left, e.clientY - rect.top)
    }

    heatRef.current = Math.min(1, heatRef.current + 0.13)
    applyHeat()
    scheduleDecay()
  }

  return (
    <div className="tr-tapwrap">
      <div ref={glowRef} className="tr-tapglow" aria-hidden="true" />
      <div className="tr-tapring" aria-hidden="true" />
      <button ref={btnRef} className="tr-tap" onPointerDown={handlePointerDown}>
        TAP
      </button>
      <div ref={fxRef} className="tr-fxlayer" aria-hidden="true" />
    </div>
  )
}
