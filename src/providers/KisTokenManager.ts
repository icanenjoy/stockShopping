interface CachedToken {
  value: string
  expiresAt: number
}

interface TokenResponseBody {
  access_token: string
  expires_in: number
}

const DEFAULT_REFRESH_MARGIN_MS = 10 * 60 * 1000

/**
 * KIS 접근토큰을 발급받아 캐싱한다.
 * KIS는 토큰 발급 빈도를 제한하므로 매 요청마다 발급하면 차단된다.
 */
export class KisTokenManager {
  private cached: CachedToken | null = null
  private inflight: Promise<string> | null = null

  private readonly appKey: string
  private readonly appSecret: string
  private readonly baseUrl: string
  private readonly fetchFn: typeof fetch
  private readonly now: () => number
  private readonly refreshMarginMs: number

  constructor(opts: {
    appKey: string
    appSecret: string
    baseUrl: string
    fetchFn?: typeof fetch
    now?: () => number
    refreshMarginMs?: number
  }) {
    this.appKey = opts.appKey
    this.appSecret = opts.appSecret
    this.baseUrl = opts.baseUrl.replace(/\/$/, '')
    this.fetchFn = opts.fetchFn ?? fetch
    this.now = opts.now ?? (() => Date.now())
    this.refreshMarginMs = opts.refreshMarginMs ?? DEFAULT_REFRESH_MARGIN_MS
  }

  async getToken(): Promise<string> {
    const at = this.now()
    if (this.cached && at < this.cached.expiresAt - this.refreshMarginMs) {
      return this.cached.value
    }
    if (this.inflight) return this.inflight

    this.inflight = this.issue()
    try {
      return await this.inflight
    } catch (error) {
      // 아직 만료 전이라면 기존 토큰으로 버틴다
      if (this.cached && at < this.cached.expiresAt) return this.cached.value
      throw error
    } finally {
      this.inflight = null
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
    this.cached = {
      value: body.access_token,
      expiresAt: this.now() + body.expires_in * 1000,
    }
    return this.cached.value
  }
}
