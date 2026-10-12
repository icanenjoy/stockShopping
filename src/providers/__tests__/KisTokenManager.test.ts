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

  it('발급 실패 뒤 쿨다운이 지나면 다시 시도해 회복한다', async () => {
    let t = 0
    let call = 0
    const fetchFn = vi.fn(async () => {
      call += 1
      if (call === 1) return new Response('oops', { status: 500 })
      return tokenResponse('T1')
    }) as unknown as typeof fetch
    const manager = make(fetchFn, () => t)

    await expect(manager.getToken()).rejects.toThrow()

    // 같은 순간에 곧바로 다시 물어봐도 발급을 시도하지 않는다 — 그것이 발급
    // 빈도 제한에 걸린 상태를 스스로 연장시킨다
    await expect(manager.getToken()).rejects.toThrow()
    expect(fetchFn).toHaveBeenCalledTimes(1)

    t = 60_000
    expect(await manager.getToken()).toBe('T1')
  })

  it('갱신에 실패하면 쿨다운 동안 토큰 엔드포인트를 다시 두드리지 않는다', async () => {
    let t = 0
    let call = 0
    const fetchFn = vi.fn(async () => {
      call += 1
      if (call === 1) return tokenResponse('T1')
      throw new Error('network down')
    }) as unknown as typeof fetch
    const manager = make(fetchFn, () => t)

    await manager.getToken()
    t = 86_400_000 - 60_000 // 만료 1분 전, 갱신 여유(10분) 안이라 매번 갱신을 시도한다
    expect(await manager.getToken()).toBe('T1')
    expect(fetchFn).toHaveBeenCalledTimes(2)

    // 쿨다운(1분) 안에서는 몇 번을 물어도 발급 요청이 나가지 않는다
    t += 1_000
    expect(await manager.getToken()).toBe('T1')
    t += 1_000
    expect(await manager.getToken()).toBe('T1')
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('쿨다운이 지나면 다시 갱신을 시도한다', async () => {
    let t = 0
    let call = 0
    const fetchFn = vi.fn(async () => {
      call += 1
      if (call === 2) throw new Error('network down')
      return tokenResponse(`T${call}`)
    }) as unknown as typeof fetch
    const manager = make(fetchFn, () => t)

    await manager.getToken()
    t = 86_400_000 - 600_000 // 만료 10분 전
    expect(await manager.getToken()).toBe('T1')
    expect(fetchFn).toHaveBeenCalledTimes(2)

    t += 60_001
    expect(await manager.getToken()).toBe('T3')
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })

  it('동시 호출 중 갱신이 실패하고 기존 토큰이 아직 만료 전이면, 두 호출자 모두 기존 토큰을 받는다', async () => {
    let t = 0
    let call = 0
    const fetchFn = vi.fn(async () => {
      call += 1
      if (call === 1) return tokenResponse('T1')
      await new Promise((r) => setTimeout(r, 10))
      throw new Error('network down')
    }) as unknown as typeof fetch
    const manager = make(fetchFn, () => t)

    await manager.getToken()
    t = 86_400_000 - 60_000 // 만료 1분 전, 기본 여유 10분보다 짧다

    const [a, b] = await Promise.all([manager.getToken(), manager.getToken()])

    expect(a).toBe('T1')
    expect(b).toBe('T1')
  })
})

/**
 * KIS는 토큰 발급을 1분당 1회로 제한한다. 아직 토큰을 한 번도 못 받은 상태에서
 * 발급이 막히면, 쿨다운 없이 매 요청마다 다시 두드리게 된다. 장바구니 화면은
 * 7초마다 시세를 갱신하므로 그 한도는 영영 풀리지 않는다 — 스스로를 가둔다.
 */
describe('KisTokenManager — 발급 실패가 스스로를 키우지 않는다', () => {
  function failing(status = 403) {
    return vi.fn(async () => new Response('', { status })) as unknown as typeof fetch
  }

  it('토큰이 하나도 없는 상태에서 발급에 실패하면 쿨다운 동안 다시 두드리지 않는다', async () => {
    let t = 0
    const fetchFn = failing()
    const manager = make(fetchFn, () => t)

    await expect(manager.getToken()).rejects.toThrow()
    expect(fetchFn).toHaveBeenCalledTimes(1)

    // 7초 뒤 폴링이 다시 물어봐도 발급을 시도하지 않는다
    t = 7_000
    await expect(manager.getToken()).rejects.toThrow()
    expect(fetchFn).toHaveBeenCalledTimes(1)

    t = 14_000
    await expect(manager.getToken()).rejects.toThrow()
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('쿨다운이 지나면 다시 발급을 시도한다', async () => {
    let t = 0
    const fetchFn = failing()
    const manager = make(fetchFn, () => t)

    await expect(manager.getToken()).rejects.toThrow()

    t = 60_000
    await expect(manager.getToken()).rejects.toThrow()
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('쿨다운이 끝나고 성공하면 정상으로 돌아온다', async () => {
    let t = 0
    let attempt = 0
    const fetchFn = vi.fn(async () => {
      attempt++
      return attempt === 1 ? new Response('', { status: 403 }) : tokenResponse('T1')
    }) as unknown as typeof fetch
    const manager = make(fetchFn, () => t)

    await expect(manager.getToken()).rejects.toThrow()

    t = 60_000
    expect(await manager.getToken()).toBe('T1')

    // 이후로는 캐시를 쓴다
    t = 61_000
    expect(await manager.getToken()).toBe('T1')
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('쿨다운 중에도 쓸 수 있는 토큰이 있으면 그것으로 버틴다', async () => {
    let t = 0
    let attempt = 0
    const fetchFn = vi.fn(async () => {
      attempt++
      // 첫 발급은 성공, 갱신 시도는 계속 실패
      return attempt === 1 ? tokenResponse('T1', 3600) : new Response('', { status: 403 })
    }) as unknown as typeof fetch
    const manager = make(fetchFn, () => t)

    expect(await manager.getToken()).toBe('T1')

    // 갱신 여유(10분) 안으로 들어가면 갱신을 시도하고, 실패해도 기존 토큰을 쓴다
    t = 3_000_000
    expect(await manager.getToken()).toBe('T1')
    expect(fetchFn).toHaveBeenCalledTimes(2)

    // 쿨다운 동안에는 재발급을 시도하지 않는다
    t = 3_007_000
    expect(await manager.getToken()).toBe('T1')
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})
