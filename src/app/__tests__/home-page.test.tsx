import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HomePage from '@/app/page'
import { CartProvider } from '@/components/CartProvider'

// next/link는 App Router 컨텍스트를 요구한다. 테스트에서는 평범한 <a>로 바꾼다.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}))

function stubApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('/api/search')) {
        return new Response(
          JSON.stringify({ stocks: [{ code: '005930', name: '삼성전자', market: 'KOSPI' }] }),
          { status: 200 },
        )
      }
      return new Response(
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
          stale: false,
        }),
        { status: 200 },
      )
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
  stubApi()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderHome() {
  return render(
    <CartProvider>
      <HomePage />
    </CartProvider>,
  )
}

describe('검색 화면', () => {
  it('검색창을 보여준다', () => {
    renderHome()
    expect(screen.getByRole('searchbox', { name: /종목 검색/ })).toBeInTheDocument()
  })

  it('검색어를 입력하면 상품 카드가 뜬다', async () => {
    renderHome()
    await userEvent.type(screen.getByRole('searchbox', { name: /종목 검색/ }), '삼성')

    expect(await screen.findByText('삼성전자')).toBeInTheDocument()
    expect(await screen.findByText('61,200원')).toBeInTheDocument()
  })

  it('담으면 장바구니 개수가 늘어난다', async () => {
    renderHome()
    await userEvent.type(screen.getByRole('searchbox', { name: /종목 검색/ }), '삼성')
    await userEvent.click(await screen.findByRole('button', { name: '담기' }))

    expect(await screen.findByText(/장바구니에 1주 담겨 있습니다/)).toBeInTheDocument()
  })

  it('검색 전에는 안내 문구를 보여준다', () => {
    renderHome()
    expect(screen.getByText(/종목명이나 코드를 검색해보세요/)).toBeInTheDocument()
  })

  it('일치하는 종목이 없으면 없다고 말한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ stocks: [] }), { status: 200 })),
    )
    renderHome()
    await userEvent.type(screen.getByRole('searchbox', { name: /종목 검색/ }), '없는종목')

    expect(await screen.findByText(/일치하는 종목이 없습니다/)).toBeInTheDocument()
  })

  it('검색이 실패하면 종목이 없다고 말하지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
    renderHome()
    await userEvent.type(screen.getByRole('searchbox', { name: /종목 검색/ }), '삼성')

    expect(await screen.findByText(/검색에 실패했습니다/)).toBeInTheDocument()
    expect(screen.queryByText(/일치하는 종목이 없습니다/)).not.toBeInTheDocument()
  })
})
