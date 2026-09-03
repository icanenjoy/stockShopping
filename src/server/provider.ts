import type { PriceProvider } from '@/providers/PriceProvider'
import { MockProvider } from '@/providers/MockProvider'
import { KisKrxProvider } from '@/providers/KisKrxProvider'
import { KisTokenManager } from '@/providers/KisTokenManager'
import { QuoteCache } from './QuoteCache'

const QUOTE_TTL_MS = 5_000

let provider: PriceProvider | null = null
let cache: QuoteCache | null = null

/**
 * 앱키가 없으면 MockProvider로 동작한다.
 * 덕분에 KIS 발급을 기다리지 않고 화면 전체를 개발할 수 있다.
 */
export function getProvider(): PriceProvider {
  if (provider) return provider

  const appKey = process.env.KIS_APP_KEY
  const appSecret = process.env.KIS_APP_SECRET
  const baseUrl = process.env.KIS_BASE_URL

  if (!appKey || !appSecret || !baseUrl) {
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
