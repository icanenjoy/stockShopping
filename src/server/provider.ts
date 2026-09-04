import type { PriceProvider } from '@/providers/PriceProvider'
import { MockProvider } from '@/providers/MockProvider'
import { KisKrxProvider } from '@/providers/KisKrxProvider'
import { KisTokenManager } from '@/providers/KisTokenManager'
import { QuoteCache } from './QuoteCache'

const QUOTE_TTL_MS = 5_000

/** KIS_BASE_URL을 지정하지 않으면 실전 서버로 붙는다 */
const DEFAULT_BASE_URL = 'https://openapi.koreainvestment.com:9443'

let provider: PriceProvider | null = null
let cache: QuoteCache | null = null

/**
 * 앱키·시크릿이 없으면 MockProvider로 동작한다.
 * 덕분에 KIS 발급을 기다리지 않고 화면 전체를 개발할 수 있다.
 *
 * 판단 기준은 자격증명뿐이다. KIS_BASE_URL은 기본값이 있으므로, 이것을 빠뜨렸다고
 * 해서 가짜 시세로 조용히 내려앉지 않는다. 모의투자 서버를 쓰려는 사람이 URL을
 * 빠뜨리면 실전 서버에 대한 인증 실패로 시끄럽게 드러난다 — 가짜 가격을 진짜처럼
 * 보여주는 것보다 낫다.
 */
export function getProvider(): PriceProvider {
  if (provider) return provider

  const appKey = process.env.KIS_APP_KEY
  const appSecret = process.env.KIS_APP_SECRET
  const baseUrl = process.env.KIS_BASE_URL?.trim() || DEFAULT_BASE_URL

  if (!appKey || !appSecret) {
    console.warn('[provider] KIS 자격증명 없음 — MockProvider(가짜 시세)로 동작합니다')
    provider = new MockProvider()
    return provider
  }

  provider = new KisKrxProvider({
    tokenManager: new KisTokenManager({ appKey, appSecret, baseUrl }),
    appKey,
    appSecret,
    baseUrl,
  })
  return provider
}

export function getQuoteCache(): QuoteCache {
  if (!cache) cache = new QuoteCache({ ttlMs: QUOTE_TTL_MS })
  return cache
}

/** 테스트에서 환경변수를 바꿔가며 검증할 때 쓴다 */
export function resetProviderForTest(): void {
  provider = null
  cache = null
}
