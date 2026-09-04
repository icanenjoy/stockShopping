import { describe, it, expect, vi, afterEach } from 'vitest'
import { KisKrxProvider } from '@/providers/KisKrxProvider'
import { KisTokenManager } from '@/providers/KisTokenManager'
import type { StockSummary } from '@/domain/types'

const BASE = 'https://openapi.example.com'

const master: StockSummary[] = [
  { code: '005930', name: '삼성전자', market: 'KOSPI' },
  { code: '000660', name: 'SK하이닉스', market: 'KOSPI' },
]

function priceResponse(over: Record<string, string> = {}) {
  return new Response(
    JSON.stringify({
      rt_cd: '0',
      msg1: '정상처리',
      output: {
        stck_prpr: '61200',
        stck_sdpr: '62600',
        w52_hgpr: '85000',
        temp_stop_yn: 'N',
        ...over,
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

function makeProvider(fetchFn: typeof fetch) {
  const tokenManager = {
    getToken: async () => 'TOKEN',
  } as unknown as KisTokenManager

  return new KisKrxProvider({
    tokenManager,
    appKey: 'KEY',
    appSecret: 'SECRET',
    baseUrl: BASE,
    master,
    fetchFn,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('KisKrxProvider', () => {
  it('검색은 로컬 종목 마스터를 쓰고 네트워크를 타지 않는다', async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch
    const result = await makeProvider(fetchFn).search('삼성')

    expect(result).toEqual([master[0]])
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('KIS 응답을 Quote로 변환한다', async () => {
    const fetchFn = vi.fn(async () => priceResponse()) as unknown as typeof fetch
    const [quote] = await makeProvider(fetchFn).getQuotes(['005930'])

    expect(quote).toMatchObject({
      code: '005930',
      name: '삼성전자',
      price: 61200,
      prevClose: 62600,
      high52w: 85000,
      tradingHalted: false,
    })
    expect(quote.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('종목명은 응답이 아니라 로컬 마스터에서 가져온다', async () => {
    const fetchFn = vi.fn(async () =>
      priceResponse({ hts_kor_isnm: '엉뚱한이름' }),
    ) as unknown as typeof fetch
    const [quote] = await makeProvider(fetchFn).getQuotes(['005930'])

    expect(quote.name).toBe('삼성전자')
  })

  it('인증 헤더와 조회 파라미터를 규격대로 보낸다', async () => {
    const fetchFn = vi.fn(async () => priceResponse()) as unknown as typeof fetch
    await makeProvider(fetchFn).getQuotes(['005930'])

    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toBe(
      `${BASE}/uapi/domestic-stock/v1/quotations/inquire-price` +
        `?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=005930`,
    )
    expect(init.headers.authorization).toBe('Bearer TOKEN')
    expect(init.headers.appkey).toBe('KEY')
    expect(init.headers.appsecret).toBe('SECRET')
    expect(init.headers.tr_id).toBe('FHKST01010100')
  })

  it('temp_stop_yn이 Y이면 거래정지로 표시한다', async () => {
    const fetchFn = vi.fn(async () => priceResponse({ temp_stop_yn: 'Y' })) as unknown as typeof fetch
    const [quote] = await makeProvider(fetchFn).getQuotes(['005930'])

    expect(quote.tradingHalted).toBe(true)
  })

  it('temp_stop_yn 필드가 없으면 거래정지가 아니라고 본다', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            rt_cd: '0',
            output: { stck_prpr: '61200', stck_sdpr: '62600', w52_hgpr: '85000' },
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch
    const [quote] = await makeProvider(fetchFn).getQuotes(['005930'])

    expect(quote.tradingHalted).toBe(false)
  })

  it('마스터에 없는 코드는 조회하지 않고 건너뛴다', async () => {
    const fetchFn = vi.fn(async () => priceResponse()) as unknown as typeof fetch
    const quotes = await makeProvider(fetchFn).getQuotes(['999999'])

    expect(quotes).toEqual([])
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('한 종목이 실패해도 나머지 종목은 살린다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let call = 0
    const fetchFn = vi.fn(async () => {
      call += 1
      if (call === 1) return new Response('boom', { status: 500 })
      return priceResponse({ stck_prpr: '205000' })
    }) as unknown as typeof fetch

    const quotes = await makeProvider(fetchFn).getQuotes(['005930', '000660'])

    expect(quotes).toHaveLength(1)
    expect(quotes[0].code).toBe('000660')
  })

  it('실패한 종목의 사유를 서버 로그에 남긴다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchFn = vi.fn(async () => new Response('boom', { status: 500 })) as unknown as typeof fetch

    await makeProvider(fetchFn).getQuotes(['005930'])

    expect(logged).toHaveBeenCalledWith('[kis] 시세 조회 실패', expect.any(Error))
    expect(String(logged.mock.calls[0][1])).toMatch(/005930 500/)
  })

  it('rt_cd가 0이 아니면 그 종목은 결과에서 뺀다', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ rt_cd: '1', msg1: '조회할 수 없습니다', output: {} }), {
          status: 200,
        }),
    ) as unknown as typeof fetch

    expect(await makeProvider(fetchFn).getQuotes(['005930'])).toEqual([])
  })
})
