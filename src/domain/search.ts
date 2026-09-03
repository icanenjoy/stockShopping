import type { StockSummary } from './types'

const DEFAULT_LIMIT = 20

/**
 * 종목 마스터에서 코드 또는 종목명으로 검색한다.
 * 전방 일치를 부분 일치보다 앞에 놓아 "삼성" → "삼성전자"가 먼저 나오게 한다.
 */
export function searchStocks(
  all: StockSummary[],
  query: string,
  limit: number = DEFAULT_LIMIT,
): StockSummary[] {
  const q = query.trim().toLowerCase()
  if (q === '') return []

  const prefix: StockSummary[] = []
  const partial: StockSummary[] = []

  for (const stock of all) {
    const name = stock.name.toLowerCase()
    if (name.startsWith(q) || stock.code.startsWith(q)) {
      prefix.push(stock)
    } else if (name.includes(q) || stock.code.includes(q)) {
      partial.push(stock)
    }
  }

  return [...prefix, ...partial].slice(0, limit)
}
