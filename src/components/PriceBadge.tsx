import { formatPercent } from '@/domain/format'

/** 전일 종가 대비 등락을 쇼핑 언어로 번역한다 */
export function PriceBadge({ changeRate }: { changeRate: number }) {
  if (changeRate < 0) {
    return (
      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">
        🔥 세일중 {formatPercent(changeRate)}
      </span>
    )
  }
  if (changeRate > 0) {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
        ↑ 가격인상 {formatPercent(changeRate)}
      </span>
    )
  }
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
      보합
    </span>
  )
}
