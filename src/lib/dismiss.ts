import { useState } from 'react'

// «Закрыть карточку на сегодня» (настроение, копия и т.п.). Это удобство, поэтому хватает localStorage.

const key = (name: string) => `moy-den-dismiss:${name}`

function read(name: string): string | null {
  try {
    return localStorage.getItem(key(name))
  } catch {
    return null
  }
}

/** Скрыта ли карточка в этот день, и функция «скрыть до завтра» */
export function useDismissedToday(name: string, today: string): [boolean, () => void] {
  const [value, setValue] = useState(() => read(name))
  const dismiss = () => {
    try {
      localStorage.setItem(key(name), today)
    } catch {
      /* приватный режим */
    }
    setValue(today)
  }
  return [value === today, dismiss]
}
