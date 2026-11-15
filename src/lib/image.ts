/**
 * Сжать фото для карточки человека: квадрат до 360 px, JPEG, не больше ~200 КБ.
 * Возвращает data:URL — его можно хранить прямо в базе и в резервной копии.
 */
export async function compressPhoto(file: File, maxBytes = 200_000): Promise<string> {
  const img = await loadImage(file)
  const side = Math.min(img.width, img.height)
  const sx = (img.width - side) / 2
  const sy = (img.height - side) / 2

  for (const size of [360, 280, 200]) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
    for (const q of [0.82, 0.7, 0.55]) {
      const url = canvas.toDataURL('image/jpeg', q)
      // длина base64 ≈ 4/3 от размера файла
      if (url.length * 0.75 <= maxBytes) return url
    }
  }
  throw new Error('too big')
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image'))
    }
    img.src = url
  })
}
