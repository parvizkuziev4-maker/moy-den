// Сравнение имён людей, как бы они ни были написаны:
// кириллица (русская и таджикская) и латиница, любой порядок слов, одно слово против полного имени.
// Чистые функции — см. nameMatch.test.ts

// Кириллица → латиница (одни правила для всех). ё = е.
const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  // таджикские буквы
  ӣ: 'i', ӯ: 'u', ҳ: 'h', қ: 'k', ғ: 'g', ҷ: 'j',
}

/**
 * Привести имя к одному виду латиницы.
 * Варианты латиницы сводятся вместе: kh = x = h, j = dzh = dj, q = k, gh = g, yo = ye = e, w = v.
 */
export function latinize(s: string): string {
  let out = ''
  for (const ch of s.toLowerCase()) out += CYR[ch] ?? ch
  return (
    out
      .replace(/[ʻʼ’‘'`´]/g, '') // апострофы (o'g'li, Ma'ruf)
      .replace(/dzh/g, 'j')
      .replace(/dj/g, 'j')
      .replace(/kh/g, 'h')
      .replace(/x/g, 'h')
      .replace(/q/g, 'k')
      .replace(/gh/g, 'g')
      .replace(/y[oe]/g, 'e')
      // «й» перед согласной и в конце слова = «i»: Huseyn = Husein, Aliy = Alii
      .replace(/y(?![aeiou])/g, 'i')
      .replace(/w/g, 'v')
      // остаются только латинские буквы и пробелы
      .replace(/[^a-z\s]/g, ' ')
  )
}

/** Слова имени в едином виде: «Сафаров  Мустафо» → ['safarov', 'mustafo'] */
export function nameTokens(name: string): string[] {
  return latinize(name).split(/\s+/).filter(Boolean)
}

/** Расстояние Левенштейна: сколько букв нужно заменить, вставить или убрать */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]!
}

/** Похожи ли два слова: та же первая буква и 1–2 отличия (у слов до 4 букв — ни одного) */
function closeWords(a: string, b: string): boolean {
  if (a === b) return true
  if (a[0] !== b[0]) return false
  const len = Math.min(a.length, b.length)
  // короткие имена (Аня/Ася, Али/Оли) — только точно: одна буква у них уже другое имя
  const allowed = len >= 9 ? 2 : len >= 5 ? 1 : 0
  return editDistance(a, b) <= allowed
}

/** Все способы сопоставить слова короткого имени разным словам длинного (имён обычно 1–4 слова) */
function* pairings(short: string[], long: string[], used: boolean[] = [], i = 0): Generator<[string, string][]> {
  if (i === short.length) {
    yield []
    return
  }
  for (let j = 0; j < long.length; j++) {
    if (used[j]) continue
    used[j] = true
    for (const rest of pairings(short, long, used, i + 1)) yield [[short[i]!, long[j]!], ...rest]
    used[j] = false
  }
}

export type NameMatch = 'exact' | 'similar' | 'none'

/**
 * Сравнить два имени.
 * - exact: те же слова после приведения к одной латинице, в любом порядке;
 *   или все слова короткого имени есть в длинном («Мустафо» = «Мустафо Сафаров»).
 * - similar: то же, но в словах есть маленькие отличия («Mustafo» ~ «Mustafa»).
 * - none: другой человек.
 */
export function compareNames(a: string, b: string): NameMatch {
  const ta = nameTokens(a)
  const tb = nameTokens(b)
  if (!ta.length || !tb.length) return 'none'
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  if (long.length > 6) return 'none' // слишком длинное — это уже не имя

  let best: NameMatch = 'none'
  for (const pairs of pairings(short, long)) {
    if (pairs.every(([x, y]) => x === y)) return 'exact'
    if (pairs.every(([x, y]) => closeWords(x, y))) best = 'similar'
  }
  return best
}

/** Кандидаты среди людей приложения: точные и похожие совпадения */
export function findPeople<P extends { name: string }>(people: P[], name: string): { exact: P[]; similar: P[] } {
  const exact: P[] = []
  const similar: P[] = []
  for (const p of people) {
    const m = compareNames(p.name, name)
    if (m === 'exact') exact.push(p)
    else if (m === 'similar') similar.push(p)
  }
  return { exact, similar }
}
