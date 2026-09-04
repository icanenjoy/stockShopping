'use client'

import { useEffect, useState } from 'react'
import type { StockSummary } from '@/domain/types'

const DEFAULT_DEBOUNCE_MS = 250

export function useStockSearch(query: string, opts: { debounceMs?: number } = {}) {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const trimmed = query.trim()
  const [stocks, setStocks] = useState<StockSummary[]>([])
  const [loading, setLoading] = useState(false)
  /** 마지막 조회가 실패했는지. "결과 없음"과 "못 물어봤음"은 다른 이야기다 */
  const [error, setError] = useState(false)

  // 렌더 도중 상태를 조정한다(React 공식 패턴): trimmed가 빈 문자열로 바뀐
  // 순간에만 이전 결과를 지운다. 이펙트에서 동기적으로 setState하지 않도록
  // 하기 위함이다.
  const [prevTrimmed, setPrevTrimmed] = useState(trimmed)
  if (trimmed !== prevTrimmed) {
    setPrevTrimmed(trimmed)
    if (trimmed === '') {
      setStocks([])
      setLoading(false)
      setError(false)
    }
  }

  useEffect(() => {
    if (trimmed === '') return

    let cancelled = false

    // setLoading(true)를 이펙트 본문에 직접 두지 않기 위해 중첩 함수로 감싼다.
    const markLoading = () => setLoading(true)
    markLoading()

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        if (!res.ok) throw new Error(`검색 실패: ${res.status}`)
        const body = (await res.json()) as { stocks: StockSummary[] }
        if (!cancelled) {
          setStocks(body.stocks)
          setError(false)
        }
      } catch {
        // 결과를 비우되 실패했다는 사실을 함께 싣는다. 이걸 잃어버리면 화면이
        // "일치하는 종목이 없습니다"라고 확신에 차서 거짓말을 한다.
        if (!cancelled) {
          setStocks([])
          setError(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, debounceMs)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed, debounceMs])

  return { stocks, loading, error }
}
