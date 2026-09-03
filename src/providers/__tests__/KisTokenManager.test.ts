import { describe, it, expect, vi } from 'vitest'
import { KisTokenManager } from '@/providers/KisTokenManager'

const BASE = 'https://openapi.example.com'

function tokenResponse(token: string, expiresInSec = 86400) {
  return new Response(
    JSON.stringify({ access_token: token, token_type: 'Bearer', expires_in: expiresInSec }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

function make(fetchFn: typeof fetch, now: () => number) {
  return new KisTokenManager({
    appKey: 'KEY',
    appSecret: 'SECRET',
    baseUrl: BASE,
    fetchFn,
    now,
  })
}

describe('KisTokenManager', () => {
  it('처음 호출하면 토큰을 발급받는다', async () => {
    const fetchFn = vi.fn(async () => tokenResponse('T1')) as unknown as typeof fetch
    const manager = make(fetchFn, () => 0)

    expect(await manager.getToken()).toBe('T1')
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('올바른 엔드포인트에 앱키와 시크릿을 보낸다', async () => {
    const fetchFn = vi.fn(async () => tokenResponse('T1')) as unknown as typeof fetch
    await make(fetchFn, () => 0).getToken()

    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe(`${BASE}/oauth2/tokenP`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      grant_type: 'client_credentials',
      appkey: 'KEY',
      appsecret: 'SECRET',
    })
  })

  it('유효기간 안에서는 캐시된 토큰을 재사용한다', async () => {
    let t = 0
    const fetchFn = vi.fn(async () => tokenResponse('T1')) as unknown as typeof fetch
    const manager = make(fetchFn, () => t)

    await manager.getToken()
    t = 3_600_000 // 1시간 뒤
    expect(await manager.getToken()).toBe('T1')
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('만료가 임박하면 새로 발급받는다', async () => {
    let t = 0
    let issued = 0
    const fetchFn = vi.fn(async () => tokenResponse(`T${++issued}`)) as unknown as typeof fetch
    const manager = make(fetchFn, () => t)

    await manager.getToken()
    t = 86_400_000 - 60_000 // 만료 1분 전, 기본 여유 10분보다 짧다
    expect(await manager.getToken()).toBe('T2')
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('동시에 호출해도 발급 요청은 한 번만 나간다', async () => {
    const fetchFn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10))
      return tokenResponse('T1')
    }) as unknown as typeof fetch
    const manager = make(fetchFn, () => 0)

    const [a, b] = await Promise.all([manager.getToken(), manager.getToken()])

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(a).toBe('T1')
    expect(b).toBe('T1')
  })

  it('갱신에 실패해도 아직 만료 전이면 기존 토큰을 쓴다', async () => {
    let t = 0
    let call = 0
    const fetchFn = vi.fn(async () => {
      call += 1
      if (call === 1) return tokenResponse('T1')
      throw new Error('network down')
    }) as unknown as typeof fetch
    const manager = make(fetchFn, () => t)

    await manager.getToken()
    t = 86_400_000 - 60_000
    expect(await manager.getToken()).toBe('T1')
  })

  it('토큰이 없는데 발급에 실패하면 에러를 던진다', async () => {
    const fetchFn = vi.fn(async () => new Response('rate limited', { status: 403 })) as unknown as typeof fetch
    await expect(make(fetchFn, () => 0).getToken()).rejects.toThrow(/403/)
  })

  it('발급 실패 뒤 다음 호출에서 다시 시도한다', async () => {
    let call = 0
    const fetchFn = vi.fn(async () => {
      call += 1
      if (call === 1) return new Response('oops', { status: 500 })
      return tokenResponse('T1')
    }) as unknown as typeof fetch
    const manager = make(fetchFn, () => 0)

    await expect(manager.getToken()).rejects.toThrow()
    expect(await manager.getToken()).toBe('T1')
  })
})
