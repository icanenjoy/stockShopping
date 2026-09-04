import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

function seedCart() {
  localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify([
      { code: '005930', qty: 2, addedPrice: 60000, addedAt: '2026-09-03T04:00:00.000Z' },
    ]),
  )
}

function stubQuotes(stale = false) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          quotes: [
            {
              code: '005930',
              name: '삼성전자',
              price: 61200,
              prevClose: 62600,
              high52w: 85000,
              tradingHalted: false,
              asOf: '2026-09-03T05:00:00.000Z',
            },
          ],
          stale,
        }),
        { status: 200 },
      ),
    ),
  )
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

    const total = await screen.findByTestId('cart-total')
    expect(total).toHaveTextContent('122,400원')
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
  })
})
