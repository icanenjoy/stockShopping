import type { KisTokenManager } from './KisTokenManager'
import type { StockSummary, Quote, Market } from '@/domain/types'

/**
 * 현재가만 주는 /quotations/price가 아니라 price-detail을 쓴다.
 * price 응답에는 52주 최고가가 없어 "정가 → 할인율"을 계산할 수 없다.
 */
const DETAIL_PATH = '/uapi/overseas-price/v1/quotations/price-detail'
const TR_ID_DETAIL = 'HHDFS76200200'

/** KIS가 쓰는 거래소 코드. 티커만으로는 어느 거래소인지 특정할 수 없다 */
const EXCHANGE_CODE: Partial<Record<Market, string>> = {
  NAS: 'NAS',
  NYS: 'NYS',
  AMS: 'AMS',
}

interface KisDetailBody {
  rt_cd?: string
  output?: Record<string, string | undefined>
}

export class KisOverseasProvider {
  private readonly tokenManager: KisTokenManager
  private readonly appKey: string
  private readonly appSecret: string
  private readonly baseUrl: string
  private readonly fetchFn: typeof fetch

  constructor(opts: {
    tokenManager: KisTokenManager
    appKey: string
    appSecret: string
    baseUrl: string
    fetchFn?: typeof fetch
  }) {
    this.tokenManager = opts.tokenManager
    this.appKey = opts.appKey
    this.appSecret = opts.appSecret
    this.baseUrl = opts.baseUrl.replace(/\/$/, '')
    this.fetchFn = opts.fetchFn ?? fetch
  }

  /** 한 종목이 실패해도 나머지는 살린다. 총액을 최대한 보여주는 쪽이 낫다 */
  async getQuotes(stocks: StockSummary[]): Promise<Quote[]> {
    const settled = await Promise.allSettled(stocks.map((s) => this.fetchQuote(s)))

    for (const result of settled) {
      if (result.status === 'rejected') console.error('[kis:해외] 시세 조회 실패', result.reason)
    }

    return settled
      .map((r) => (r.status === 'fulfilled' ? r.value : undefined))
      .filter((q): q is Quote => q !== undefined)
  }

  private async fetchQuote(stock: StockSummary): Promise<Quote | undefined> {
    const excd = EXCHANGE_CODE[stock.market]
    if (!excd) return undefined

    const token = await this.tokenManager.getToken()
    const url = `${this.baseUrl}${DETAIL_PATH}?AUTH=&EXCD=${excd}&SYMB=${encodeURIComponent(stock.code)}`

    const response = await this.fetchFn(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        appkey: this.appKey,
        appsecret: this.appSecret,
        tr_id: TR_ID_DETAIL,
      },
    })

    if (!response.ok) {
      throw new Error(`KIS 해외 시세 조회 실패: ${stock.code} ${response.status}`)
    }

    const body = (await response.json()) as KisDetailBody
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
      price: num(output.last),
      prevClose: num(output.base),
      high52w: num(output.h52p),
      // 문구가 명시적으로 "불가"라고 말할 때만 막는다. 모르는 문구를 정지로 읽으면
      // 멀쩡한 종목이 총액에서 조용히 사라진다.
      tradingHalted: (output.e_ordyn ?? '').includes('불가'),
      currency: 'USD',
      asOf: new Date().toISOString(),
    }
  }
}
