'use client'

import { useState } from 'react'
import type { Quote, StockSummary, Currency } from '@/domain/types'
import { discountFromHigh, changeFromPrevClose } from '@/domain/pricing'
import { formatMoney, formatPercent } from '@/domain/format'
import { marketLabel } from '@/domain/market'
import { PriceBadge } from './PriceBadge'
import { QtyStepper } from './QtyStepper'

export function StockCard({
  stock,
  quote,
  onAdd,
}: {
  stock: StockSummary
  quote: Quote
  onAdd: (code: string, qty: number, price: number, currency: Currency) => void
}) {
  const [qty, setQty] = useState(1)

  const discount = discountFromHigh(quote.price, quote.high52w)
  const change = changeFromPrevClose(quote.price, quote.prevClose)
  const onSale = discount > 0

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-900">{quote.name}</h3>
          {/* 통합 검색이라 국내와 미국 종목이 한 목록에 섞인다. 어느 시장인지
              말해주지 않으면 "$"만 보고 뒤늦게 알아차리게 된다. */}
          <span className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            {marketLabel(stock.market)}
          </span>
        </div>
        <p className="text-xs text-slate-400">
          {stock.code}
          {stock.englishName && ` · ${stock.englishName}`}
        </p>
      </header>

      <div className="flex flex-wrap items-baseline gap-2">
        {onSale && (
          <s className="text-sm text-slate-400">{formatMoney(quote.high52w, quote.currency)}</s>
        )}
        <strong className="text-xl font-bold text-slate-900">
          {formatMoney(quote.price, quote.currency)}
        </strong>
        {onSale && (
          <span className="rounded bg-rose-600 px-1.5 py-0.5 text-xs font-bold text-white">
            {formatPercent(discount, 0)} OFF
          </span>
        )}
      </div>

      <PriceBadge changeRate={change} />

      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <QtyStepper value={qty} onChange={(next) => setQty(Math.max(1, next))} label={quote.name} />
        <button
          type="button"
          disabled={quote.tradingHalted}
          onClick={() => onAdd(quote.code, qty, quote.price, quote.currency)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
        >
          {quote.tradingHalted ? '거래정지' : '담기'}
        </button>
      </div>

      <p className="text-[11px] text-slate-400">정가는 52주 최고가 기준입니다</p>
    </article>
  )
}
