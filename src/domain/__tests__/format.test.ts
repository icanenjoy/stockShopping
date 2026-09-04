import { describe, it, expect } from 'vitest'
import { formatWon, formatPercent, formatSignedPercent } from '@/domain/format'

describe('formatWon', () => {
  it('천 단위 구분 기호를 넣고 원을 붙인다', () => {
    expect(formatWon(61200)).toBe('61,200원')
  })

  it('0원도 표시한다', () => {
    expect(formatWon(0)).toBe('0원')
  })

  it('소수점은 반올림한다', () => {
    expect(formatWon(61200.6)).toBe('61,201원')
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
