import { describe, it, expect } from 'vitest'
import { formatMoney, formatPercent, formatSignedPercent } from '@/domain/format'

describe('formatMoney', () => {
  it('원화는 천 단위 구분 기호를 넣고 원을 붙인다', () => {
    expect(formatMoney(61200, 'KRW')).toBe('61,200원')
  })

  it('원화 0원도 표시한다', () => {
    expect(formatMoney(0, 'KRW')).toBe('0원')
  })

  it('원화는 소수점을 반올림한다 — 원 단위 아래로는 거래되지 않는다', () => {
    expect(formatMoney(61200.6, 'KRW')).toBe('61,201원')
  })

  it('달러는 $를 앞에 붙이고 센트까지 보여준다', () => {
    expect(formatMoney(1102.3, 'USD')).toBe('$1,102.30')
  })

  it('달러는 센트를 버리지 않는다 — 반올림하면 소계 합이 총액과 어긋난다', () => {
    expect(formatMoney(328.21, 'USD')).toBe('$328.21')
  })

  it('달러 0도 표시한다', () => {
    expect(formatMoney(0, 'USD')).toBe('$0.00')
  })
})

describe('formatPercent', () => {
  it('소수를 퍼센트로 바꾼다', () => {
    expect(formatPercent(0.283)).toBe('28.3%')
  })

  it('부호를 빼고 절댓값으로 보여준다', () => {
    expect(formatPercent(-0.0224)).toBe('2.2%')
  })

  it('자릿수를 지정할 수 있다', () => {
    expect(formatPercent(0.283, 0)).toBe('28%')
  })
})

describe('formatSignedPercent', () => {
  it('상승에는 +를 붙인다', () => {
    expect(formatSignedPercent(0.0064)).toBe('+0.6%')
  })

  it('하락에는 -를 붙인다', () => {
    expect(formatSignedPercent(-0.0224)).toBe('-2.2%')
  })

  it('보합은 0.0%다', () => {
    expect(formatSignedPercent(0)).toBe('0.0%')
  })
})
