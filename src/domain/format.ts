const WON = new Intl.NumberFormat('ko-KR')

export function formatWon(value: number): string {
  return `${WON.format(Math.round(value))}원`
}

/** 절댓값 퍼센트. 부호는 배지의 문구와 색이 이미 말해준다 */
export function formatPercent(rate: number, digits = 1): string {
  return `${(Math.abs(rate) * 100).toFixed(digits)}%`
}

export function formatSignedPercent(rate: number, digits = 1): string {
  const sign = rate > 0 ? '+' : rate < 0 ? '-' : ''
  return `${sign}${(Math.abs(rate) * 100).toFixed(digits)}%`
}
