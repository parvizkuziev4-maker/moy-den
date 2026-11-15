const COLORS = ['#e8913a', '#e5654b', '#2a9d82', '#3b82c4', '#8b6fd6', '#d9578a', '#ffc56b']

/** Маленький праздник: конфетти на 2 секунды. Уважает «Уменьшение движения». */
export function confetti(count = 70) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const root = document.createElement('div')
  root.className = 'confetti'
  root.setAttribute('aria-hidden', 'true')
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span')
    p.style.left = `${Math.random() * 100}%`
    p.style.background = COLORS[i % COLORS.length]!
    p.style.animationDelay = `${Math.random() * 0.4}s`
    p.style.animationDuration = `${1.4 + Math.random() * 0.9}s`
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`)
    p.style.setProperty('--rot', `${(Math.random() - 0.5) * 1080}deg`)
    if (i % 3 === 0) p.style.borderRadius = '50%'
    root.appendChild(p)
  }
  document.body.appendChild(root)
  setTimeout(() => root.remove(), 2800)
}
