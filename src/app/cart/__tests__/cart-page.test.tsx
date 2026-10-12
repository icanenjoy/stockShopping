import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CartPage from '@/app/cart/page'
import { CartProvider } from '@/components/CartProvider'
import { CART_STORAGE_KEY } from '@/hooks/useCart'

// next/link는 App Router 컨텍스트를 요구한다. 테스트에서는 평범한 <a>로 바꾼다.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}))

type SeedItem = { code: string; qty: number; addedPrice: number }

function seedCart(items: SeedItem[] = [{ code: '005930', qty: 2, addedPrice: 60000 }]) {
  localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify(items.map((i) => ({ ...i, addedAt: '2026-09-03T04:00:00.000Z' }))),
  )
}

const SAMSUNG = {
  code: '005930',
  name: '삼성전자',
  price: 61200,
  prevClose: 62600,
  high52w: 85000,
  tradingHalted: false,
  currency: 'KRW',
  asOf: '2026-09-03T05:00:00.000Z',
}

const HYNIX = {
  code: '000660',
  name: 'SK하이닉스',
  price: 200000,
  prevClose: 198000,
  high52w: 260000,
  tradingHalted: false,
  currency: 'KRW',
  asOf: '2026-09-03T05:00:00.000Z',
}

/** 응답 본문을 직접 정하고 싶을 때 쓴다 */
function stubQuotesBody(quotes: unknown[], stale = false) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ quotes, stale }), { status: 200 })),
  )
}

function stubQuotes(stale = false) {
  stubQuotesBody([SAMSUNG], stale)
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderCart() {
  return render(
    <CartProvider>
      <CartPage />
    </CartProvider>,
  )
}

describe('장바구니 화면', () => {
  it('비어 있으면 안내를 보여준다', () => {
    stubQuotes()
    renderCart()
    expect(screen.getByText(/장바구니가 비어 있습니다/)).toBeInTheDocument()
  })

  it('담긴 종목과 소계를 보여준다', async () => {
    seedCart()
    stubQuotes()
    renderCart()

    expect(await screen.findByText('삼성전자')).toBeInTheDocument()
    expect(await screen.findByTestId('subtotal-005930')).toHaveTextContent('122,400원')
  })

  it('현재가 기준 총액을 보여준다', async () => {
    seedCart()
    stubQuotes()
    renderCart()

    await waitFor(() =>
      expect(screen.getByTestId('cart-total')).toHaveTextContent('122,400원'),
    )
  })

  it('담은 뒤 변동률을 보여준다', async () => {
    seedCart()
    stubQuotes()
    renderCart()

    expect(await screen.findByText(/담은 뒤 \+2.0%/)).toBeInTheDocument()
  })

  it('수량을 늘리면 총액이 따라 변한다', async () => {
    seedCart()
    stubQuotes()
    renderCart()

    await screen.findByText('삼성전자')
    await userEvent.click(screen.getByLabelText('삼성전자 수량 늘리기'))

    expect(screen.getByTestId('cart-total')).toHaveTextContent('183,600원')
  })

  it('종목을 뺄 수 있다', async () => {
    seedCart()
    stubQuotes()
    renderCart()

    await screen.findByText('삼성전자')
    await userEvent.click(screen.getByRole('button', { name: '삼성전자 빼기' }))

    expect(screen.getByText(/장바구니가 비어 있습니다/)).toBeInTheDocument()
  })

  it('시세가 지연되면 배너를 띄우고 총액은 그대로 보여준다', async () => {
    seedCart()
    stubQuotes(true)
    renderCart()

    expect(await screen.findByText(/시세 지연/)).toBeInTheDocument()
    expect(screen.getByTestId('cart-total')).toHaveTextContent('122,400원')
    expect(screen.queryByText(/시세를 가져오지 못했습니다/)).not.toBeInTheDocument()
  })

  it('조회에 실패해도 직전 총액을 지우지 않고 지연을 알린다', async () => {
    seedCart([
      { code: '005930', qty: 2, addedPrice: 60000 },
      { code: '000660', qty: 1, addedPrice: 190000 },
    ])
    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1
        if (call === 1) {
          return new Response(JSON.stringify({ quotes: [SAMSUNG, HYNIX], stale: false }), {
            status: 200,
          })
        }
        throw new Error('offline')
      }),
    )
    renderCart()

    await waitFor(() =>
      expect(screen.getByTestId('cart-total')).toHaveTextContent('322,400원'),
    )

    // 종목을 빼면 코드 목록이 바뀌어 재조회가 나가고, 그 조회가 실패한다
    await userEvent.click(screen.getByRole('button', { name: 'SK하이닉스 빼기' }))

    expect(await screen.findByText(/시세 지연/)).toBeInTheDocument()
    expect(screen.getByTestId('cart-total')).toHaveTextContent('122,400원')
  })

  it('시세를 하나도 못 가져오면 0원 대신 못 가져왔다고 말한다', async () => {
    seedCart()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    renderCart()

    expect(await screen.findByRole('status')).toHaveTextContent(
      '시세를 가져오지 못했습니다 — 총액을 계산할 수 없습니다',
    )

    const total = screen.getByTestId('cart-total')
    expect(total).not.toHaveTextContent('0원')
    expect(total).toHaveTextContent('시세 없음')
  })

  it('응답에 빠진 종목은 제외 사실을 행과 총액 양쪽에 표시한다', async () => {
    seedCart([
      { code: '005930', qty: 2, addedPrice: 60000 },
      { code: '000660', qty: 1, addedPrice: 190000 },
    ])
    stubQuotesBody([SAMSUNG])
    renderCart()

    await waitFor(() =>
      expect(screen.getByTestId('cart-total')).toHaveTextContent('122,400원'),
    )
    // 총액 옆: 몇 개가 빠졌는지
    expect(screen.getByTestId('cart-unpriced')).toHaveTextContent(
      '1개 종목 시세 없음 · 총액에서 제외했습니다',
    )
    // 행: 로딩이 아니라 제외됐다고 말한다
    expect(
      screen.getByText('시세를 가져오지 못했습니다 — 총액에서 제외했습니다'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/시세 조회 중…/)).not.toBeInTheDocument()
  })

  it('거래정지 종목은 경고와 함께 남기되 총액에서 뺀다', async () => {
    seedCart([
      { code: '005930', qty: 2, addedPrice: 60000 },
      { code: '000660', qty: 1, addedPrice: 190000 },
    ])
    stubQuotesBody([SAMSUNG, { ...HYNIX, tradingHalted: true }])
    renderCart()

    expect(await screen.findByText('거래정지 — 총액에서 제외했습니다')).toBeInTheDocument()
    expect(screen.getByText('SK하이닉스')).toBeInTheDocument()
    // 200,000원이 더해졌다면 322,400원이 됐을 것이다
    expect(screen.getByTestId('cart-total')).toHaveTextContent('122,400원')
  })

  it('전 종목이 거래정지면 0원 대신 이유를 말한다', async () => {
    seedCart()
    stubQuotesBody([{ ...SAMSUNG, tradingHalted: true }])
    renderCart()

    const total = await screen.findByTestId('cart-total')
    await waitFor(() => expect(total).toHaveTextContent(/거래정지/))
    expect(total).not.toHaveTextContent('0원')
  })
})

