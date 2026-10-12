'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CartItem, Currency } from '@/domain/types'

export const CART_STORAGE_KEY = 'stockshopping.cart.v1'

interface StoredItem {
  code: string
  qty: number
  addedPrice: number
  addedAt: string
  currency?: unknown
}

function isStoredItem(value: unknown): value is StoredItem {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.code === 'string' &&
    typeof v.qty === 'number' &&
    typeof v.addedPrice === 'number' &&
    typeof v.addedAt === 'string'
  )
}

/**
 * 통화가 없던 시절에 저장된 항목은 원화로 읽는다.
 * 그때는 국내 종목만 담을 수 있었으므로 이 추정은 틀릴 수 없다. 통화가 없다고
 * 버리면 사용자는 이유도 모른 채 장바구니가 비워진 것을 보게 된다.
 */
function toCartItem(stored: StoredItem): CartItem {
  const currency: Currency = stored.currency === 'USD' ? 'USD' : 'KRW'
  return {
    code: stored.code,
    qty: stored.qty,
    addedPrice: stored.addedPrice,
    addedAt: stored.addedAt,
    currency,
  }
}

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isStoredItem).map(toCartItem) : []
  } catch {
    return []
  }
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])
  const [ready, setReady] = useState(false)

  // 서버 렌더링에는 localStorage가 없으므로 마운트 후에 복원한다
  useEffect(() => {
    // SSR에는 localStorage가 없어 마운트 후 한 번만 읽는다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(load())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
    } catch {
      // 저장 실패(사생활 보호 모드 등)는 무시한다. 화면 동작은 유지된다
    }
  }, [items, ready])

  const add = useCallback((code: string, qty: number, price: number, currency: Currency) => {
    setItems((prev) => {
      const found = prev.find((i) => i.code === code)
      // 담은 가격은 처음 값을 유지한다. "담아둔 사이 변동"의 기준점이기 때문이다
      if (found) {
        return prev.map((i) => (i.code === code ? { ...i, qty: i.qty + qty } : i))
      }
      return [...prev, { code, qty, addedPrice: price, currency, addedAt: new Date().toISOString() }]
    })
  }, [])

  const setQty = useCallback((code: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.code !== code)
        : prev.map((i) => (i.code === code ? { ...i, qty } : i)),
    )
  }, [])

  const remove = useCallback((code: string) => {
    setItems((prev) => prev.filter((i) => i.code !== code))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  return { items, ready, add, setQty, remove, clear }
}
