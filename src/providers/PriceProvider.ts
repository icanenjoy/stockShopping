import type { StockSummary, Quote } from '@/domain/types'

export interface PriceProvider {
  /** 종목명 또는 코드로 검색한다 */
  search(query: string): Promise<StockSummary[]>
  /** 종목코드 목록의 현재 시세를 조회한다. 못 찾은 코드는 결과에서 빠진다 */
  getQuotes(codes: string[]): Promise<Quote[]>
}
