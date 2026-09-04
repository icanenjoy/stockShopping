import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CartProvider, useCartContext } from '@/components/CartProvider'

beforeEach(() => {
  localStorage.clear()
})

function Adder() {
  const cart = useCartContext()
  return (
    <button type="button" onClick={() => cart.add('005930', 1, 61200)}>
      담기
    </button>
  )
}

function Counter() {
  const cart = useCartContext()
  return <span data-testid="count">{cart.items.length}</span>
}

describe('CartProvider', () => {
  it('여러 컴포넌트가 같은 장바구니 상태를 본다', async () => {
    render(
      <CartProvider>
        <Adder />
        <Counter />
      </CartProvider>,
    )

    expect(screen.getByTestId('count')).toHaveTextContent('0')
    await userEvent.click(screen.getByRole('button', { name: '담기' }))
    expect(screen.getByTestId('count')).toHaveTextContent('1')
  })

  it('Provider 밖에서 쓰면 에러를 던진다', () => {
    expect(() => render(<Counter />)).toThrow(/CartProvider/)
  })
})
