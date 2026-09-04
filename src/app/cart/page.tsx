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
  const { items, ready, setQty, remove, clear } = useCartContext()
  const codes = useMemo(() => items.map((i) => i.code), [items])

  const marketOpen = isMarketOpen(new Date())
  const { quotes, stale, settled } = useQuotes(codes, marketOpen ? { pollMs: POLL_MS } : {})

  const total = cartTotal(items, quotes)
  // 총액은 시세가 있는 항목만으로 계산된다. 몇 개가 빠졌는지는 총액과 같은 크기의
  // 사실이므로 화면에도 같이 실어야 한다.
  const pricedCount = items.filter((item) => quotes[item.code]).length
  const unpricedCount = items.length - pricedCount
  const noPrices = pricedCount === 0
  // 총액에 실제로 더해진 종목 수. 거래정지는 시세가 있어도 금액을 매기지 않는다.
  const countedCount = items.filter((item) => {
    const quote = quotes[item.code]
    return quote !== undefined && !quote.tradingHalted
  }).length

  // localStorage 복원은 마운트 뒤에 일어난다. 그 전에 그리면 담아둔 장바구니를
  // 열 때마다 "비어 있습니다"가 한 프레임 번쩍인다.
  if (!ready) return null

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

      {settled && noPrices ? (
        <p role="status" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          ⚠️ 시세를 가져오지 못했습니다 — 총액을 계산할 수 없습니다
        </p>
      ) : stale ? (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          ⚠️ 시세 지연 — 마지막으로 받은 가격으로 계산했습니다
        </p>
      ) : null}

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
                  {quote ? formatWon(quote.price) : settled ? '시세 없음' : '시세 조회 중…'}
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
                {!quote && settled && (
                  <p className="text-xs font-semibold text-amber-600">
                    시세를 가져오지 못했습니다 — 총액에서 제외했습니다
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

      <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-900 px-5 py-4 text-white">
        <div>
          <span className="text-sm">현재가 기준 총액</span>
          {settled && countedCount > 0 && unpricedCount > 0 && (
            <p data-testid="cart-unpriced" className="text-xs text-amber-300">
              {unpricedCount}개 종목 시세 없음 · 총액에서 제외했습니다
            </p>
          )}
        </div>
        {countedCount > 0 ? (
          <strong data-testid="cart-total" className="text-2xl font-bold tabular-nums">
            {formatWon(total)}
          </strong>
        ) : (
          // 더한 종목이 하나도 없을 때 "0원"을 보여주는 것은 아무것도 안 보여주는 것보다
          // 나쁘다. 빈 장바구니의 총액과 구분이 되지 않기 때문이다.
          <span data-testid="cart-total" className="text-right text-lg font-semibold">
            {!settled
              ? '시세를 가져오는 중…'
              : noPrices
                ? '시세 없음'
                : '거래정지 — 계산할 수 있는 종목이 없습니다'}
          </span>
        )}
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
