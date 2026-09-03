'use client'

import { useEffect, useRef, useState } from 'react'
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
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    if (key === '') {
      setQuotes({})
      setStale(false)
      setLoading(false)
      return
    }

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
        if (!cancelled) setLoading(false)
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

  return { quotes, stale, loading }
}
