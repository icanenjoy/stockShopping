'use client'

export function QtyStepper({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (qty: number) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`${label} 수량 줄이기`}
        onClick={() => onChange(value - 1)}
        className="h-8 w-8 rounded border border-slate-300 text-lg leading-none"
      >
        −
      </button>
      <span aria-label={`${label} 수량`} className="w-8 text-center tabular-nums">
        {value}
      </span>
      <button
        type="button"
        aria-label={`${label} 수량 늘리기`}
        onClick={() => onChange(value + 1)}
        className="h-8 w-8 rounded border border-slate-300 text-lg leading-none"
      >
        +
      </button>
    </div>
  )
}
