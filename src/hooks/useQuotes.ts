'use client'

import { useEffect, useState } from 'react'
import type { Quote } from '@/domain/types'

interface QuotesResponse {
  quotes: Quote[]
  stale: boolean
}

/**
 * 종목 시세를 가져오고, pollMs가 주어지면 주기적으로 갱신한다.
 * 조회에 실패해도 직전 시세를 지우지 않는다. 총액이 사라지는 것이 최악이다.
 */
export function useQuotes(codes: string[], opts: { pollMs?: number } = {}) {
  const { pollMs } = opts
  const key = codes.join(',')

  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [stale, setStale] = useState(false)
  const [loading, setLoading] = useState(false)
  /**
   * 현재 코드 목록으로 조회를 한 번이라도 끝냈는지(성공·실패 무관).
   * 화면이 "아직 안 왔다"와 "받아봤는데 이 종목 시세가 없다"를 구분하려면 필요하다.
   */
  const [settled, setSettled] = useState(false)

  // 렌더 도중 상태를 조정한다(React 공식 패턴): key가 빈 문자열로 바뀐
  // 순간에만 이전 시세를 지운다. 이펙트에서 동기적으로 setState하지 않도록
  // 하기 위함이며, 빈 목록이 아닌 다른 목록으로 바뀔 때는 지우지 않는다.
  const [prevKey, setPrevKey] = useState(key)
  if (key !== prevKey) {
    setPrevKey(key)
    // 목록이 바뀌면 아직 이 목록으로는 아무것도 확인하지 못한 상태다.
    // 시세는 지우지 않는다 — 총액이 사라지는 것이 최악이다.
    setSettled(false)
    if (key === '') {
      setQuotes({})
      setStale(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (key === '') return

    let cancelled = false

    const run = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/quotes?codes=${encodeURIComponent(key)}`)
        if (!res.ok) throw new Error(`시세 조회 실패: ${res.status}`)
        const body = (await res.json()) as QuotesResponse
        if (cancelled) return

        setQuotes((prev) => {
          const next = { ...prev }
          for (const quote of body.quotes) next[quote.code] = quote
          return next
        })
        setStale(body.stale)
      } catch {
        if (!cancelled) setStale(true)
      } finally {
        if (!cancelled) {
          setLoading(false)
          setSettled(true)
        }
      }
    }

    void run()

    if (!pollMs) return () => {
      cancelled = true
    }

    const timer = setInterval(() => void run(), pollMs)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [key, pollMs])

  return { quotes, stale, loading, settled }
}
