import { describe, it, expect } from 'vitest'
import { MockProvider } from '@/providers/MockProvider'
import type { StockSummary } from '@/domain/types'

const master: StockSummary[] = [
  { code: '005930', name: '삼성전자', market: 'KOSPI', currency: 'KRW' },
  { code: '000660', name: 'SK하이닉스', market: 'KOSPI', currency: 'KRW' },
]

describe('MockProvider', () => {
  it('검색은 종목 마스터를 따른다', async () => {
    const provider = new MockProvider({ master, now: () => 0 })
    const result = await provider.search('삼성')
    expect(result).toEqual([master[0]])
  })

  it('요청한 종목의 시세를 반환한다', async () => {
    const provider = new MockProvider({ master, now: () => 0 })
    const quotes = await provider.getQuotes(['005930', '000660'])
    expect(quotes.map((q) => q.code)).toEqual(['005930', '000660'])
    expect(quotes[0].name).toBe('삼성전자')
  })

  it('마스터에 없는 코드는 결과에서 뺀다', async () => {
    const provider = new MockProvider({ master, now: () => 0 })
    const quotes = await provider.getQuotes(['005930', '999999'])
    expect(quotes).toHaveLength(1)
  })

  it('같은 시각이면 같은 가격을 준다 (결정적이다)', async () => {
    const a = new MockProvider({ master, now: () => 1000 })
    const b = new MockProvider({ master, now: () => 1000 })
    expect((await a.getQuotes(['005930']))[0].price).toBe(
      (await b.getQuotes(['005930']))[0].price,
    )
  })

  it('시간이 흐르면 가격이 변한다', async () => {
    const before = await new MockProvider({ master, now: () => 0 }).getQuotes(['005930'])
    const after = await new MockProvider({ master, now: () => 600_000 }).getQuotes(['005930'])
    expect(after[0].price).not.toBe(before[0].price)
  })

  it('현재가는 52주 최고가를 넘지 않고 양수다', async () => {
    for (let t = 0; t < 50; t++) {
      const [q] = await new MockProvider({ master, now: () => t * 37_000 }).getQuotes(['005930'])
      expect(q.price).toBeGreaterThan(0)
      expect(q.price).toBeLessThanOrEqual(q.high52w)
      expect(Number.isInteger(q.price)).toBe(true)
    }
  })

  it('달러 종목은 달러다운 자릿수로 만든다 — 20만 달러짜리 애플은 가짜가 아니라 버그로 읽힌다', async () => {
    const usd: StockSummary[] = [
      { code: 'AAPL', name: '애플', englishName: 'APPLE INC', market: 'NAS', currency: 'USD' },
    ]
    const [q] = await new MockProvider({ master: usd, now: () => 0 }).getQuotes(['AAPL'])

    expect(q.currency).toBe('USD')
    expect(q.price).toBeLessThan(1_000)
    expect(q.price).toBeGreaterThan(0)
  })

  it('asOf는 now를 따른다', async () => {
    const [q] = await new MockProvider({ master, now: () => 1_756_000_000_000 }).getQuotes(['005930'])
    expect(q.asOf).toBe(new Date(1_756_000_000_000).toISOString())
  })
})
