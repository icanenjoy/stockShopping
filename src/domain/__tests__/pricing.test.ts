import { describe, it, expect } from 'vitest'
import {
  discountFromHigh,
  changeFromPrevClose,
  changeSinceAdded,
  lineSubtotal,
  cartTotal,
  groupCartByCurrency,
} from '@/domain/pricing'
import type { Quote, CartItem } from '@/domain/types'

function quote(over: Partial<Quote> = {}): Quote {
  return {
    code: '005930',
    name: '삼성전자',
    price: 61200,
    prevClose: 62600,
    high52w: 85000,
    tradingHalted: false,
    currency: 'KRW',
    asOf: '2026-09-03T05:00:00.000Z',
    ...over,
  }
}

describe('discountFromHigh', () => {
  it('52주 최고가 대비 할인율을 소수로 반환한다', () => {
    expect(discountFromHigh(61200, 85000)).toBeCloseTo(0.28, 4)
  })

  it('현재가가 최고가와 같으면 0이다', () => {
    expect(discountFromHigh(85000, 85000)).toBe(0)
  })

  it('현재가가 최고가를 넘으면 0으로 깎는다 (음수 할인은 없다)', () => {
    expect(discountFromHigh(90000, 85000)).toBe(0)
  })

  it('최고가가 0 이하이면 0이다', () => {
    expect(discountFromHigh(61200, 0)).toBe(0)
    expect(discountFromHigh(61200, -1)).toBe(0)
  })
})

describe('changeFromPrevClose', () => {
  it('하락이면 음수를 반환한다', () => {
    expect(changeFromPrevClose(61200, 62600)).toBeCloseTo(-0.02236, 5)
  })

  it('상승이면 양수를 반환한다', () => {
    expect(changeFromPrevClose(63000, 62600)).toBeCloseTo(0.00639, 5)
  })

  it('전일 종가가 0 이하이면 0이다', () => {
    expect(changeFromPrevClose(61200, 0)).toBe(0)
  })
})

describe('changeSinceAdded', () => {
  it('담은 뒤 오르면 양수다', () => {
    expect(changeSinceAdded(62000, 61200)).toBeCloseTo(0.01307, 5)
  })

  it('담은 가격이 0 이하이면 0이다', () => {
    expect(changeSinceAdded(62000, 0)).toBe(0)
  })
})

describe('lineSubtotal', () => {
  it('현재가 × 수량이다', () => {
    expect(lineSubtotal(quote(), 3)).toBe(183600)
  })

  it('수량이 0이면 0이다', () => {
    expect(lineSubtotal(quote(), 0)).toBe(0)
  })

  it('거래정지 종목은 0이다', () => {
    expect(lineSubtotal(quote({ tradingHalted: true }), 3)).toBe(0)
  })
})

describe('cartTotal', () => {
  const items: CartItem[] = [
    { code: '005930', qty: 2, addedPrice: 61000, currency: 'KRW', addedAt: '2026-09-03T04:00:00.000Z' },
    { code: '000660', qty: 1, addedPrice: 200000, currency: 'KRW', addedAt: '2026-09-03T04:00:00.000Z' },
  ]

  it('모든 행의 소계를 더한다', () => {
    const quotes = {
      '005930': quote({ price: 61200 }),
      '000660': quote({ code: '000660', name: 'SK하이닉스', price: 205000 }),
    }
    expect(cartTotal(items, quotes)).toBe(61200 * 2 + 205000)
  })

  it('시세를 못 가져온 종목은 총액에서 제외한다', () => {
    const quotes = { '005930': quote({ price: 61200 }) }
    expect(cartTotal(items, quotes)).toBe(122400)
  })

  it('거래정지 종목은 총액에서 제외한다', () => {
    const quotes = {
      '005930': quote({ price: 61200 }),
      '000660': quote({ code: '000660', price: 205000, tradingHalted: true }),
    }
    expect(cartTotal(items, quotes)).toBe(122400)
  })

  it('빈 장바구니는 0이다', () => {
    expect(cartTotal([], {})).toBe(0)
  })
})

describe('groupCartByCurrency', () => {
  const krw: CartItem[] = [
    { code: '005930', qty: 2, addedPrice: 61000, currency: 'KRW', addedAt: '2026-09-03T04:00:00.000Z' },
    { code: '000660', qty: 1, addedPrice: 200000, currency: 'KRW', addedAt: '2026-09-03T04:00:00.000Z' },
  ]
  const usd: CartItem[] = [
    { code: 'AAPL', qty: 3, addedPrice: 320, currency: 'USD', addedAt: '2026-09-03T04:00:00.000Z' },
  ]
  const quotes = {
    '005930': quote({ price: 61200 }),
    '000660': quote({ code: '000660', name: 'SK하이닉스', price: 205000 }),
    AAPL: quote({ code: 'AAPL', name: '애플', price: 328.21, currency: 'USD' }),
  }

  it('통화별로 나눠 각각의 총액을 낸다 — 원화와 달러를 더하면 아무 뜻도 없는 숫자가 된다', () => {
    const groups = groupCartByCurrency([...krw, ...usd], quotes)
    expect(groups.map((g) => g.currency)).toEqual(['KRW', 'USD'])
    expect(groups[0].total).toBe(61200 * 2 + 205000)
    expect(groups[1].total).toBeCloseTo(328.21 * 3, 6)
  })

  it('담은 순서가 섞여 있어도 통화별로 모은다', () => {
    const groups = groupCartByCurrency([krw[0], usd[0], krw[1]], quotes)
    expect(groups.map((g) => g.items.map((i) => i.code))).toEqual([['005930', '000660'], ['AAPL']])
  })

  it('원화는 달러보다 앞에 온다 — 탭 순서가 매번 달라지면 안 된다', () => {
    expect(groupCartByCurrency([...usd, ...krw], quotes).map((g) => g.currency)).toEqual([
      'KRW',
      'USD',
    ])
  })

  it('항목이 없는 통화는 탭 자체를 만들지 않는다', () => {
    expect(groupCartByCurrency(krw, quotes).map((g) => g.currency)).toEqual(['KRW'])
  })

  it('통화별로 시세 없는 종목 수를 따로 센다', () => {
    const partial = { '005930': quote({ price: 61200 }) }
    const groups = groupCartByCurrency([...krw, ...usd], partial)
    expect(groups[0].unpricedCount).toBe(1)
    expect(groups[1].unpricedCount).toBe(1)
  })

  it('거래정지는 시세는 있으므로 총액에서만 빠지고 시세 없음으로 세지 않는다', () => {
    const halted = { ...quotes, '000660': quote({ code: '000660', price: 205000, tradingHalted: true }) }
    const groups = groupCartByCurrency(krw, halted)
    expect(groups[0].total).toBe(122400)
    expect(groups[0].unpricedCount).toBe(0)
    expect(groups[0].countedCount).toBe(1)
  })

  it('빈 장바구니는 빈 배열이다', () => {
    expect(groupCartByCurrency([], {})).toEqual([])
  })
})
