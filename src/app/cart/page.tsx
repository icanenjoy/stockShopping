'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useCartContext } from '@/components/CartProvider'
import { useQuotes } from '@/hooks/useQuotes'
import { QtyStepper } from '@/components/QtyStepper'
import { cartTotal, lineSubtotal, changeSinceAdded } from '@/domain/pricing'
import { isMarketOpen } from '@/domain/market'
import { formatWon, formatSignedPercent } from '@/domain/format'

const POLL_MS = 7_000

export default function CartPage() {
  const { items, setQty, remove, clear } = useCartContext()
  const codes = useMemo(() => items.map((i) => i.code), [items])

  const marketOpen = isMarketOpen(new Date())
  const { quotes, stale } = useQuotes(codes, marketOpen ? { pollMs: POLL_MS } : {})

  const total = cartTotal(items, quotes)

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4 text-slate-400">장바구니가 비어 있습니다</p>
        <Link href="/" className="font-semibold text-slate-900 underline">
          종목 담으러 가기
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">장바구니</h1>
        <span className="text-xs text-slate-400">
          {marketOpen ? `장중 · ${POLL_MS / 1000}초마다 갱신` : '폐장 · 종가 기준'}
        </span>
      </div>

      {stale && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          ⚠️ 시세 지연 — 마지막으로 받은 가격으로 계산했습니다
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const quote = quotes[item.code]
          const since = quote ? changeSinceAdded(quote.price, item.addedPrice) : 0

          return (
            <li
              key={item.code}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="min-w-32 flex-1">
                <p className="font-semibold">{quote?.name ?? item.code}</p>
                <p className="text-xs text-slate-400">
                  {quote ? formatWon(quote.price) : '시세 조회 중…'}
                  {quote && (
                    <span className={since < 0 ? ' text-rose-600' : ' text-slate-500'}>
                      {' '}
                      · 담은 뒤 {formatSignedPercent(since)}
                    </span>
                  )}
                </p>
                {quote?.tradingHalted && (
                  <p className="text-xs font-semibold text-amber-600">
                    거래정지 — 총액에서 제외했습니다
                  </p>
                )}
              </div>

              <QtyStepper
                value={item.qty}
                onChange={(next) => setQty(item.code, next)}
                label={quote?.name ?? item.code}
              />

              <span
                data-testid={`subtotal-${item.code}`}
                className="w-28 text-right font-semibold tabular-nums"
              >
                {quote ? formatWon(lineSubtotal(quote, item.qty)) : '—'}
              </span>

              <button
                type="button"
                aria-label={`${quote?.name ?? item.code} 빼기`}
                onClick={() => remove(item.code)}
                className="text-sm text-slate-400 hover:text-slate-900"
              >
                ✕
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex items-center justify-between rounded-xl bg-slate-900 px-5 py-4 text-white">
        <span className="text-sm">현재가 기준 총액</span>
        <strong data-testid="cart-total" className="text-2xl font-bold tabular-nums">
          {formatWon(total)}
        </strong>
      </div>

      <div className="flex justify-between">
        <Link href="/" className="text-sm font-semibold text-slate-600 underline">
          계속 담기
        </Link>
        <button type="button" onClick={clear} className="text-sm text-slate-400">
          장바구니 비우기
        </button>
      </div>
    </div>
  )
}
