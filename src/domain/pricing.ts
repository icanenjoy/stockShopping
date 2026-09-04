import type { Quote, CartItem, Currency } from './types'

/** 정가(52주 최고가) 대비 할인율. 0.28 = 28% 할인 */
export function discountFromHigh(price: number, high52w: number): number {
  if (high52w <= 0) return 0
  const rate = (high52w - price) / high52w
  return rate > 0 ? rate : 0
}

/** 전일 종가 대비 등락률. 음수는 하락(= 세일) */
export function changeFromPrevClose(price: number, prevClose: number): number {
  if (prevClose <= 0) return 0
  return (price - prevClose) / prevClose
}

/** 장바구니에 담던 시점 가격 대비 변동률 */
export function changeSinceAdded(price: number, addedPrice: number): number {
  if (addedPrice <= 0) return 0
  return (price - addedPrice) / addedPrice
}

/** 한 행의 소계. 거래정지 종목은 금액을 매기지 않는다 */
export function lineSubtotal(quote: Quote, qty: number): number {
  if (quote.tradingHalted) return 0
  return quote.price * qty
}

/** 장바구니 총액. 시세가 없거나 거래정지인 종목은 제외한다 */
export function cartTotal(items: CartItem[], quotes: Record<string, Quote>): number {
  return items.reduce((sum, item) => {
    const quote = quotes[item.code]
    if (!quote) return sum
    return sum + lineSubtotal(quote, item.qty)
  }, 0)
}

/** 한 통화에 속한 장바구니 항목들과 그 총액 */
export interface CurrencyGroup {
  currency: Currency
  items: CartItem[]
  total: number
  /** 총액에 실제로 더해진 종목 수. 거래정지는 시세가 있어도 더해지지 않는다 */
  countedCount: number
  /** 시세를 못 가져와 총액에서 빠진 종목 수 */
  unpricedCount: number
}

/** 탭 순서. 매번 담긴 순서를 따르면 탭 위치가 흔들려 잘못 누르게 된다 */
const CURRENCY_ORDER: Currency[] = ['KRW', 'USD']

/**
 * 장바구니를 통화별로 나눠 각각의 총액을 낸다.
 *
 * 통화가 다른 금액을 하나로 더하면 아무 뜻도 없는 숫자가 나온다. 환율로 환산해
 * 합칠 수도 있지만, 그러면 "지금 얼마인가"의 답이 환율 시점에 묶인다.
 * 항목이 없는 통화는 탭을 만들지 않는다.
 */
export function groupCartByCurrency(
  items: CartItem[],
  quotes: Record<string, Quote>,
): CurrencyGroup[] {
  return CURRENCY_ORDER.flatMap((currency) => {
    const group = items.filter((item) => item.currency === currency)
    if (group.length === 0) return []

    const priced = group.filter((item) => quotes[item.code] !== undefined)
    return [
      {
        currency,
        items: group,
        total: cartTotal(group, quotes),
        countedCount: priced.filter((item) => !quotes[item.code].tradingHalted).length,
        unpricedCount: group.length - priced.length,
      },
    ]
  })
}
