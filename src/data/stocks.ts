import type { StockSummary } from '@/domain/types'
import generated from './stocks.generated.json'

/**
 * 국내·해외 종목 마스터. `npm run build:master`가 KIS 배포 파일에서 생성한다.
 *
 * 서버에서만 읽는다 — 1MB에 가까운 데이터를 브라우저로 내려보낼 이유가 없다.
 * 검색은 /api/search가 대신 수행한다.
 */
export const STOCK_MASTER: StockSummary[] = generated.stocks as StockSummary[]

/** 마스터를 생성한 시각. 상장·폐지가 얼마나 오래된 기준인지 말해준다 */
export const MASTER_GENERATED_AT: string = generated.generatedAt

const BY_CODE = new Map(STOCK_MASTER.map((stock) => [stock.code, stock]))

export function findStock(code: string): StockSummary | undefined {
  return BY_CODE.get(code)
}
