import { describe, it, expect } from 'vitest'
import { isMarketOpen } from '@/domain/market'

/** KST 기준 시각을 Date로 만든다 (KST = UTC+9) */
function kst(iso: string): Date {
  return new Date(`${iso}+09:00`)
}

/** UTC 기준 시각. 미국장은 서머타임 때문에 현지 표기가 헷갈리므로 UTC로 못박는다 */
function utc(iso: string): Date {
  return new Date(`${iso}Z`)
}

describe('isMarketOpen — 국내', () => {
  it('평일 정규장 중이면 열려 있다', () => {
    expect(isMarketOpen(kst('2026-09-03T10:30:00'), 'KOSPI')).toBe(true)
  })

  it('KOSDAQ도 같은 시간표를 쓴다', () => {
    expect(isMarketOpen(kst('2026-09-03T10:30:00'), 'KOSDAQ')).toBe(true)
  })

  it('평일 개장 직전은 닫혀 있다', () => {
    expect(isMarketOpen(kst('2026-09-03T08:59:59'), 'KOSPI')).toBe(false)
  })

  it('개장 시각 정각은 열려 있다', () => {
    expect(isMarketOpen(kst('2026-09-03T09:00:00'), 'KOSPI')).toBe(true)
  })

  it('폐장 시각 정각은 닫혀 있다', () => {
    expect(isMarketOpen(kst('2026-09-03T15:30:00'), 'KOSPI')).toBe(false)
  })

  it('토요일은 닫혀 있다', () => {
    expect(isMarketOpen(kst('2026-09-05T10:30:00'), 'KOSPI')).toBe(false)
  })

  it('일요일은 닫혀 있다', () => {
    expect(isMarketOpen(kst('2026-09-06T10:30:00'), 'KOSPI')).toBe(false)
  })
})

describe('isMarketOpen — 미국', () => {
  // 겨울(EST, UTC-5): 09:30 ET = 14:30 UTC, 16:00 ET = 21:00 UTC
  it('겨울 정규장 중이면 열려 있다', () => {
    expect(isMarketOpen(utc('2026-01-15T15:00:00'), 'NAS')).toBe(true)
  })

  it('겨울 개장 직전은 닫혀 있다', () => {
    expect(isMarketOpen(utc('2026-01-15T14:29:59'), 'NAS')).toBe(false)
  })

  it('겨울 개장 정각은 열려 있다', () => {
    expect(isMarketOpen(utc('2026-01-15T14:30:00'), 'NAS')).toBe(true)
  })

  it('겨울 폐장 정각은 닫혀 있다', () => {
    expect(isMarketOpen(utc('2026-01-15T21:00:00'), 'NAS')).toBe(false)
  })

  // 여름(EDT, UTC-4): 09:30 ET = 13:30 UTC, 16:00 ET = 20:00 UTC
  it('서머타임을 직접 계산하지 않고도 여름 개장을 맞춘다', () => {
    expect(isMarketOpen(utc('2026-07-15T13:30:00'), 'NAS')).toBe(true)
  })

  it('여름에 겨울 개장 시각(14:30 UTC)은 이미 장중이다', () => {
    expect(isMarketOpen(utc('2026-07-15T13:29:59'), 'NAS')).toBe(false)
  })

  it('여름 폐장 정각은 닫혀 있다', () => {
    expect(isMarketOpen(utc('2026-07-15T20:00:00'), 'NAS')).toBe(false)
  })

  it('NYSE와 AMEX도 같은 시간표를 쓴다', () => {
    expect(isMarketOpen(utc('2026-01-15T15:00:00'), 'NYS')).toBe(true)
    expect(isMarketOpen(utc('2026-01-15T15:00:00'), 'AMS')).toBe(true)
  })

  it('미국 현지 토요일은 닫혀 있다', () => {
    expect(isMarketOpen(utc('2026-01-17T15:00:00'), 'NAS')).toBe(false)
  })

  it('한국이 월요일이어도 미국이 아직 일요일이면 닫혀 있다', () => {
    // KST 월요일 09:00 = 일요일 00:00 UTC
    expect(isMarketOpen(utc('2026-01-18T00:00:00'), 'NAS')).toBe(false)
  })
})
