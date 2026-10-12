import type { Currency } from './types'

const FORMATTERS: Record<Currency, Intl.NumberFormat> = {
  // 원 단위 아래로는 거래되지 않으므로 소수점을 남기지 않는다
  KRW: new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }),
  // 센트를 버리면 소계를 더한 값이 총액과 어긋난다
  USD: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
}

/** 금액을 통화에 맞는 표기로 바꾼다. 통화 기호 없이 숫자만 쓰면 원화와 달러가 섞인다 */
export function formatMoney(value: number, currency: Currency): string {
  const formatted = FORMATTERS[currency].format(value)
  return currency === 'KRW' ? `${formatted}원` : `$${formatted}`
}

/** 절댓값 퍼센트. 부호는 배지의 문구와 색이 이미 말해준다 */
export function formatPercent(rate: number, digits = 1): string {
  return `${(Math.abs(rate) * 100).toFixed(digits)}%`
}

export function formatSignedPercent(rate: number, digits = 1): string {
  const sign = rate > 0 ? '+' : rate < 0 ? '-' : ''
  return `${sign}${(Math.abs(rate) * 100).toFixed(digits)}%`
}
