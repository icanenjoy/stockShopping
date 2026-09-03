import { describe, it, expect, vi } from 'vitest'
import { QuoteCache } from '@/server/QuoteCache'
import type { Quote } from '@/domain/types'

function quote(code: string, price: number): Quote {
  return {
    code,
    name: `종목${code}`,
    price,
    prevClose: price,
    high52w: price * 2,
    tradingHalted: false,
    asOf: '2026-09-03T05:00:00.000Z',
  }
}

describe('QuoteCache', () => {
  it('처음 요청하면 loader를 부른다', async () => {
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => 0 })
    const loader = vi.fn(async (codes: string[]) => codes.map((c) => quote(c, 1000)))

    const result = await cache.get(['005930'], loader)

    expect(loader).toHaveBeenCalledWith(['005930'])
    expect(result.quotes).toHaveLength(1)
    expect(result.stale).toBe(false)
  })

  it('TTL 안에서는 loader를 다시 부르지 않는다', async () => {
    let t = 0
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => t })
    const loader = vi.fn(async (codes: string[]) => codes.map((c) => quote(c, 1000)))

    await cache.get(['005930'], loader)
    t = 4_999
    await cache.get(['005930'], loader)

    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('TTL이 지나면 loader를 다시 부른다', async () => {
    let t = 0
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => t })
    const loader = vi.fn(async (codes: string[]) => codes.map((c) => quote(c, 1000)))

    await cache.get(['005930'], loader)
    t = 5_001
    await cache.get(['005930'], loader)

    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('캐시에 있는 종목은 빼고 없는 종목만 loader에 넘긴다', async () => {
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => 0 })
    const loader = vi.fn(async (codes: string[]) => codes.map((c) => quote(c, 1000)))

    await cache.get(['005930'], loader)
    await cache.get(['005930', '000660'], loader)

    expect(loader).toHaveBeenLastCalledWith(['000660'])
  })

  it('동시에 같은 종목을 요청하면 loader는 한 번만 불린다', async () => {
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => 0 })
    const loader = vi.fn(async (codes: string[]) => {
      await new Promise((r) => setTimeout(r, 10))
      return codes.map((c) => quote(c, 1000))
    })

    const [a, b] = await Promise.all([
      cache.get(['005930'], loader),
      cache.get(['005930'], loader),
    ])

    expect(loader).toHaveBeenCalledTimes(1)
    expect(a.quotes[0].price).toBe(b.quotes[0].price)
  })

  it('loader가 실패하면 만료된 캐시라도 돌려주고 stale로 표시한다', async () => {
    let t = 0
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => t })
    await cache.get(['005930'], async (codes) => codes.map((c) => quote(c, 1000)))

    t = 10_000
    const result = await cache.get(['005930'], async () => {
      throw new Error('KIS 장애')
    })

    expect(result.quotes[0].price).toBe(1000)
    expect(result.stale).toBe(true)
  })

  it('loader가 실패하고 캐시도 없으면 에러를 던진다', async () => {
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => 0 })
    await expect(
      cache.get(['005930'], async () => {
        throw new Error('KIS 장애')
      }),
    ).rejects.toThrow('KIS 장애')
  })

  it('loader가 실패해도 다음 요청에서 다시 시도한다', async () => {
    let t = 0
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => t })
    await cache.get(['005930'], async (codes) => codes.map((c) => quote(c, 1000)))

    t = 10_000
    await cache.get(['005930'], async () => {
      throw new Error('일시 장애')
    })

    const loader = vi.fn(async (codes: string[]) => codes.map((c) => quote(c, 2000)))
    const result = await cache.get(['005930'], loader)

    expect(loader).toHaveBeenCalledTimes(1)
    expect(result.quotes[0].price).toBe(2000)
    expect(result.stale).toBe(false)
  })

  it('동시 요청 중 loader가 실패하고 만료된 캐시가 있으면 piggyback 호출도 stale로 캐시된 시세를 받는다', async () => {
    let t = 0
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => t })
    await cache.get(['005930'], async (codes) => codes.map((c) => quote(c, 1000)))

    t = 10_000
    const loader = async () => {
      await new Promise((r) => setTimeout(r, 10))
      throw new Error('KIS 장애')
    }

    const [a, b] = await Promise.all([cache.get(['005930'], loader), cache.get(['005930'], loader)])

    expect(a.stale).toBe(true)
    expect(a.quotes[0].price).toBe(1000)
    expect(b.stale).toBe(true)
    expect(b.quotes[0].price).toBe(1000)
  })

  it('캐시가 없는 상태에서 동시 요청 중 loader가 실패하면 첫 호출은 throw하고 piggyback 호출은 stale에 빈 quotes를 받는다', async () => {
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => 0 })
    const loader = async () => {
      await new Promise((r) => setTimeout(r, 10))
      throw new Error('KIS 장애')
    }

    const [first, second] = await Promise.allSettled([
      cache.get(['005930'], loader),
      cache.get(['005930'], loader),
    ])

    expect(first.status).toBe('rejected')
    expect(second.status).toBe('fulfilled')
    if (second.status === 'fulfilled') {
      expect(second.value.stale).toBe(true)
      expect(second.value.quotes).toHaveLength(0)
    }
  })
})
