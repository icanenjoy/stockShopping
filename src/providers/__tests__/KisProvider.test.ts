import { describe, it, expect, vi } from 'vitest'
import { KisProvider } from '@/providers/KisProvider'
import type { StockSummary, Quote } from '@/domain/types'

const master: StockSummary[] = [
  { code: '005930', name: '삼성전자', market: 'KOSPI', currency: 'KRW' },
  { code: 'AAPL', name: '애플', englishName: 'APPLE INC', market: 'NAS', currency: 'USD' },
  { code: 'KO', name: '코카콜라', englishName: 'COCA-COLA CO', market: 'NYS', currency: 'USD' },
]

function quote(code: string, currency: 'KRW' | 'USD'): Quote {
  return {
    code,
    name: code,
    price: 1,
    prevClose: 1,
    high52w: 1,
    tradingHalted: false,
    currency,
    asOf: '2026-09-04T00:00:00.000Z',
  }
}

function makeProvider() {
  const domestic = { getQuotes: vi.fn(async (s: StockSummary[]) => s.map((x) => quote(x.code, 'KRW'))) }
  const overseas = { getQuotes: vi.fn(async (s: StockSummary[]) => s.map((x) => quote(x.code, 'USD'))) }
  const provider = new KisProvider({ domestic, overseas, master })
  return { provider, domestic, overseas }
}

describe('KisProvider', () => {
  it('검색은 마스터에서 하고 네트워크를 타지 않는다', async () => {
    const { provider, domestic, overseas } = makeProvider()
    expect((await provider.search('애플'))[0].code).toBe('AAPL')
    expect(domestic.getQuotes).not.toHaveBeenCalled()
    expect(overseas.getQuotes).not.toHaveBeenCalled()
  })

  it('국내 종목은 국내 provider로만 보낸다', async () => {
    const { provider, domestic, overseas } = makeProvider()
    await provider.getQuotes(['005930'])

    expect(domestic.getQuotes).toHaveBeenCalledWith([master[0]])
    expect(overseas.getQuotes).not.toHaveBeenCalled()
  })

  it('해외 종목은 해외 provider로만 보낸다', async () => {
    const { provider, domestic, overseas } = makeProvider()
    await provider.getQuotes(['AAPL', 'KO'])

    expect(overseas.getQuotes).toHaveBeenCalledWith([master[1], master[2]])
    expect(domestic.getQuotes).not.toHaveBeenCalled()
  })

  it('섞여 들어오면 둘로 나눠 보내고 결과를 합친다', async () => {
    const { provider, domestic, overseas } = makeProvider()
    const quotes = await provider.getQuotes(['AAPL', '005930'])

    expect(domestic.getQuotes).toHaveBeenCalledWith([master[0]])
    expect(overseas.getQuotes).toHaveBeenCalledWith([master[1]])
    expect(quotes.map((q) => q.code).sort()).toEqual(['005930', 'AAPL'])
  })

  it('마스터에 없는 코드는 조용히 버린다 — 어디로 물어볼지 알 수 없다', async () => {
    const { provider, domestic, overseas } = makeProvider()
    expect(await provider.getQuotes(['없는코드'])).toEqual([])
    expect(domestic.getQuotes).not.toHaveBeenCalled()
    expect(overseas.getQuotes).not.toHaveBeenCalled()
  })

  it('한쪽이 통째로 실패해도 다른 쪽 시세는 살린다', async () => {
    const { provider, domestic, overseas } = makeProvider()
    overseas.getQuotes.mockRejectedValueOnce(new Error('KIS 해외 장애'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const quotes = await provider.getQuotes(['AAPL', '005930'])
    expect(quotes.map((q) => q.code)).toEqual(['005930'])
    expect(domestic.getQuotes).toHaveBeenCalled()
  })

  it('빈 목록은 아무 provider도 부르지 않는다', async () => {
    const { provider, domestic, overseas } = makeProvider()
    expect(await provider.getQuotes([])).toEqual([])
    expect(domestic.getQuotes).not.toHaveBeenCalled()
    expect(overseas.getQuotes).not.toHaveBeenCalled()
  })
})
