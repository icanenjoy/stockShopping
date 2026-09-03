import { describe, it, expect } from 'vitest'
import { isMarketOpen } from '@/domain/market'

/** KST 기준 시각을 Date로 만든다 (KST = UTC+9) */
function kst(iso: string): Date {
  return new Date(`${iso}+09:00`)
}

describe('isMarketOpen', () => {
  it('평일 정규장 중이면 열려 있다', () => {
    expect(isMarketOpen(kst('2026-09-03T10:30:00'))).toBe(true)
  })

  it('평일 개장 직전은 닫혀 있다', () => {
    expect(isMarketOpen(kst('2026-09-03T08:59:59'))).toBe(false)
  })

  it('개장 시각 정각은 열려 있다', () => {
    expect(isMarketOpen(kst('2026-09-03T09:00:00'))).toBe(true)
  })

  it('폐장 시각 정각은 닫혀 있다', () => {
    expect(isMarketOpen(kst('2026-09-03T15:30:00'))).toBe(false)
  })

  it('토요일은 닫혀 있다', () => {
    expect(isMarketOpen(kst('2026-09-05T10:30:00'))).toBe(false)
  })

  it('일요일은 닫혀 있다', () => {
    expect(isMarketOpen(kst('2026-09-06T10:30:00'))).toBe(false)
  })
})
