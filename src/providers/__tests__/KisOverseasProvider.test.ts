import { describe, it, expect, vi } from 'vitest'
import { KisOverseasProvider } from '@/providers/KisOverseasProvider'
import type { KisTokenManager } from '@/providers/KisTokenManager'
import type { StockSummary } from '@/domain/types'

const BASE = 'https://kis.test'
const APPLE: StockSummary = {
  code: 'AAPL',
  name: '애플',
  englishName: 'APPLE INC',
  market: 'NAS',
  currency: 'USD',
}
const COKE: StockSummary = { code: 'KO', name: '코카콜라', market: 'NYS', currency: 'USD' }

const tokenManager = { getToken: async () => 'TOKEN' } as unknown as KisTokenManager

function detail(over: Record<string, string> = {}) {
  return {
    rt_cd: '0',
    output: {
      last: '328.2100',
      base: '324.9600',
      h52p: '344.2729',
      curr: 'USD',
      e_ordyn: '매매 가능',
      ...over,
    },
  }
}

function providerWith(fetchFn: typeof fetch) {
  return new KisOverseasProvider({
    tokenManager,
    appKey: 'KEY',
    appSecret: 'SECRET',
    baseUrl: BASE,
    fetchFn,
  })
}

describe('KisOverseasProvider', () => {
  it('현재가·전일종가·52주 최고가를 그대로 옮긴다', async () => {
    const fetchFn = vi.fn(async () => Response.json(detail())) as unknown as typeof fetch
    const [quote] = await providerWith(fetchFn).getQuotes([APPLE])

    expect(quote.code).toBe('AAPL')
    expect(quote.name).toBe('애플')
    expect(quote.price).toBe(328.21)
    expect(quote.prevClose).toBe(324.96)
    expect(quote.high52w).toBe(344.2729)
  })

  it('통화를 USD로 표시한다 — 원화와 섞이면 총액이 거짓이 된다', async () => {
    const fetchFn = vi.fn(async () => Response.json(detail())) as unknown as typeof fetch
    const [quote] = await providerWith(fetchFn).getQuotes([APPLE])
    expect(quote.currency).toBe('USD')
  })

  it('52주 최고가를 주는 price-detail을 부른다 — price에는 그 값이 없다', async () => {
    const fetchFn = vi.fn(async () => Response.json(detail())) as unknown as typeof fetch
    await providerWith(fetchFn).getQuotes([APPLE])

    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toContain('/uapi/overseas-price/v1/quotations/price-detail')
    expect((init as RequestInit).headers).toMatchObject({ tr_id: 'HHDFS76200200' })
  })

  it('거래소를 EXCD로 넘긴다 — 티커만으로는 어느 거래소인지 알 수 없다', async () => {
    const fetchFn = vi.fn(async () => Response.json(detail())) as unknown as typeof fetch
    await providerWith(fetchFn).getQuotes([APPLE, COKE])

    const calls = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]))
    expect(calls.some((u) => u.includes('EXCD=NAS') && u.includes('SYMB=AAPL'))).toBe(true)
    expect(calls.some((u) => u.includes('EXCD=NYS') && u.includes('SYMB=KO'))).toBe(true)
  })

  it('매매 불가는 거래정지로 본다', async () => {
    const fetchFn = vi.fn(async () =>
      Response.json(detail({ e_ordyn: '매매 불가' })),
    ) as unknown as typeof fetch
    const [quote] = await providerWith(fetchFn).getQuotes([APPLE])
    expect(quote.tradingHalted).toBe(true)
  })

  it('알 수 없는 매매 상태 문구는 거래정지로 보지 않는다 — 잘못 막으면 총액에서 사라진다', async () => {
    const fetchFn = vi.fn(async () =>
      Response.json(detail({ e_ordyn: '' })),
    ) as unknown as typeof fetch
    const [quote] = await providerWith(fetchFn).getQuotes([APPLE])
    expect(quote.tradingHalted).toBe(false)
  })

  it('한 종목이 실패해도 나머지는 살린다', async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('SYMB=AAPL')) return new Response('', { status: 500 })
      return Response.json(detail({ last: '70.0000' }))
    }) as unknown as typeof fetch

    const quotes = await providerWith(fetchFn).getQuotes([APPLE, COKE])
    expect(quotes.map((q) => q.code)).toEqual(['KO'])
  })

  it('rt_cd가 0이 아니면 그 종목을 버린다 — 빈 값을 0원으로 보여주면 안 된다', async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ rt_cd: '1', msg1: '조회할 수 없습니다' }),
    ) as unknown as typeof fetch
    expect(await providerWith(fetchFn).getQuotes([APPLE])).toEqual([])
  })
})
