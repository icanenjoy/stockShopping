/** 종목이 거래되는 시장. 시세 조회 경로와 장 운영시간을 함께 결정한다 */
export type Market = 'KOSPI' | 'KOSDAQ' | 'NAS' | 'NYS' | 'AMS'

/**
 * 통화. 장바구니는 통화별로 완전히 분리된다 — 환율로 환산해 하나로 합치면
 * "지금 얼마인가"의 답이 환율 시점에 묶여 버린다.
 */
export type Currency = 'KRW' | 'USD'

export interface StockSummary {
  /** 국내는 종목코드(005930), 해외는 티커(AAPL) */
  code: string
  /** 한글 종목명. KIS 마스터가 해외 종목에도 한글명을 준다 */
  name: string
  /** 해외 종목의 영문명. 국내에는 없다 */
  englishName?: string
  market: Market
  currency: Currency
}

export interface Quote {
  code: string
  name: string
  /** 현재가 (currency 단위) */
  price: number
  /** 전일 종가 (currency 단위) */
  prevClose: number
  /** 52주 최고가 (currency 단위). 쇼핑몰의 "정가" 역할 */
  high52w: number
  tradingHalted: boolean
  currency: Currency
  /** 시세 기준 시각 (ISO 8601) */
  asOf: string
}

export interface CartItem {
  code: string
  qty: number
  /** 장바구니에 담던 시점의 현재가 (currency 단위) */
  addedPrice: number
  /**
   * 담을 때 확정한 통화. 시세를 못 가져와도 어느 탭에 속하는지 알아야 하므로
   * Quote가 아니라 항목 자체가 들고 있는다.
   */
  currency: Currency
  addedAt: string
}
