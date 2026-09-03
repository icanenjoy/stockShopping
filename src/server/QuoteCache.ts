import type { Quote } from '@/domain/types'

interface Entry {
  quote: Quote
  storedAt: number
}

export interface QuoteResult {
  quotes: Quote[]
  /** 시세 조회에 실패해 만료된 캐시로 응답했음을 뜻한다 */
  stale: boolean
}

/**
 * 종목별 TTL 캐시.
 * - 같은 종목을 동시에 요청하면 loader 호출을 하나로 수렴시킨다.
 * - loader가 실패하면 만료된 캐시라도 돌려준다. 총액이 화면에서 사라지는 것이 최악이다.
 */
export class QuoteCache {
  private readonly entries = new Map<string, Entry>()
  private readonly inflight = new Map<string, Promise<void>>()
  private readonly ttlMs: number
  private readonly now: () => number

  constructor(opts: { ttlMs: number; now?: () => number }) {
    this.ttlMs = opts.ttlMs
    this.now = opts.now ?? (() => Date.now())
  }

  async get(
    codes: string[],
    loader: (missing: string[]) => Promise<Quote[]>,
  ): Promise<QuoteResult> {
    const at = this.now()
    const pending: string[] = []
    const missing: string[] = []

    for (const code of codes) {
      const entry = this.entries.get(code)
      if (entry && at - entry.storedAt < this.ttlMs) continue
      else if (this.inflight.has(code)) pending.push(code)
      else missing.push(code)
    }

    if (missing.length > 0) {
      // 조회와 저장을 하나의 프라미스로 묶는다. 동시 요청이 이 프라미스를 기다리면
      // 캐시에 값이 들어간 뒤에 깨어난다. 둘을 분리하면 나중 요청이 빈 캐시를 읽는다.
      const request = (async () => {
        const quotes = await loader(missing)
        const storedAt = this.now()
        for (const quote of quotes) {
          this.entries.set(quote.code, { quote, storedAt })
        }
      })()

      for (const code of missing) this.inflight.set(code, request)

      try {
        await request
      } catch (error) {
        const anyCached = missing.some((code) => this.entries.has(code))
        if (!anyCached) throw error
      } finally {
        for (const code of missing) this.inflight.delete(code)
      }
    }

    if (pending.length > 0) {
      await Promise.allSettled(pending.map((code) => this.inflight.get(code)))
    }

    // stale 여부는 대기(await)가 모두 끝난 뒤 entries를 다시 훑어 판정한다.
    // missing 분기 안에서만 stale를 세우면 piggyback 호출(pending)은 자신이
    // 실패/성공 어느 쪽에 편승했는지 알 방법이 없어 항상 stale: false로 응답하게 된다.
    const settledAt = this.now()
    let stale = false
    const quotes: Quote[] = []
    for (const code of codes) {
      const entry = this.entries.get(code)
      if (!entry) {
        stale = true
        continue
      }
      if (settledAt - entry.storedAt >= this.ttlMs) stale = true
      quotes.push(entry.quote)
    }

    return { quotes, stale }
  }
}
