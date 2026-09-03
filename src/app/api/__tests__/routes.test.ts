// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET as searchGet } from '@/app/api/search/route'
import { GET as quotesGet } from '@/app/api/quotes/route'
import { resetProviderForTest } from '@/server/provider'

beforeEach(() => {
  vi.stubEnv('KIS_APP_KEY', '')
  vi.stubEnv('KIS_APP_SECRET', '')
  resetProviderForTest()
})

describe('GET /api/search', () => {
  it('질의에 맞는 종목을 반환한다', async () => {
    const res = await searchGet(new Request('http://localhost/api/search?q=삼성전자'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.stocks[0]).toMatchObject({ code: '005930', name: '삼성전자' })
  })

  it('q가 없으면 빈 목록을 준다', async () => {
    const res = await searchGet(new Request('http://localhost/api/search'))

    expect(res.status).toBe(200)
    expect((await res.json()).stocks).toEqual([])
  })
})

describe('GET /api/quotes', () => {
  it('요청한 종목의 시세를 반환한다', async () => {
    const res = await quotesGet(
      new Request('http://localhost/api/quotes?codes=005930,000660'),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.quotes.map((q: { code: string }) => q.code)).toEqual(['005930', '000660'])
    expect(body.stale).toBe(false)
  })

  it('codes가 없으면 빈 목록을 준다', async () => {
    const res = await quotesGet(new Request('http://localhost/api/quotes'))

    expect(res.status).toBe(200)
    expect((await res.json()).quotes).toEqual([])
  })

  it('빈 문자열이 섞인 codes를 걸러낸다', async () => {
    const res = await quotesGet(new Request('http://localhost/api/quotes?codes=005930,,'))

    expect((await res.json()).quotes).toHaveLength(1)
  })

  it('한 번에 조회할 수 있는 종목 수를 제한한다', async () => {
    const codes = Array.from({ length: 60 }, (_, i) => String(i).padStart(6, '0')).join(',')
    const res = await quotesGet(new Request(`http://localhost/api/quotes?codes=${codes}`))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/50/)
  })
})
