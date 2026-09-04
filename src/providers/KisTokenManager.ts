interface CachedToken {
  value: string
  expiresAt: number
}

interface TokenResponseBody {
  access_token: string
  expires_in: number
}

const DEFAULT_REFRESH_MARGIN_MS = 10 * 60 * 1000
/** 갱신에 실패했을 때 다음 재발급까지 기다리는 시간 */
const DEFAULT_RETRY_COOLDOWN_MS = 60 * 1000

/**
 * KIS 접근토큰을 발급받아 캐싱한다.
 * KIS는 토큰 발급 빈도를 제한하므로 매 요청마다 발급하면 차단된다.
 */
export class KisTokenManager {
  private cached: CachedToken | null = null
  private inflight: Promise<string> | null = null
  /** 이 시각 전에는 재발급을 시도하지 않는다. 발급 실패 직후에만 세워진다 */
  private retryAfter = 0

  private readonly appKey: string
  private readonly appSecret: string
  private readonly baseUrl: string
  private readonly fetchFn: typeof fetch
  private readonly now: () => number
  private readonly refreshMarginMs: number
  private readonly retryCooldownMs: number

  constructor(opts: {
    appKey: string
    appSecret: string
    baseUrl: string
    fetchFn?: typeof fetch
    now?: () => number
    refreshMarginMs?: number
    retryCooldownMs?: number
  }) {
    this.appKey = opts.appKey
    this.appSecret = opts.appSecret
    this.baseUrl = opts.baseUrl.replace(/\/$/, '')
    this.fetchFn = opts.fetchFn ?? fetch
    this.now = opts.now ?? (() => Date.now())
    this.refreshMarginMs = opts.refreshMarginMs ?? DEFAULT_REFRESH_MARGIN_MS
    this.retryCooldownMs = opts.retryCooldownMs ?? DEFAULT_RETRY_COOLDOWN_MS
  }

  async getToken(): Promise<string> {
    const at = this.now()
    if (this.cached && at < this.cached.expiresAt - this.refreshMarginMs) {
      return this.cached.value
    }

    const usable = this.cached && at < this.cached.expiresAt ? this.cached : null

    // 방금 발급에 실패했다면 쿨다운 동안은 토큰 엔드포인트를 두드리지 않는다.
    // 쓸 수 있는 토큰이 남아 있으면 그것으로 버티고, 없으면 시도조차 하지 않고
    // 실패한다. 여기서 굳이 다시 물어보면 KIS의 발급 빈도 제한(1분당 1회)에
    // 걸린 상태에서 7초마다 재시도하게 되어, 한도가 영영 풀리지 않는다.
    if (at < this.retryAfter) {
      if (usable) return usable.value
      throw new Error('KIS 토큰 발급 재시도 대기 중 — 직전 발급이 실패했습니다')
    }

    const pending = this.inflight ?? this.issue()
    this.inflight = pending
    try {
      return await pending
    } catch (error) {
      // 캐시가 있든 없든 쿨다운을 세운다. 토큰을 한 번도 못 받은 상태야말로
      // 매 요청이 곧바로 재발급으로 이어지는, 가장 세게 두드리는 경우다.
      this.retryAfter = at + this.retryCooldownMs
      // 아직 만료 전이라면 기존 토큰으로 버틴다 (초기 호출자·합류 호출자 모두 동일하게 적용)
      if (usable) return usable.value
      throw error
    } finally {
      if (this.inflight === pending) this.inflight = null
    }
  }

  private async issue(): Promise<string> {
    const response = await this.fetchFn(`${this.baseUrl}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: this.appKey,
        appsecret: this.appSecret,
      }),
    })

    if (!response.ok) {
      throw new Error(`KIS 토큰 발급 실패: ${response.status}`)
    }

    const body = (await response.json()) as TokenResponseBody
    this.retryAfter = 0
    this.cached = {
      value: body.access_token,
      expiresAt: this.now() + body.expires_in * 1000,
    }
    return this.cached.value
  }
}
