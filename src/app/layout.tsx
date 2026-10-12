import type { Metadata } from 'next'
import './globals.css'
import { CartProvider } from '@/components/CartProvider'
import { SiteHeader } from '@/components/SiteHeader'

export const metadata: Metadata = {
  title: '주식 쇼핑',
  description: '주식을 장바구니에 담아 총액을 확인하는 시뮬레이터',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <CartProvider>
          <SiteHeader />
          <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        </CartProvider>
      </body>
    </html>
  )
}
