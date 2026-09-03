const KST_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const OPEN_MINUTES = 9 * 60       // 09:00
const CLOSE_MINUTES = 15 * 60 + 30 // 15:30
const WEEKEND = new Set(['Sat', 'Sun'])

/** 한국 주식시장 정규장(평일 09:00~15:30 KST) 운영 여부. 공휴일은 판정하지 않는다 */
export function isMarketOpen(now: Date): boolean {
  const parts = KST_FORMATTER.formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''

  const weekday = get('weekday')
  if (WEEKEND.has(weekday)) return false

  const minutes = Number(get('hour')) * 60 + Number(get('minute'))
  return minutes >= OPEN_MINUTES && minutes < CLOSE_MINUTES
}
