import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StockCard } from '@/components/StockCard'
import type { Quote, StockSummary } from '@/domain/types'

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

function stock(over: Partial<StockSummary> = {}): StockSummary {
  return { code: '005930', name: '삼성전자', market: 'KOSPI', currency: 'KRW', ...over }
}

describe('StockCard', () => {
  it('종목명과 현재가를 보여준다', () => {
    render(<StockCard stock={stock()} quote={quote()} onAdd={vi.fn()} />)

    expect(screen.getByText('삼성전자')).toBeInTheDocument()
    expect(screen.getByText('61,200원')).toBeInTheDocument()
  })

  it('52주 최고가를 정가로 보여주고 할인율을 배지로 띄운다', () => {
    render(<StockCard stock={stock()} quote={quote()} onAdd={vi.fn()} />)

    expect(screen.getByText('85,000원')).toBeInTheDocument()
    expect(screen.getByText('28% OFF')).toBeInTheDocument()
  })

  it('할인이 없으면 정가와 할인 배지를 숨긴다', () => {
    render(<StockCard stock={stock()} quote={quote({ price: 85000 })} onAdd={vi.fn()} />)

    expect(screen.queryByText(/OFF/)).not.toBeInTheDocument()
  })

  it('전일 대비 하락이면 세일 배지를 띄운다', () => {
    render(<StockCard stock={stock()} quote={quote()} onAdd={vi.fn()} />)

    expect(screen.getByText(/세일중/)).toBeInTheDocument()
  })

  it('전일 대비 상승이면 가격인상 배지를 띄운다', () => {
    render(<StockCard stock={stock()} quote={quote({ price: 63000 })} onAdd={vi.fn()} />)

    expect(screen.getByText(/가격인상/)).toBeInTheDocument()
  })

  it('정가 기준을 명시한다', () => {
    render(<StockCard stock={stock()} quote={quote()} onAdd={vi.fn()} />)

    expect(screen.getByText(/정가는 52주 최고가 기준/)).toBeInTheDocument()
  })

  it('수량을 정해 담으면 코드·수량·현재가를 넘긴다', async () => {
    const onAdd = vi.fn()
    render(<StockCard stock={stock()} quote={quote()} onAdd={onAdd} />)

    await userEvent.click(screen.getByLabelText('삼성전자 수량 늘리기'))
    await userEvent.click(screen.getByRole('button', { name: '담기' }))

    expect(onAdd).toHaveBeenCalledWith('005930', 2, 61200, 'KRW')
  })

  it('수량은 1 아래로 내려가지 않는다', async () => {
    render(<StockCard stock={stock()} quote={quote()} onAdd={vi.fn()} />)

    await userEvent.click(screen.getByLabelText('삼성전자 수량 줄이기'))
    expect(screen.getByLabelText('삼성전자 수량')).toHaveTextContent('1')
  })

  it('거래정지 종목은 담을 수 없다', () => {
    render(<StockCard stock={stock()} quote={quote({ tradingHalted: true })} onAdd={vi.fn()} />)

    expect(screen.getByRole('button', { name: '거래정지' })).toBeDisabled()
  })
})

describe('StockCard — 미국 종목', () => {
  const apple = stock({
    code: 'AAPL',
    name: '애플',
    englishName: 'APPLE INC',
    market: 'NAS',
    currency: 'USD',
  })
  const appleQuote = quote({
    code: 'AAPL',
    name: '애플',
    price: 328.21,
    prevClose: 324.96,
    high52w: 344.27,
    currency: 'USD',
  })

  it('달러로 표기한다 — 원으로 쓰면 258,000원짜리 삼성전자와 나란히 놓여 오독된다', () => {
    render(<StockCard stock={apple} quote={appleQuote} onAdd={vi.fn()} />)

    expect(screen.getByText('$328.21')).toBeInTheDocument()
    expect(screen.getByText('$344.27')).toBeInTheDocument()
  })

  it('거래소를 배지로 보여준다 — 통합 검색이라 국내와 섞여 나온다', () => {
    render(<StockCard stock={apple} quote={appleQuote} onAdd={vi.fn()} />)
    expect(screen.getByText('NASDAQ')).toBeInTheDocument()
  })

  it('국내 종목에는 그 시장을 보여준다', () => {
    render(<StockCard stock={stock()} quote={quote()} onAdd={vi.fn()} />)
    expect(screen.getByText('KOSPI')).toBeInTheDocument()
  })

  it('담을 때 통화를 함께 넘긴다 — 통화를 모르면 어느 탭에 넣을지 알 수 없다', async () => {
    const onAdd = vi.fn()
    render(<StockCard stock={apple} quote={appleQuote} onAdd={onAdd} />)
    await userEvent.click(screen.getByRole('button', { name: '담기' }))

    expect(onAdd).toHaveBeenCalledWith('AAPL', 1, 328.21, 'USD')
  })
})
