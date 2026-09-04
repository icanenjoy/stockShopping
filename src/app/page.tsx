'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useStockSearch } from '@/hooks/useStockSearch'
import { useQuotes } from '@/hooks/useQuotes'
import { useCartContext } from '@/components/CartProvider'
import { StockCard } from '@/components/StockCard'

export default function HomePage() {
  const [query, setQuery] = useState('')
  const { stocks, loading } = useStockSearch(query)
  const codes = useMemo(() => stocks.map((s) => s.code), [stocks])
  const { quotes } = useQuotes(codes)
  const { items, add } = useCartContext()

  const cartCount = items.reduce((sum, item) => sum + item.qty, 0)

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="mb-3 text-2xl font-bold">오늘 뭐 담을까요?</h1>
        <input
          type="search"
          role="searchbox"
          aria-label="종목 검색"
          placeholder="삼성전자, 005930 …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-slate-900"
        />
      </section>

      {cartCount > 0 && (
        <Link
          href="/cart"
          className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white"
        >
          장바구니에 {cartCount}주 담겨 있습니다 · 결제 화면 보기
        </Link>
      )}

      {query.trim() === '' ? (
        <p className="py-16 text-center text-slate-400">종목명이나 코드를 검색해보세요</p>
      ) : loading && stocks.length === 0 ? (
        <p className="py-16 text-center text-slate-400">찾는 중…</p>
      ) : stocks.length === 0 ? (
        <p className="py-16 text-center text-slate-400">일치하는 종목이 없습니다</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stocks.map((stock) => {
            const quote = quotes[stock.code]
            return (
              <li key={stock.code}>
                {quote ? (
                  <StockCard quote={quote} onAdd={add} />
                ) : (
                  <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
