'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useCart } from '@/hooks/useCart'

type CartApi = ReturnType<typeof useCart>

const CartContext = createContext<CartApi | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const cart = useCart()
  return <CartContext.Provider value={cart}>{children}</CartContext.Provider>
}

export function useCartContext(): CartApi {
  const cart = useContext(CartContext)
  if (!cart) throw new Error('useCartContext는 CartProvider 안에서만 쓸 수 있습니다')
  return cart
}
