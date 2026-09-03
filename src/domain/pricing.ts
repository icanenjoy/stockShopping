import type { Quote, CartItem } from './types'

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
