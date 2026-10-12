import { describe, it, expect } from 'vitest'
import { searchStocks } from '@/domain/search'
import { STOCK_MASTER } from '@/data/stocks'
import type { StockSummary } from '@/domain/types'

const master: StockSummary[] = [
  { code: '005930', name: '삼성전자', market: 'KOSPI', currency: 'KRW' },
  { code: '006400', name: '삼성SDI', market: 'KOSPI', currency: 'KRW' },
  { code: '028260', name: '삼성물산', market: 'KOSPI', currency: 'KRW' },
  { code: '000660', name: 'SK하이닉스', market: 'KOSPI', currency: 'KRW' },
  { code: '035420', name: 'NAVER', market: 'KOSPI', currency: 'KRW' },
  { code: 'AAPL', name: '애플', englishName: 'APPLE INC', market: 'NAS', currency: 'USD' },
  { code: 'AAPB', name: '그래닛셰어즈 애플 2X', englishName: 'GRANITESHARES 2X LONG AAPL', market: 'NAS', currency: 'USD' },
  { code: 'KO', name: '코카콜라', englishName: 'COCA-COLA CO', market: 'NYS', currency: 'USD' },
]

describe('searchStocks', () => {
  it('빈 질의는 빈 배열을 반환한다', () => {
    expect(searchStocks(master, '')).toEqual([])
    expect(searchStocks(master, '   ')).toEqual([])
  })

  it('종목명 일부로 찾는다', () => {
    const names = searchStocks(master, '삼성').map((s) => s.name)
    expect(names).toEqual(['삼성전자', '삼성SDI', '삼성물산'])
  })

  it('종목코드로 찾는다', () => {
    expect(searchStocks(master, '005930')[0].name).toBe('삼성전자')
  })

  it('영문 종목명은 대소문자를 가리지 않는다', () => {
    expect(searchStocks(master, 'naver')[0].code).toBe('035420')
  })

  it('종목명 중간에 있는 문자열로도 찾는다', () => {
    expect(searchStocks(master, 'SDI').map((s) => s.code)).toEqual(['006400'])
  })

  it('앞뒤 공백을 무시한다', () => {
    expect(searchStocks(master, '  삼성전자  ')[0].code).toBe('005930')
  })

  it('결과 개수를 limit으로 제한한다', () => {
    expect(searchStocks(master, '삼성', 2)).toHaveLength(2)
  })

  it('일치하는 게 없으면 빈 배열이다', () => {
    expect(searchStocks(master, '없는종목명')).toEqual([])
  })

  describe('해외 종목', () => {
    it('한글명으로 미국 종목을 찾는다 — 마스터가 한글명을 준다', () => {
      expect(searchStocks(master, '애플')[0].code).toBe('AAPL')
    })

    it('영문명으로도 찾는다', () => {
      expect(searchStocks(master, 'apple').map((s) => s.code)).toContain('AAPL')
    })

    it('티커로 찾는다', () => {
      expect(searchStocks(master, 'AAPL')[0].code).toBe('AAPL')
    })

    it('티커는 소문자로 쳐도 찾는다', () => {
      expect(searchStocks(master, 'aapl')[0].code).toBe('AAPL')
    })
  })

  describe('순위', () => {
    it('티커가 정확히 일치하면 최상단이다 — KO는 다른 종목명에 흔히 들어간다', () => {
      expect(searchStocks(master, 'KO')[0].code).toBe('KO')
    })

    it('종목명이 정확히 일치하면 부분 일치보다 앞선다', () => {
      expect(searchStocks(master, '애플')[0].code).toBe('AAPL')
    })

    it('전방 일치가 부분 일치보다 앞선다', () => {
      const codes = searchStocks(master, '삼성').map((s) => s.code)
      expect(codes.indexOf('005930')).toBeLessThan(codes.indexOf('028260'))
    })
  })

  describe('실제 마스터', () => {
    it('국내 종목을 찾는다', () => {
      expect(searchStocks(STOCK_MASTER, '삼성전자')[0].code).toBe('005930')
    })

    it('미국 종목을 한글명으로 찾는다', () => {
      expect(searchStocks(STOCK_MASTER, '테슬라')[0].code).toBe('TSLA')
    })

    it('하드코딩 30종목을 넘어선다', () => {
      expect(STOCK_MASTER.length).toBeGreaterThan(9000)
    })
  })
})
