'use client'

import { useState } from 'react'
import type { Quote } from '@/domain/types'
import { discountFromHigh, changeFromPrevClose } from '@/domain/pricing'
import { formatWon, formatPercent } from '@/domain/format'
import { PriceBadge } from './PriceBadge'
import { QtyStepper } from './QtyStepper'

export function StockCard({
  quote,
  onAdd,
}: {
  quote: Quote
  onAdd: (code: string, qty: number, price: number) => void
}) {
  const [qty, setQty] = useState(1)

  const discount = discountFromHigh(quote.price, quote.high52w)
  const change = changeFromPrevClose(quote.price, quote.prevClose)
  const onSale = discount > 0

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header>
        <h3 className="font-semibold text-slate-900">{quote.name}</h3>
        <p className="text-xs text-slate-400">{quote.code}</p>
      </header>

      <div className="flex flex-wrap items-baseline gap-2">
        {onSale && (
          <s className="text-sm text-slate-400">{formatWon(quote.high52w)}</s>
        )}
        <strong className="text-xl font-bold text-slate-900">{formatWon(quote.price)}</strong>
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
          onClick={() => onAdd(quote.code, qty, quote.price)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
        >
          {quote.tradingHalted ? '거래정지' : '담기'}
        </button>
      </div>

      <p className="text-[11px] text-slate-400">정가는 52주 최고가 기준입니다</p>
    </article>
  )
}
