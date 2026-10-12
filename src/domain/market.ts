import type { Market } from './types'

interface Session {
  timeZone: string
  /** 개장 시각(분). 이 시각 정각은 장중이다 */
  openMinutes: number
  /** 폐장 시각(분). 이 시각 정각은 이미 폐장이다 */
  closeMinutes: number
}

/**
 * 시장별 정규장 시간표.
 *
 * 시각 판정을 IANA 타임존에 맡긴다. 미국장은 서머타임에 따라 UTC 기준 개장이
 * 한 시간 움직이는데, 이를 직접 계산하면 매년 전환일마다 한 시간씩 틀린 값을
 * 보여주게 된다. Intl이 이미 아는 것을 우리가 다시 구현할 이유가 없다.
 */
const SESSIONS: Record<Market, Session> = {
  KOSPI: { timeZone: 'Asia/Seoul', openMinutes: 9 * 60, closeMinutes: 15 * 60 + 30 },
  KOSDAQ: { timeZone: 'Asia/Seoul', openMinutes: 9 * 60, closeMinutes: 15 * 60 + 30 },
  NAS: { timeZone: 'America/New_York', openMinutes: 9 * 60 + 30, closeMinutes: 16 * 60 },
  NYS: { timeZone: 'America/New_York', openMinutes: 9 * 60 + 30, closeMinutes: 16 * 60 },
  AMS: { timeZone: 'America/New_York', openMinutes: 9 * 60 + 30, closeMinutes: 16 * 60 },
}

const WEEKEND = new Set(['Sat', 'Sun'])

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

/**
 * 해당 시장의 정규장 운영 여부. 공휴일은 판정하지 않는다.
 *
 * 요일도 현지 기준으로 본다. 한국이 월요일이어도 뉴욕은 아직 일요일일 수 있다.
 */
export function isMarketOpen(now: Date, market: Market): boolean {
  const { timeZone, openMinutes, closeMinutes } = SESSIONS[market]
  const parts = formatterFor(timeZone).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''

  if (WEEKEND.has(get('weekday'))) return false

  // 자정은 로케일에 따라 24로 나온다. 그대로 두면 다음 날 00:00이 24:00이 되어
  // 개장 판정이 어긋난다.
  const hour = Number(get('hour')) % 24
  const minutes = hour * 60 + Number(get('minute'))
  return minutes >= openMinutes && minutes < closeMinutes
}

/** 통화가 같은 시장들 중 하나라도 장이 열려 있는지. 장바구니 탭의 갱신 여부를 정한다 */
export function isAnyMarketOpen(now: Date, markets: Market[]): boolean {
  return markets.some((market) => isMarketOpen(now, market))
}

/** 화면에 쓰는 거래소 이름. KIS 코드(NAS/NYS/AMS)는 사용자에게 낯설다 */
const MARKET_LABELS: Record<Market, string> = {
  KOSPI: 'KOSPI',
  KOSDAQ: 'KOSDAQ',
  NAS: 'NASDAQ',
  NYS: 'NYSE',
  AMS: 'AMEX',
}

export function marketLabel(market: Market): string {
  return MARKET_LABELS[market]
}
