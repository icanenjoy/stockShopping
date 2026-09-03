import { describe, it, expect } from 'vitest'

describe('테스트 환경', () => {
  it('실행된다', () => {
    expect(1 + 1).toBe(2)
  })

  it('jsdom 환경이다', () => {
    expect(typeof document).toBe('object')
  })
})
