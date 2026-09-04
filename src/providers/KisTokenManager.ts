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

    // 방금 갱신에 실패했고 쓸 수 있는 토큰이 아직 남아 있다면, 쿨다운 동안은
    // 토큰 엔드포인트를 두드리지 않는다. 갱신 여유(기본 10분) 내내 매 요청마다
    // 재발급을 시도하면 KIS가 발급 빈도 제한으로 우리를 차단한다.
    if (this.cached && at < this.cached.expiresAt && at < this.retryAfter) {
      return this.cached.value
    }

    const pending = this.inflight ?? this.issue()
    this.inflight = pending
    try {
      return await pending
    } catch (error) {
      // 아직 만료 전이라면 기존 토큰으로 버틴다 (초기 호출자·합류 호출자 모두 동일하게 적용)
      if (this.cached && at < this.cached.expiresAt) {
        this.retryAfter = at + this.retryCooldownMs
        return this.cached.value
      }
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
