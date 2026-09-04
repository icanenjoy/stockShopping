'use client'

import Link from 'next/link'
import { useCartContext } from './CartProvider'

export function SiteHeader() {
  const { items } = useCartContext()
  const count = items.reduce((sum, item) => sum + item.qty, 0)

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          주식 쇼핑
        </Link>
        <Link
          href="/cart"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700"
        >
          🛒 장바구니
          {count > 0 && (
            <span className="ml-1.5 rounded-full bg-rose-600 px-1.5 text-xs text-white">
              {count}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
