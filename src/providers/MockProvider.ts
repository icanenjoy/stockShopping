import type { PriceProvider } from './PriceProvider'
import type { StockSummary, Quote } from '@/domain/types'
import { searchStocks } from '@/domain/search'
import { STOCK_MASTER } from '@/data/stocks'

/** 종목코드를 안정적인 정수 해시로 바꾼다 */
function hash(code: string): number {
  let h = 0
  for (let i = 0; i < code.length; i++) {
    h = (h * 31 + code.charCodeAt(i)) % 100_000
  }
  return h
}

const TICK_MS = 5_000

/**
 * KIS 없이 개발·테스트하기 위한 가짜 시세 소스.
 * 가격은 종목코드와 시각만으로 결정되므로 테스트에서 재현 가능하다.
 */
export class MockProvider implements PriceProvider {
  private readonly master: StockSummary[]
  private readonly now: () => number

  constructor(opts: { master?: StockSummary[]; now?: () => number } = {}) {
    this.master = opts.master ?? STOCK_MASTER
    this.now = opts.now ?? (() => Date.now())
  }

  async search(query: string): Promise<StockSummary[]> {
    return searchStocks(this.master, query)
  }

  async getQuotes(codes: string[]): Promise<Quote[]> {
    const at = this.now()
    return codes
      .map((code) => this.master.find((s) => s.code === code))
      .filter((s): s is StockSummary => s !== undefined)
      .map((stock) => this.quoteFor(stock, at))
  }

  private quoteFor(stock: StockSummary, at: number): Quote {
    const seed = hash(stock.code)
    const high52w = 20_000 + (seed % 180) * 1_000

    // 정가의 55~95% 사이를 천천히 오간다
    const phase = Math.sin(seed + Math.floor(at / TICK_MS) / 40)
    const ratio = 0.75 + phase * 0.2
    const price = Math.round((high52w * ratio) / 10) * 10

    // 전일 종가는 현재가 대비 ±3% 안에서 흔들린다
    const prevPhase = Math.sin(seed * 1.7 + Math.floor(at / TICK_MS) / 40 - 1)
    const prevClose = Math.round((price * (1 + prevPhase * 0.03)) / 10) * 10

    return {
      code: stock.code,
      name: stock.name,
      price,
      prevClose,
      high52w,
      tradingHalted: false,
      asOf: new Date(at).toISOString(),
    }
  }
}
