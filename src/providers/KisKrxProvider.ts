import type { PriceProvider } from './PriceProvider'
import type { KisTokenManager } from './KisTokenManager'
import type { StockSummary, Quote } from '@/domain/types'
import { searchStocks } from '@/domain/search'
import { STOCK_MASTER } from '@/data/stocks'

const PRICE_PATH = '/uapi/domestic-stock/v1/quotations/inquire-price'
const TR_ID_PRICE = 'FHKST01010100'

interface KisPriceBody {
  rt_cd?: string
  output?: Record<string, string | undefined>
}

export class KisKrxProvider implements PriceProvider {
  private readonly tokenManager: KisTokenManager
  private readonly appKey: string
  private readonly appSecret: string
  private readonly baseUrl: string
  private readonly master: StockSummary[]
  private readonly fetchFn: typeof fetch

  constructor(opts: {
    tokenManager: KisTokenManager
    appKey: string
    appSecret: string
    baseUrl: string
    master?: StockSummary[]
    fetchFn?: typeof fetch
  }) {
    this.tokenManager = opts.tokenManager
    this.appKey = opts.appKey
    this.appSecret = opts.appSecret
    this.baseUrl = opts.baseUrl.replace(/\/$/, '')
    this.master = opts.master ?? STOCK_MASTER
    this.fetchFn = opts.fetchFn ?? fetch
  }

  async search(query: string): Promise<StockSummary[]> {
    return searchStocks(this.master, query)
  }

  /** 한 종목이 실패해도 나머지는 살린다. 총액을 최대한 보여주는 쪽이 낫다 */
  async getQuotes(codes: string[]): Promise<Quote[]> {
    const stocks = codes
      .map((code) => this.master.find((s) => s.code === code))
      .filter((s): s is StockSummary => s !== undefined)

    const settled = await Promise.allSettled(stocks.map((s) => this.fetchQuote(s)))

    return settled
      .map((r) => (r.status === 'fulfilled' ? r.value : undefined))
      .filter((q): q is Quote => q !== undefined)
  }

  private async fetchQuote(stock: StockSummary): Promise<Quote | undefined> {
    const token = await this.tokenManager.getToken()
    const url =
      `${this.baseUrl}${PRICE_PATH}` +
      `?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${stock.code}`

    const response = await this.fetchFn(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        appkey: this.appKey,
        appsecret: this.appSecret,
        tr_id: TR_ID_PRICE,
      },
    })

    if (!response.ok) {
      throw new Error(`KIS 시세 조회 실패: ${stock.code} ${response.status}`)
    }

    const body = (await response.json()) as KisPriceBody
    if (body.rt_cd !== '0' || !body.output) return undefined

    return this.toQuote(stock, body.output)
  }

  private toQuote(stock: StockSummary, output: Record<string, string | undefined>): Quote {
    const num = (raw: string | undefined): number => {
      const value = Number(raw)
      return Number.isFinite(value) ? value : 0
    }

    return {
      code: stock.code,
      name: stock.name,
      price: num(output.stck_prpr),
      prevClose: num(output.stck_sdpr),
      high52w: num(output.w52_hgpr),
      tradingHalted: output.temp_stop_yn === 'Y',
      asOf: new Date().toISOString(),
    }
  }
}
