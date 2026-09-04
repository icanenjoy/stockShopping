// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getProvider, resetProviderForTest } from '@/server/provider'
import { MockProvider } from '@/providers/MockProvider'
import { KisProvider } from '@/providers/KisProvider'

beforeEach(() => {
  resetProviderForTest()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  resetProviderForTest()
})

describe('getProvider', () => {
  it('앱키와 시크릿이 있으면 실제 KIS Provider를 쓴다', () => {
    vi.stubEnv('KIS_APP_KEY', 'KEY')
    vi.stubEnv('KIS_APP_SECRET', 'SECRET')
    vi.stubEnv('KIS_BASE_URL', 'https://openapivts.koreainvestment.com:29443')

    expect(getProvider()).toBeInstanceOf(KisProvider)
  })

  it('KIS_BASE_URL이 없어도 자격증명만 있으면 가짜 시세로 내려앉지 않는다', () => {
    vi.stubEnv('KIS_APP_KEY', 'KEY')
    vi.stubEnv('KIS_APP_SECRET', 'SECRET')
    vi.stubEnv('KIS_BASE_URL', '')

    expect(getProvider()).toBeInstanceOf(KisProvider)
  })

  it('자격증명이 없으면 MockProvider로 내려가고 경고를 남긴다', () => {
    vi.stubEnv('KIS_APP_KEY', '')
    vi.stubEnv('KIS_APP_SECRET', '')

    expect(getProvider()).toBeInstanceOf(MockProvider)
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/가짜 시세/))
  })

  it('시크릿만 빠져도 MockProvider로 내려간다', () => {
    vi.stubEnv('KIS_APP_KEY', 'KEY')
    vi.stubEnv('KIS_APP_SECRET', '')

    expect(getProvider()).toBeInstanceOf(MockProvider)
  })

  it('한 번 고른 Provider는 재사용한다', () => {
    vi.stubEnv('KIS_APP_KEY', '')
    vi.stubEnv('KIS_APP_SECRET', '')

    expect(getProvider()).toBe(getProvider())
  })
})
