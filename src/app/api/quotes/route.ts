import { NextResponse } from 'next/server'
import { getProvider, getQuoteCache } from '@/server/provider'

const MAX_CODES = 50

export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get('codes') ?? ''
  const codes = raw.split(',').map((c) => c.trim()).filter((c) => c !== '')

  if (codes.length === 0) {
    return NextResponse.json({ quotes: [], stale: false })
  }
  if (codes.length > MAX_CODES) {
    return NextResponse.json(
      { error: `한 번에 조회할 수 있는 종목은 최대 ${MAX_CODES}개입니다` },
      { status: 400 },
    )
  }

  const provider = getProvider()

  try {
    const result = await getQuoteCache().get(codes, (missing) => provider.getQuotes(missing))
    return NextResponse.json(result)
  } catch {
    // 캐시조차 없어 아무것도 보여줄 수 없는 경우에만 여기로 온다
    return NextResponse.json({ error: '시세를 가져오지 못했습니다' }, { status: 502 })
  }
}
