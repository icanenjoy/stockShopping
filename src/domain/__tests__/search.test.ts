import { describe, it, expect } from 'vitest'
import { searchStocks } from '@/domain/search'
import { STOCK_MASTER } from '@/data/stocks'
import type { StockSummary } from '@/domain/types'

const master: StockSummary[] = [
  { code: '005930', name: '삼성전자', market: 'KOSPI' },
  { code: '006400', name: '삼성SDI', market: 'KOSPI' },
  { code: '028260', name: '삼성물산', market: 'KOSPI' },
  { code: '000660', name: 'SK하이닉스', market: 'KOSPI' },
  { code: '035420', name: 'NAVER', market: 'KOSPI' },
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

  it('실제 종목 마스터에서도 동작한다', () => {
    expect(searchStocks(STOCK_MASTER, '에코프로').length).toBeGreaterThanOrEqual(2)
  })
})
