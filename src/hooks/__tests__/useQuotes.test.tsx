import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useQuotes } from '@/hooks/useQuotes'

function quotesResponse(price: number, stale = false) {
  return new Response(
    JSON.stringify({
      quotes: [
        {
          code: '005930',
          name: '삼성전자',
          price,
          prevClose: 62600,
          high52w: 85000,
          tradingHalted: false,
          asOf: '2026-09-03T05:00:00.000Z',
        },
      ],
      stale,
    }),
    { status: 200 },
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useQuotes', () => {
  it('코드 목록으로 시세를 가져온다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => quotesResponse(61200)))
    const { result } = renderHook(() => useQuotes(['005930']))

    await waitFor(() => expect(result.current.quotes['005930']?.price).toBe(61200))
    expect(result.current.loading).toBe(false)
  })

  it('요청 URL에 코드를 콤마로 이어 붙인다', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => quotesResponse(61200))
    vi.stubGlobal('fetch', fetchMock)
    renderHook(() => useQuotes(['005930', '000660']))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/quotes?codes=005930%2C000660')
  })

  it('코드가 없으면 요청하지 않는다', async () => {
    const fetchMock = vi.fn(async () => quotesResponse(61200))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useQuotes([]))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.quotes).toEqual({})
  })

  it('응답의 stale 플래그를 그대로 노출한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => quotesResponse(61200, true)))
    const { result } = renderHook(() => useQuotes(['005930']))

    await waitFor(() => expect(result.current.stale).toBe(true))
  })

  it('요청이 실패하면 stale로 표시하고 직전 시세를 유지한다', async () => {
    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1
        if (call === 1) return quotesResponse(61200)
        throw new Error('offline')
      }),
    )

    const { result, rerender } = renderHook(({ codes }) => useQuotes(codes), {
      initialProps: { codes: ['005930'] },
    })
    await waitFor(() => expect(result.current.quotes['005930']?.price).toBe(61200))

    rerender({ codes: ['005930', '005930'] })
    await waitFor(() => expect(result.current.stale).toBe(true))
    expect(result.current.quotes['005930']?.price).toBe(61200)
  })

  it('pollMs를 주면 주기적으로 다시 조회한다', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => quotesResponse(61200))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useQuotes(['005930'], { pollMs: 5_000 }))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('pollMs가 없으면 반복 조회하지 않는다', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => quotesResponse(61200))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useQuotes(['005930']))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
