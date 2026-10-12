import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCart, CART_STORAGE_KEY } from '@/hooks/useCart'

beforeEach(() => {
  localStorage.clear()
})

describe('useCart', () => {
  it('처음에는 비어 있다', () => {
    const { result } = renderHook(() => useCart())
    expect(result.current.items).toEqual([])
    expect(result.current.ready).toBe(true)
  })

  it('종목을 담는다', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('005930', 2, 61200, 'KRW'))

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0]).toMatchObject({ code: '005930', qty: 2, addedPrice: 61200 })
    expect(result.current.items[0].addedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('이미 담은 종목은 수량만 더하고 담은 가격은 유지한다', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('005930', 2, 61200, 'KRW'))
    act(() => result.current.add('005930', 3, 63000, 'KRW'))

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].qty).toBe(5)
    expect(result.current.items[0].addedPrice).toBe(61200)
  })

  it('수량을 바꾼다', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('005930', 2, 61200, 'KRW'))
    act(() => result.current.setQty('005930', 7))

    expect(result.current.items[0].qty).toBe(7)
  })

  it('수량을 0 이하로 만들면 장바구니에서 뺀다', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('005930', 2, 61200, 'KRW'))
    act(() => result.current.setQty('005930', 0))

    expect(result.current.items).toEqual([])
  })

  it('종목을 뺀다', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('005930', 2, 61200, 'KRW'))
    act(() => result.current.add('000660', 1, 205000, 'KRW'))
    act(() => result.current.remove('005930'))

    expect(result.current.items.map((i) => i.code)).toEqual(['000660'])
  })

  it('전체를 비운다', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('005930', 2, 61200, 'KRW'))
    act(() => result.current.clear())

    expect(result.current.items).toEqual([])
  })

  it('localStorage에 저장한다', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('005930', 2, 61200, 'KRW'))

    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '[]')
    expect(saved[0]).toMatchObject({ code: '005930', qty: 2 })
  })

  it('저장된 장바구니를 복원한다', () => {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([
        { code: '005930', qty: 4, addedPrice: 61200, addedAt: '2026-09-03T04:00:00.000Z' },
      ]),
    )

    const { result } = renderHook(() => useCart())
    expect(result.current.items[0].qty).toBe(4)
  })

  it('저장된 값이 깨져 있으면 빈 장바구니로 시작한다', () => {
    localStorage.setItem(CART_STORAGE_KEY, '{{{ 깨진 JSON')

    const { result } = renderHook(() => useCart())
    expect(result.current.items).toEqual([])
  })
})
