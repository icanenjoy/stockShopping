import type { PriceProvider } from './PriceProvider'
import type { StockSummary, Quote } from '@/domain/types'
import { searchStocks } from '@/domain/search'
import { STOCK_MASTER } from '@/data/stocks'

/** 국내·해외 어느 쪽이든 종목을 받아 시세를 돌려주는 하위 조회기 */
interface QuoteSource {
  getQuotes(stocks: StockSummary[]): Promise<Quote[]>
}

/**
 * 종목코드를 보고 국내·해외 조회기로 나눠 보낸다.
 *
 * KIS는 국내와 해외의 엔드포인트·파라미터·응답 필드가 모두 다르다. 그 차이를
 * 각 조회기 안에 가두고, 바깥에는 "코드를 주면 시세가 온다"만 남긴다.
 */
export class KisProvider implements PriceProvider {
  private readonly domestic: QuoteSource
  private readonly overseas: QuoteSource
  private readonly master: StockSummary[]
  private readonly byCode: Map<string, StockSummary>

  constructor(opts: { domestic: QuoteSource; overseas: QuoteSource; master?: StockSummary[] }) {
    this.domestic = opts.domestic
    this.overseas = opts.overseas
    this.master = opts.master ?? STOCK_MASTER
    this.byCode = new Map(this.master.map((stock) => [stock.code, stock]))
  }

  async search(query: string): Promise<StockSummary[]> {
    return searchStocks(this.master, query)
  }

  async getQuotes(codes: string[]): Promise<Quote[]> {
    const stocks = codes
      .map((code) => this.byCode.get(code))
      .filter((s): s is StockSummary => s !== undefined)

    const domestic = stocks.filter((s) => s.currency === 'KRW')
    const overseas = stocks.filter((s) => s.currency !== 'KRW')

    // 한쪽 시장이 통째로 죽어도 다른 쪽 총액은 보여준다.
    const settled = await Promise.allSettled([
      domestic.length > 0 ? this.domestic.getQuotes(domestic) : Promise.resolve([]),
      overseas.length > 0 ? this.overseas.getQuotes(overseas) : Promise.resolve([]),
    ])

    const quotes: Quote[] = []
    for (const result of settled) {
      if (result.status === 'fulfilled') quotes.push(...result.value)
      else console.error('[kis] 시장 단위 조회 실패', result.reason)
    }
    return quotes
  }
}
