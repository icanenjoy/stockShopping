export interface StockSummary {
  code: string
  name: string
  market: 'KOSPI' | 'KOSDAQ'
}

export interface Quote {
  code: string
  name: string
  /** 현재가 (원) */
  price: number
  /** 전일 종가 (원) */
  prevClose: number
  /** 52주 최고가 (원). 쇼핑몰의 "정가" 역할 */
  high52w: number
  tradingHalted: boolean
  /** 시세 기준 시각 (ISO 8601) */
  asOf: string
}

export interface CartItem {
  code: string
  qty: number
  /** 장바구니에 담던 시점의 현재가 (원) */
  addedPrice: number
  addedAt: string
}