describe('장바구니 화면 — 통화별 탭', () => {
  const APPLE = {
    code: 'AAPL',
    name: '애플',
    price: 328.21,
    prevClose: 324.96,
    high52w: 344.27,
    tradingHalted: false,
    currency: 'USD',
    asOf: '2026-09-04T05:00:00.000Z',
  }

  function seedMixed() {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([
        { code: '005930', qty: 2, addedPrice: 60000, currency: 'KRW', addedAt: '2026-09-03T04:00:00.000Z' },
        { code: 'AAPL', qty: 3, addedPrice: 320, currency: 'USD', addedAt: '2026-09-03T04:00:00.000Z' },
      ]),
    )
  }

  it('통화가 섞이면 탭으로 나눈다', async () => {
    seedMixed()
    stubQuotesBody([SAMSUNG, APPLE])
    render(
      <CartProvider>
        <CartPage />
      </CartProvider>,
    )

    expect(await screen.findByRole('tab', { name: /원화/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /미국달러/ })).toBeInTheDocument()
  })

  it('원화 탭이 먼저 열리고 원화 총액만 보여준다 — 달러를 더하면 뜻 없는 숫자가 된다', async () => {
    seedMixed()
    stubQuotesBody([SAMSUNG, APPLE])
    render(
      <CartProvider>
        <CartPage />
      </CartProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('cart-total')).toHaveTextContent('122,400원'),
    )
    expect(screen.getByText('삼성전자')).toBeInTheDocument()
    expect(screen.queryByText('애플')).not.toBeInTheDocument()
  })

  it('달러 탭을 누르면 달러 총액으로 바뀐다', async () => {
    seedMixed()
    stubQuotesBody([SAMSUNG, APPLE])
    render(
      <CartProvider>
        <CartPage />
      </CartProvider>,
    )

    await userEvent.click(await screen.findByRole('tab', { name: /미국달러/ }))

    await waitFor(() => expect(screen.getByTestId('cart-total')).toHaveTextContent('$984.63'))
    expect(screen.getByText('애플')).toBeInTheDocument()
    expect(screen.queryByText('삼성전자')).not.toBeInTheDocument()
  })

  it('다른 탭에 무엇이 남아 있는지 알려준다 — 탭만 있으면 총액이 전부인 줄 안다', async () => {
    seedMixed()
    stubQuotesBody([SAMSUNG, APPLE])
    render(
      <CartProvider>
        <CartPage />
      </CartProvider>,
    )

    expect(await screen.findByText(/통화가 다르면 총액을 합치지 않습니다/)).toBeInTheDocument()
  })

  it('한 통화만 담겼으면 탭을 만들지 않는다 — 원화만 담은 사람에게 탭은 소음이다', async () => {
    seedCart()
    stubQuotes()
    render(
      <CartProvider>
        <CartPage />
      </CartProvider>,
    )

    await screen.findByTestId('cart-total')
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })
})
