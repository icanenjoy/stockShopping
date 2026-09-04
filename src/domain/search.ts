import type { StockSummary } from './types'

const DEFAULT_LIMIT = 20

/**
 * 순위. 낮을수록 먼저 나온다.
 *
 * 마스터가 9천 종목을 넘으면서 단순 부분 일치로는 원하는 종목이 묻힌다.
 * "KO"를 치면 코카콜라가 나와야지, 이름에 ko가 들어간 다른 종목이 먼저 나오면 안 된다.
 */
const EXACT_CODE = 0
const EXACT_NAME = 1
const PREFIX = 2
const PARTIAL = 3

function rank(stock: StockSummary, q: string): number | undefined {
  const code = stock.code.toLowerCase()
  const name = stock.name.toLowerCase()
  const english = stock.englishName?.toLowerCase() ?? ''

  if (code === q) return EXACT_CODE
  if (name === q || english === q) return EXACT_NAME
  if (code.startsWith(q) || name.startsWith(q) || english.startsWith(q)) return PREFIX
  if (code.includes(q) || name.includes(q) || english.includes(q)) return PARTIAL
  return undefined
}

/**
 * 종목 마스터에서 코드·한글명·영문명으로 검색한다.
 *
 * 해외 종목은 KIS 마스터가 한글명을 함께 주므로 "애플"로도 "apple"로도 찾힌다.
 * 같은 순위 안에서는 마스터 순서를 지킨다 — 같은 질의에 매번 같은 결과가 나와야 한다.
 */
export function searchStocks(
  all: StockSummary[],
  query: string,
  limit: number = DEFAULT_LIMIT,
): StockSummary[] {
  const q = query.trim().toLowerCase()
  if (q === '') return []

  const scored: { stock: StockSummary; rank: number; order: number }[] = []
  for (let i = 0; i < all.length; i++) {
    const r = rank(all[i], q)
    if (r !== undefined) scored.push({ stock: all[i], rank: r, order: i })
  }

  scored.sort((a, b) => a.rank - b.rank || a.order - b.order)
  return scored.slice(0, limit).map((s) => s.stock)
}
