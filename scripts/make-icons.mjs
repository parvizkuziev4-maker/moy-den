// Рисует иконку «Мой День» (солнце с галочкой) и делает PNG нужных размеров.
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'

function svg({ rounded, scale }) {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6
    const r1 = 150, r2 = 192
    const x1 = 256 + r1 * Math.cos(a), y1 = 256 + r1 * Math.sin(a)
    const x2 = 256 + r2 * Math.cos(a), y2 = 256 + r2 * Math.sin(a)
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`
  }).join('')
  const t = (256 * (1 - scale)).toFixed(1)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFC56B"/>
      <stop offset="1" stop-color="#EB7A3C"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#bg)"/>
  <g transform="translate(${t} ${t}) scale(${scale})">
    <g stroke="#FFF8EE" stroke-width="26" stroke-linecap="round">${rays}</g>
    <circle cx="256" cy="256" r="118" fill="#FFF8EE"/>
    <path d="M200 260 l38 38 l78 -84" fill="none" stroke="#EB7A3C" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`
}

const rounded = svg({ rounded: true, scale: 1 })
const square = svg({ rounded: false, scale: 1 })
const maskable = svg({ rounded: false, scale: 0.72 })

writeFileSync('public/icon.svg', rounded)
const out = [
  [square, 'public/apple-touch-icon.png', 180],
  [rounded, 'public/pwa-192.png', 192],
  [rounded, 'public/pwa-512.png', 512],
  [maskable, 'public/pwa-maskable-512.png', 512],
]
for (const [src, file, size] of out) {
  await sharp(Buffer.from(src)).resize(size, size).png().toFile(file)
  console.log('✓', file)
}
