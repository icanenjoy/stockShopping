import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useStockSearch } from '@/hooks/useStockSearch'

function searchResponse() {
  return new Response(
    JSON.stringify({ stocks: [{ code: '005930', name: '삼성전자', market: 'KOSPI' }] }),
    { status: 200 },
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useStockSearch', () => {
  it('빈 질의는 요청하지 않는다', async () => {
    const fetchMock = vi.fn(async () => searchResponse())
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useStockSearch(''))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.stocks).toEqual([])
  })

  it('디바운스 시간이 지난 뒤에만 요청한다', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => searchResponse())
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useStockSearch('삼성', { debounceMs: 250 }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(fetchMock).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('질의를 URL로 인코딩해 보낸다', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => searchResponse())
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useStockSearch('삼성', { debounceMs: 0 }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(String(fetchMock.mock.calls[0][0])).toBe(`/api/search?q=${encodeURIComponent('삼성')}`)
  })

  it('결과를 반환한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => searchResponse()))

    const { result } = renderHook(() => useStockSearch('삼성', { debounceMs: 0 }))

    await waitFor(() => expect(result.current.stocks).toHaveLength(1))
    expect(result.current.stocks[0].name).toBe('삼성전자')
  })

  it('요청이 실패하면 빈 결과로 두되 실패했다는 사실을 알린다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))

    const { result } = renderHook(() => useStockSearch('삼성', { debounceMs: 0 }))

    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.loading).toBe(false)
    expect(result.current.stocks).toEqual([])
  })

  it('성공한 조회에는 실패 표시가 남지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => searchResponse()))

    const { result } = renderHook(() => useStockSearch('삼성', { debounceMs: 0 }))

    await waitFor(() => expect(result.current.stocks).toHaveLength(1))
    expect(result.current.error).toBe(false)
  })
})
