/**
 * Отдать файл пользователю. На iPhone откроется меню «Поделиться»
 * (сохранить в Файлы, отправить себе в Telegram). Если не вышло — обычное скачивание.
 * Возвращает false, если пользователь сам закрыл меню.
 */
export async function shareOrDownload(fileName: string, text: string, mime: string): Promise<boolean> {
  const file = new File([text], fileName, { type: mime })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName })
      return true
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false
      // иначе пробуем скачать
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}
