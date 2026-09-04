'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useCartContext } from '@/components/CartProvider'
import { useQuotes } from '@/hooks/useQuotes'
import { QtyStepper } from '@/components/QtyStepper'
import { groupCartByCurrency, lineSubtotal, changeSinceAdded } from '@/domain/pricing'
import { isAnyMarketOpen } from '@/domain/market'
import { formatMoney, formatSignedPercent } from '@/domain/format'
import type { Currency, Market } from '@/domain/types'

const POLL_MS = 7_000

/** 통화별 라벨과, 그 통화가 열려 있는지 판단할 시장들 */
const TABS: Record<Currency, { label: string; markets: Market[] }> = {
  KRW: { label: '₩ 원화', markets: ['KOSPI', 'KOSDAQ'] },
  USD: { label: '$ 미국달러', markets: ['NAS', 'NYS', 'AMS'] },
}

export default function CartPage() {
  const { items, ready, setQty, remove, clear } = useCartContext()
  const codes = useMemo(() => items.map((i) => i.code), [items])

  // 어느 쪽 시장이든 열려 있으면 갱신한다. 탭을 바꿀 때마다 폴링을 껐다 켜면
  // 보이지 않는 탭의 총액이 조용히 낡는다.
  const anyOpen = isAnyMarketOpen(new Date(), ['KOSPI', 'KOSDAQ', 'NAS', 'NYS', 'AMS'])
  const { quotes, stale, settled } = useQuotes(codes, anyOpen ? { pollMs: POLL_MS } : {})

  const groups = groupCartByCurrency(items, quotes)
  const [selected, setSelected] = useState<Currency | null>(null)
  // 담긴 통화가 바뀌면 선택이 사라질 수 있다. 그때는 첫 탭으로 돌아간다.
  const active = groups.find((g) => g.currency === selected) ?? groups[0]

  // localStorage 복원은 마운트 뒤에 일어난다. 그 전에 그리면 담아둔 장바구니를
  // 열 때마다 "비어 있습니다"가 한 프레임 번쩍인다.
  if (!ready) return null

  if (items.length === 0 || !active) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4 text-slate-400">장바구니가 비어 있습니다</p>
        <Link href="/" className="font-semibold text-slate-900 underline">
          종목 담으러 가기
        </Link>
      </div>
    )
  }

  const { currency, total, countedCount, unpricedCount } = active
  const noPrices = active.items.length - unpricedCount === 0
  const marketOpen = isAnyMarketOpen(new Date(), TABS[currency].markets)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">장바구니</h1>
        <span className="text-xs text-slate-400">
          {marketOpen ? `장중 · ${POLL_MS / 1000}초마다 갱신` : '폐장 · 종가 기준'}
        </span>
      </div>

      {/* 통화가 둘 이상일 때만 탭을 낸다. 원화만 담은 사람에게 탭은 소음이다 */}
      {groups.length > 1 && (
        <div role="tablist" aria-label="통화" className="flex gap-1 border-b border-slate-200">
          {groups.map((group) => {
            const isActive = group.currency === currency
            return (
              <button
                key={group.currency}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelected(group.currency)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${
                  isActive
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {TABS[group.currency].label}
                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-500">
                  {group.items.length}
                </span>
              </button>
            )
          })}
        </div>
      )}

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
        {active.items.map((item) => {
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
                  {quote
                    ? formatMoney(quote.price, quote.currency)
                    : settled
                      ? '시세 없음'
                      : '시세 조회 중…'}
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
                {quote ? formatMoney(lineSubtotal(quote, item.qty), quote.currency) : '—'}
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
            {formatMoney(total, currency)}
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

      {/* 통화별로 총액이 따로 있다는 사실을 화면에서 말해야 한다. 탭만 있으면
          다른 탭의 금액이 이 총액에 포함된 것으로 읽힌다. */}
      {groups.length > 1 && (
        <p className="text-center text-xs text-slate-400">
          통화가 다르면 총액을 합치지 않습니다 · 다른 탭에{' '}
          {groups
            .filter((g) => g.currency !== currency)
            .map((g) => `${TABS[g.currency].label} ${g.items.length}종목`)
            .join(', ')}
        </p>
      )}

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
