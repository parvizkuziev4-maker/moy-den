import { describe, expect, it } from 'vitest'
import { compareNames, editDistance, findPeople, latinize, nameTokens } from './nameMatch'

describe('latinize — одна латиница для всех написаний', () => {
  it('русская и таджикская кириллица', () => {
    expect(latinize('Мустафо Сафаров')).toBe('mustafo safarov')
    expect(latinize('Ҷамшед Қодирӣ')).toBe('jamshed kodiri')
    expect(latinize('Ғафуров Ҳусейн')).toBe('gafurov husein')
    expect(latinize('Ёдгор')).toBe('edgor')
  })
  it('варианты латиницы: kh = x = h, j = dzh = dj, q = k', () => {
    const one = (s: string) => latinize(s)
    expect(one('Mukhammad')).toBe(one('Muhammad'))
    expect(one('Xurshed')).toBe(one('Khurshed'))
    expect(one('Dzhamshed')).toBe(one('Jamshed'))
    expect(one('Djamshed')).toBe(one('Jamshed'))
    expect(one('Qurbonov')).toBe(one('Kurbonov'))
    expect(one('Yodgor')).toBe(one('Ёдгор'))
  })
  it('регистр, ё/е, лишние пробелы и апострофы не важны', () => {
    expect(nameTokens('  СЕМЁН   петров ')).toEqual(['semen', 'petrov'])
    expect(nameTokens("Ma'ruf")).toEqual(['maruf'])
  })
})

describe('compareNames', () => {
  it('«Safarov Mustafo» = «Мустафо Сафаров»', () => {
    expect(compareNames('Safarov Mustafo', 'Мустафо Сафаров')).toBe('exact')
  })
  it('«Qurbonov Muhammadali» = «Мухаммадали Курбонов»', () => {
    expect(compareNames('Qurbonov Muhammadali', 'Мухаммадали Курбонов')).toBe('exact')
  })
  it('Muhammadali и Mukhammadali — одно и то же написание (kh = h)', () => {
    expect(compareNames('Muhammadali', 'Mukhammadali')).toBe('exact')
  })
  it('одно слово совпадает с полным именем', () => {
    expect(compareNames('Мустафо', 'Мустафо Сафаров')).toBe('exact')
    expect(compareNames('Safarov', 'Мустафо Сафаров')).toBe('exact')
  })
  it('«Mustafo» похоже на «Mustafa», но не точно', () => {
    expect(compareNames('Mustafo', 'Mustafa')).toBe('similar')
    expect(compareNames('Safarov Mustafa', 'Мустафо Сафаров')).toBe('similar')
    expect(compareNames('Mustafa', 'Мустафо Сафаров')).toBe('similar')
  })
  it('«Мустафо» не совпадает с «Мухаммадали»', () => {
    expect(compareNames('Мустафо', 'Мухаммадали')).toBe('none')
    expect(compareNames('Мустафо Сафаров', 'Мухаммадали Курбонов')).toBe('none')
  })
  it('короткие и разные имена не путаются', () => {
    expect(compareNames('Али', 'Оли')).toBe('none') // разная первая буква
    expect(compareNames('Аня', 'Ася')).toBe('none') // короткие — только точно
    expect(compareNames('Мустафо Сафаров', 'Мустафо Каримов')).toBe('none') // фамилия другая
    expect(compareNames('', 'Мустафо')).toBe('none')
  })
})

describe('findPeople', () => {
  const people = [
    { id: '1', name: 'Мустафо Сафаров' },
    { id: '2', name: 'Мухаммадали Курбонов' },
    { id: '3', name: 'Мустафа Каримов' },
  ]
  it('точное совпадение', () => {
    const r = findPeople(people, 'Safarov Mustafo')
    expect(r.exact.map((p) => p.id)).toEqual(['1'])
  })
  it('одно слово: точное у одного, похожее у другого', () => {
    const r = findPeople(people, 'Mustafo')
    expect(r.exact.map((p) => p.id)).toEqual(['1'])
    expect(r.similar.map((p) => p.id)).toEqual(['3'])
  })
  it('новый человек — никого', () => {
    expect(findPeople(people, 'Фарход Раҳимов')).toEqual({ exact: [], similar: [] })
  })
})

describe('editDistance', () => {
  it('считает отличия', () => {
    expect(editDistance('mustafo', 'mustafa')).toBe(1)
    expect(editDistance('abc', 'abc')).toBe(0)
    expect(editDistance('', 'abc')).toBe(3)
  })
})
