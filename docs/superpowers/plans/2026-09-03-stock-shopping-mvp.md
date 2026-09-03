# stockShopping MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 국내 주식을 검색해 장바구니에 담고, 수량을 정하고, 현재가 기준 총액을 확인하는 쇼핑몰형 시뮬레이터를 만든다.

**Architecture:** Next.js App Router 단일 저장소. 브라우저는 `/api/search`, `/api/quotes`만 호출하고, Route Handler가 KIS 접근토큰 관리·캐싱·시세 조회를 담당한다. 시세 소스는 `PriceProvider` 인터페이스 뒤에 숨겨 `MockProvider`(개발용)와 `KisKrxProvider`(실제)를 교체할 수 있게 한다. 가격 계산은 전부 부수효과 없는 순수 함수로 격리한다.

**Tech Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Vitest · @testing-library/react

**Spec:** `docs/superpowers/specs/2026-09-03-stock-shopping-design.md`

## Global Constraints

- Node.js 20 이상.
- TypeScript `strict: true`. `any` 금지.
- 앱키·시크릿(`KIS_APP_KEY`, `KIS_APP_SECRET`)은 **서버 전용 환경변수**다. `NEXT_PUBLIC_` 접두사를 붙이지 않는다. 클라이언트 코드에서 `process.env`로 읽지 않는다.
- 등락률·할인율은 **소수(fraction)** 로 반환한다. `0.283`은 28.3%를 뜻한다. 퍼센트 변환과 반올림은 UI에서만 한다.
- 금액은 원 단위 정수로 다룬다. 소수점 금액을 만들지 않는다.
- 상태 관리 라이브러리(Redux, Zustand 등)를 추가하지 않는다. React 훅으로 충분하다.
- `src/domain`·`src/providers`·`src/server`에서 시간에 의존하는 모듈은 `now: () => number`를, 네트워크에 의존하는 모듈은 `fetchFn: typeof fetch`를 생성자로 주입받는다. 이 계층의 테스트에서는 전역을 monkey-patch 하지 않는다.
- 예외: React 훅과 화면 테스트는 `vi.stubGlobal('fetch', ...)`를 쓴다. 훅이 브라우저 전역 `fetch`를 쓰는 편이 자연스럽고, 주입 인자를 만들면 호출부만 번거로워진다.
- 커밋 메시지는 Conventional Commits(`feat:`, `test:`, `chore:`)를 쓴다.

## File Structure

```
src/
  domain/
    types.ts          도메인 타입 (StockSummary, Quote, CartItem)
    pricing.ts        할인율·등락률·소계·총액 순수 함수
    market.ts         장 운영 시간 판정
    search.ts         종목 마스터 로컬 검색
  data/
    stocks.ts         종목 마스터 (코드·종목명·시장)
  providers/
    PriceProvider.ts  인터페이스
    MockProvider.ts   개발·테스트용 구현체
    KisTokenManager.ts  KIS 접근토큰 발급·캐싱·갱신
    KisKrxProvider.ts   KIS 국내주식 시세 구현체
  server/
    QuoteCache.ts     TTL 캐시 + 동시 요청 수렴 + stale 폴백
    provider.ts       환경변수에 따라 Provider를 고르는 팩토리(싱글턴)
  app/
    api/search/route.ts
    api/quotes/route.ts
    page.tsx          검색 화면
    cart/page.tsx     장바구니 화면
  hooks/
    useCart.ts        장바구니 상태 + localStorage 동기화
    useQuotes.ts      시세 조회 + 폴링 + 지연 상태
  components/
    StockCard.tsx     상품 카드 (정가 취소선 · 할인 배지)
    QtyStepper.tsx    수량 스테퍼
    PriceBadge.tsx    세일 / 가격 인상 배지
```

**의존 방향은 한 방향이다.** `domain`은 아무것도 의존하지 않는다. `providers`는 `domain`을 의존한다. `server`는 `providers`를 의존한다. `app`·`hooks`·`components`는 `server`를 직접 의존하지 않고 HTTP로만 접근한다.

---

### Task 1: 프로젝트 초기화와 테스트 환경

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx` (create-next-app 생성)
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Test: `src/domain/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `npm test`로 Vitest를 실행할 수 있는 환경. 경로 별칭 `@/*` → `src/*`.

- [ ] **Step 1: Next.js 프로젝트 생성**

저장소 루트에서 실행한다. `README.md`·`.gitignore`·`docs/`·`.git`은 create-next-app이 허용하는 파일이라 충돌하지 않는다.

```bash
npx create-next-app@latest . --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --no-turbopack --use-npm
```

충돌로 거부되면 `README.md`를 잠시 다른 이름으로 옮기고 실행한 뒤 되돌린다.

- [ ] **Step 2: 테스트 도구 설치**

```bash
npm install -D vitest @vitejs/plugin-react jsdom vite-tsconfig-paths \
  @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Vitest 설정 파일 작성**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

`vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: 테스트 스크립트 추가**

`package.json`의 `scripts`에 두 줄을 추가한다.

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: 스모크 테스트 작성**

`src/domain/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('테스트 환경', () => {
  it('실행된다', () => {
    expect(1 + 1).toBe(2)
  })

  it('jsdom 환경이다', () => {
    expect(typeof document).toBe('object')
  })
})
```

- [ ] **Step 6: 테스트 실행**

Run: `npm test`
Expected: PASS (2 tests)

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "chore: Next.js + TypeScript + Vitest 프로젝트 초기화"
```

---

### Task 2: 도메인 타입과 가격 계산 순수 함수

이 태스크가 앱의 심장이다. 화면에 보이는 모든 숫자가 여기서 나온다.

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/pricing.ts`
- Create: `src/domain/market.ts`
- Test: `src/domain/__tests__/pricing.test.ts`
- Test: `src/domain/__tests__/market.test.ts`
- Delete: `src/domain/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `interface StockSummary { code: string; name: string; market: 'KOSPI' | 'KOSDAQ' }`
  - `interface Quote { code: string; name: string; price: number; prevClose: number; high52w: number; tradingHalted: boolean; asOf: string }`
  - `interface CartItem { code: string; qty: number; addedPrice: number; addedAt: string }`
  - `discountFromHigh(price: number, high52w: number): number`
  - `changeFromPrevClose(price: number, prevClose: number): number`
  - `changeSinceAdded(price: number, addedPrice: number): number`
  - `lineSubtotal(quote: Quote, qty: number): number`
  - `cartTotal(items: CartItem[], quotes: Record<string, Quote>): number`
  - `isMarketOpen(now: Date): boolean`

- [ ] **Step 1: 타입 정의**

`src/domain/types.ts`:

```ts
export interface StockSummary {
  code: string
  name: string
  market: 'KOSPI' | 'KOSDAQ'
}

export interface Quote {
  code: string
  name: string
  /** 현재가 (원) */
  price: number
  /** 전일 종가 (원) */
  prevClose: number
  /** 52주 최고가 (원). 쇼핑몰의 "정가" 역할 */
  high52w: number
  tradingHalted: boolean
  /** 시세 기준 시각 (ISO 8601) */
  asOf: string
}

export interface CartItem {
  code: string
  qty: number
  /** 장바구니에 담던 시점의 현재가 (원) */
  addedPrice: number
  addedAt: string
}
```

- [ ] **Step 2: pricing 실패 테스트 작성**

`src/domain/__tests__/pricing.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  discountFromHigh,
  changeFromPrevClose,
  changeSinceAdded,
  lineSubtotal,
  cartTotal,
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
    { code: '005930', qty: 2, addedPrice: 61000, addedAt: '2026-09-03T04:00:00.000Z' },
    { code: '000660', qty: 1, addedPrice: 200000, addedAt: '2026-09-03T04:00:00.000Z' },
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
```

- [ ] **Step 3: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/domain/__tests__/pricing.test.ts`
Expected: FAIL — `Failed to resolve import "@/domain/pricing"`

- [ ] **Step 4: pricing 구현**

`src/domain/pricing.ts`:

```ts
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
```

- [ ] **Step 5: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/domain/__tests__/pricing.test.ts`
Expected: PASS (16 tests)

- [ ] **Step 6: market 실패 테스트 작성**

한국 주식시장 정규장은 평일 09:00~15:30 (KST)이다. 공휴일은 MVP에서 다루지 않는다.

`src/domain/__tests__/market.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isMarketOpen } from '@/domain/market'

/** KST 기준 시각을 Date로 만든다 (KST = UTC+9) */
function kst(iso: string): Date {
  return new Date(`${iso}+09:00`)
}

describe('isMarketOpen', () => {
  it('평일 정규장 중이면 열려 있다', () => {
    expect(isMarketOpen(kst('2026-09-03T10:30:00'))).toBe(true)
  })

  it('평일 개장 직전은 닫혀 있다', () => {
    expect(isMarketOpen(kst('2026-09-03T08:59:59'))).toBe(false)
  })

  it('개장 시각 정각은 열려 있다', () => {
    expect(isMarketOpen(kst('2026-09-03T09:00:00'))).toBe(true)
  })

  it('폐장 시각 정각은 닫혀 있다', () => {
    expect(isMarketOpen(kst('2026-09-03T15:30:00'))).toBe(false)
  })

  it('토요일은 닫혀 있다', () => {
    expect(isMarketOpen(kst('2026-09-05T10:30:00'))).toBe(false)
  })

  it('일요일은 닫혀 있다', () => {
    expect(isMarketOpen(kst('2026-09-06T10:30:00'))).toBe(false)
  })
})
```

- [ ] **Step 7: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/domain/__tests__/market.test.ts`
Expected: FAIL — `Failed to resolve import "@/domain/market"`

- [ ] **Step 8: market 구현**

서버·브라우저의 로컬 타임존이 무엇이든 KST로 판정해야 한다. `Intl.DateTimeFormat`으로 KST 필드를 뽑는다.

`src/domain/market.ts`:

```ts
const KST_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const OPEN_MINUTES = 9 * 60       // 09:00
const CLOSE_MINUTES = 15 * 60 + 30 // 15:30
const WEEKEND = new Set(['Sat', 'Sun'])

/** 한국 주식시장 정규장(평일 09:00~15:30 KST) 운영 여부. 공휴일은 판정하지 않는다 */
export function isMarketOpen(now: Date): boolean {
  const parts = KST_FORMATTER.formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''

  const weekday = get('weekday')
  if (WEEKEND.has(weekday)) return false

  const minutes = Number(get('hour')) * 60 + Number(get('minute'))
  return minutes >= OPEN_MINUTES && minutes < CLOSE_MINUTES
}
```

- [ ] **Step 9: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/domain/__tests__/market.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 10: 스모크 테스트 삭제하고 전체 테스트 실행**

```bash
rm src/domain/__tests__/smoke.test.ts
npm test
```

Expected: PASS (22 tests)

- [ ] **Step 11: 커밋**

```bash
git add src/domain
git commit -m "feat: 도메인 타입과 가격 계산·장 운영시간 순수 함수 추가"
```

---

### Task 3: 종목 마스터와 로컬 검색

KIS에는 종목명으로 검색하는 API가 마땅치 않다. 종목 마스터를 저장소에 두고 검색은 로컬에서 처리한다.

**Files:**
- Create: `src/data/stocks.ts`
- Create: `src/domain/search.ts`
- Test: `src/domain/__tests__/search.test.ts`

**Interfaces:**
- Consumes: `StockSummary` (Task 2)
- Produces:
  - `STOCK_MASTER: StockSummary[]`
  - `searchStocks(all: StockSummary[], query: string, limit?: number): StockSummary[]`

- [ ] **Step 1: 종목 마스터 작성**

MVP는 시가총액 상위 종목 30개로 시작한다. 전체 KRX 마스터는 나중에 스크립트로 교체한다.

`src/data/stocks.ts`:

```ts
import type { StockSummary } from '@/domain/types'

/** MVP용 종목 마스터. 추후 KRX 전체 마스터로 교체한다 */
export const STOCK_MASTER: StockSummary[] = [
  { code: '005930', name: '삼성전자', market: 'KOSPI' },
  { code: '000660', name: 'SK하이닉스', market: 'KOSPI' },
  { code: '373220', name: 'LG에너지솔루션', market: 'KOSPI' },
  { code: '207940', name: '삼성바이오로직스', market: 'KOSPI' },
  { code: '005380', name: '현대차', market: 'KOSPI' },
  { code: '005490', name: 'POSCO홀딩스', market: 'KOSPI' },
  { code: '000270', name: '기아', market: 'KOSPI' },
  { code: '068270', name: '셀트리온', market: 'KOSPI' },
  { code: '035420', name: 'NAVER', market: 'KOSPI' },
  { code: '105560', name: 'KB금융', market: 'KOSPI' },
  { code: '012330', name: '현대모비스', market: 'KOSPI' },
  { code: '051910', name: 'LG화학', market: 'KOSPI' },
  { code: '028260', name: '삼성물산', market: 'KOSPI' },
  { code: '055550', name: '신한지주', market: 'KOSPI' },
  { code: '035720', name: '카카오', market: 'KOSPI' },
  { code: '006400', name: '삼성SDI', market: 'KOSPI' },
  { code: '003670', name: '포스코퓨처엠', market: 'KOSPI' },
  { code: '086790', name: '하나금융지주', market: 'KOSPI' },
  { code: '015760', name: '한국전력', market: 'KOSPI' },
  { code: '034020', name: '두산에너빌리티', market: 'KOSPI' },
  { code: '009150', name: '삼성전기', market: 'KOSPI' },
  { code: '033780', name: 'KT&G', market: 'KOSPI' },
  { code: '316140', name: '우리금융지주', market: 'KOSPI' },
  { code: '018260', name: '삼성에스디에스', market: 'KOSPI' },
  { code: '010130', name: '고려아연', market: 'KOSPI' },
  { code: '247540', name: '에코프로비엠', market: 'KOSDAQ' },
  { code: '086520', name: '에코프로', market: 'KOSDAQ' },
  { code: '196170', name: '알테오젠', market: 'KOSDAQ' },
  { code: '091990', name: '셀트리온헬스케어', market: 'KOSDAQ' },
  { code: '028300', name: 'HLB', market: 'KOSDAQ' },
]
```

- [ ] **Step 2: 실패 테스트 작성**

`src/domain/__tests__/search.test.ts`:

```ts
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
```

- [ ] **Step 3: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/domain/__tests__/search.test.ts`
Expected: FAIL — `Failed to resolve import "@/domain/search"`

- [ ] **Step 4: 구현**

`src/domain/search.ts`:

```ts
import type { StockSummary } from './types'

const DEFAULT_LIMIT = 20

/**
 * 종목 마스터에서 코드 또는 종목명으로 검색한다.
 * 전방 일치를 부분 일치보다 앞에 놓아 "삼성" → "삼성전자"가 먼저 나오게 한다.
 */
export function searchStocks(
  all: StockSummary[],
  query: string,
  limit: number = DEFAULT_LIMIT,
): StockSummary[] {
  const q = query.trim().toLowerCase()
  if (q === '') return []

  const prefix: StockSummary[] = []
  const partial: StockSummary[] = []

  for (const stock of all) {
    const name = stock.name.toLowerCase()
    if (name.startsWith(q) || stock.code.startsWith(q)) {
      prefix.push(stock)
    } else if (name.includes(q) || stock.code.includes(q)) {
      partial.push(stock)
    }
  }

  return [...prefix, ...partial].slice(0, limit)
}
```

- [ ] **Step 5: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/domain/__tests__/search.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/data src/domain
git commit -m "feat: 종목 마스터와 로컬 검색 함수 추가"
```

---

### Task 4: PriceProvider 인터페이스와 MockProvider

`MockProvider`가 있으면 KIS 앱키 발급을 기다리지 않고 화면까지 전부 완성할 수 있다.

**Files:**
- Create: `src/providers/PriceProvider.ts`
- Create: `src/providers/MockProvider.ts`
- Test: `src/providers/__tests__/MockProvider.test.ts`

**Interfaces:**
- Consumes: `StockSummary`, `Quote` (Task 2), `searchStocks` (Task 3), `STOCK_MASTER` (Task 3)
- Produces:
  - `interface PriceProvider { search(query: string): Promise<StockSummary[]>; getQuotes(codes: string[]): Promise<Quote[]> }`
  - `class MockProvider implements PriceProvider` — 생성자 `{ master?: StockSummary[]; now?: () => number }`

- [ ] **Step 1: 인터페이스 정의**

`src/providers/PriceProvider.ts`:

```ts
import type { StockSummary, Quote } from '@/domain/types'

export interface PriceProvider {
  /** 종목명 또는 코드로 검색한다 */
  search(query: string): Promise<StockSummary[]>
  /** 종목코드 목록의 현재 시세를 조회한다. 못 찾은 코드는 결과에서 빠진다 */
  getQuotes(codes: string[]): Promise<Quote[]>
}
```

- [ ] **Step 2: 실패 테스트 작성**

같은 종목은 같은 기준가를 갖고, 시간이 흐르면 가격이 흔들려야 한다.

`src/providers/__tests__/MockProvider.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { MockProvider } from '@/providers/MockProvider'
import type { StockSummary } from '@/domain/types'

const master: StockSummary[] = [
  { code: '005930', name: '삼성전자', market: 'KOSPI' },
  { code: '000660', name: 'SK하이닉스', market: 'KOSPI' },
]

describe('MockProvider', () => {
  it('검색은 종목 마스터를 따른다', async () => {
    const provider = new MockProvider({ master, now: () => 0 })
    const result = await provider.search('삼성')
    expect(result).toEqual([master[0]])
  })

  it('요청한 종목의 시세를 반환한다', async () => {
    const provider = new MockProvider({ master, now: () => 0 })
    const quotes = await provider.getQuotes(['005930', '000660'])
    expect(quotes.map((q) => q.code)).toEqual(['005930', '000660'])
    expect(quotes[0].name).toBe('삼성전자')
  })

  it('마스터에 없는 코드는 결과에서 뺀다', async () => {
    const provider = new MockProvider({ master, now: () => 0 })
    const quotes = await provider.getQuotes(['005930', '999999'])
    expect(quotes).toHaveLength(1)
  })

  it('같은 시각이면 같은 가격을 준다 (결정적이다)', async () => {
    const a = new MockProvider({ master, now: () => 1000 })
    const b = new MockProvider({ master, now: () => 1000 })
    expect((await a.getQuotes(['005930']))[0].price).toBe(
      (await b.getQuotes(['005930']))[0].price,
    )
  })

  it('시간이 흐르면 가격이 변한다', async () => {
    const before = await new MockProvider({ master, now: () => 0 }).getQuotes(['005930'])
    const after = await new MockProvider({ master, now: () => 600_000 }).getQuotes(['005930'])
    expect(after[0].price).not.toBe(before[0].price)
  })

  it('현재가는 52주 최고가를 넘지 않고 양수다', async () => {
    for (let t = 0; t < 50; t++) {
      const [q] = await new MockProvider({ master, now: () => t * 37_000 }).getQuotes(['005930'])
      expect(q.price).toBeGreaterThan(0)
      expect(q.price).toBeLessThanOrEqual(q.high52w)
      expect(Number.isInteger(q.price)).toBe(true)
    }
  })

  it('asOf는 now를 따른다', async () => {
    const [q] = await new MockProvider({ master, now: () => 1_756_000_000_000 }).getQuotes(['005930'])
    expect(q.asOf).toBe(new Date(1_756_000_000_000).toISOString())
  })
})
```

- [ ] **Step 3: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/providers/__tests__/MockProvider.test.ts`
Expected: FAIL — `Failed to resolve import "@/providers/MockProvider"`

- [ ] **Step 4: 구현**

`src/providers/MockProvider.ts`:

```ts
import type { PriceProvider } from './PriceProvider'
import type { StockSummary, Quote } from '@/domain/types'
import { searchStocks } from '@/domain/search'
import { STOCK_MASTER } from '@/data/stocks'

/** 종목코드를 안정적인 정수 해시로 바꾼다 */
function hash(code: string): number {
  let h = 0
  for (let i = 0; i < code.length; i++) {
    h = (h * 31 + code.charCodeAt(i)) % 100_000
  }
  return h
}

const TICK_MS = 5_000

/**
 * KIS 없이 개발·테스트하기 위한 가짜 시세 소스.
 * 가격은 종목코드와 시각만으로 결정되므로 테스트에서 재현 가능하다.
 */
export class MockProvider implements PriceProvider {
  private readonly master: StockSummary[]
  private readonly now: () => number

  constructor(opts: { master?: StockSummary[]; now?: () => number } = {}) {
    this.master = opts.master ?? STOCK_MASTER
    this.now = opts.now ?? (() => Date.now())
  }

  async search(query: string): Promise<StockSummary[]> {
    return searchStocks(this.master, query)
  }

  async getQuotes(codes: string[]): Promise<Quote[]> {
    const at = this.now()
    return codes
      .map((code) => this.master.find((s) => s.code === code))
      .filter((s): s is StockSummary => s !== undefined)
      .map((stock) => this.quoteFor(stock, at))
  }

  private quoteFor(stock: StockSummary, at: number): Quote {
    const seed = hash(stock.code)
    const high52w = 20_000 + (seed % 180) * 1_000

    // 정가의 55~95% 사이를 천천히 오간다
    const phase = Math.sin(seed + Math.floor(at / TICK_MS) / 40)
    const ratio = 0.75 + phase * 0.2
    const price = Math.round((high52w * ratio) / 10) * 10

    // 전일 종가는 현재가 대비 ±3% 안에서 흔들린다
    const prevPhase = Math.sin(seed * 1.7 + Math.floor(at / TICK_MS) / 40 - 1)
    const prevClose = Math.round((price * (1 + prevPhase * 0.03)) / 10) * 10

    return {
      code: stock.code,
      name: stock.name,
      price,
      prevClose,
      high52w,
      tradingHalted: false,
      asOf: new Date(at).toISOString(),
    }
  }
}
```

- [ ] **Step 5: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/providers/__tests__/MockProvider.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/providers
git commit -m "feat: PriceProvider 인터페이스와 MockProvider 추가"
```

---

### Task 5: QuoteCache — TTL · 동시 요청 수렴 · stale 폴백

여러 탭이 동시에 폴링해도 KIS로 나가는 호출은 하나로 수렴해야 한다. 그리고 **시세 조회가 실패해도 마지막으로 알던 가격으로 총액을 계속 보여줘야 한다.**

**Files:**
- Create: `src/server/QuoteCache.ts`
- Test: `src/server/__tests__/QuoteCache.test.ts`

**Interfaces:**
- Consumes: `Quote` (Task 2)
- Produces:
  - `class QuoteCache` — 생성자 `{ ttlMs: number; now?: () => number }`
  - `cache.get(codes: string[], loader: (missing: string[]) => Promise<Quote[]>): Promise<QuoteResult>`
  - `interface QuoteResult { quotes: Quote[]; stale: boolean }`

- [ ] **Step 1: 실패 테스트 작성**

`src/server/__tests__/QuoteCache.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { QuoteCache } from '@/server/QuoteCache'
import type { Quote } from '@/domain/types'

function quote(code: string, price: number): Quote {
  return {
    code,
    name: `종목${code}`,
    price,
    prevClose: price,
    high52w: price * 2,
    tradingHalted: false,
    asOf: '2026-09-03T05:00:00.000Z',
  }
}

describe('QuoteCache', () => {
  it('처음 요청하면 loader를 부른다', async () => {
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => 0 })
    const loader = vi.fn(async (codes: string[]) => codes.map((c) => quote(c, 1000)))

    const result = await cache.get(['005930'], loader)

    expect(loader).toHaveBeenCalledWith(['005930'])
    expect(result.quotes).toHaveLength(1)
    expect(result.stale).toBe(false)
  })

  it('TTL 안에서는 loader를 다시 부르지 않는다', async () => {
    let t = 0
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => t })
    const loader = vi.fn(async (codes: string[]) => codes.map((c) => quote(c, 1000)))

    await cache.get(['005930'], loader)
    t = 4_999
    await cache.get(['005930'], loader)

    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('TTL이 지나면 loader를 다시 부른다', async () => {
    let t = 0
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => t })
    const loader = vi.fn(async (codes: string[]) => codes.map((c) => quote(c, 1000)))

    await cache.get(['005930'], loader)
    t = 5_001
    await cache.get(['005930'], loader)

    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('캐시에 있는 종목은 빼고 없는 종목만 loader에 넘긴다', async () => {
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => 0 })
    const loader = vi.fn(async (codes: string[]) => codes.map((c) => quote(c, 1000)))

    await cache.get(['005930'], loader)
    await cache.get(['005930', '000660'], loader)

    expect(loader).toHaveBeenLastCalledWith(['000660'])
  })

  it('동시에 같은 종목을 요청하면 loader는 한 번만 불린다', async () => {
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => 0 })
    const loader = vi.fn(async (codes: string[]) => {
      await new Promise((r) => setTimeout(r, 10))
      return codes.map((c) => quote(c, 1000))
    })

    const [a, b] = await Promise.all([
      cache.get(['005930'], loader),
      cache.get(['005930'], loader),
    ])

    expect(loader).toHaveBeenCalledTimes(1)
    expect(a.quotes[0].price).toBe(b.quotes[0].price)
  })

  it('loader가 실패하면 만료된 캐시라도 돌려주고 stale로 표시한다', async () => {
    let t = 0
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => t })
    await cache.get(['005930'], async (codes) => codes.map((c) => quote(c, 1000)))

    t = 10_000
    const result = await cache.get(['005930'], async () => {
      throw new Error('KIS 장애')
    })

    expect(result.quotes[0].price).toBe(1000)
    expect(result.stale).toBe(true)
  })

  it('loader가 실패하고 캐시도 없으면 에러를 던진다', async () => {
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => 0 })
    await expect(
      cache.get(['005930'], async () => {
        throw new Error('KIS 장애')
      }),
    ).rejects.toThrow('KIS 장애')
  })

  it('loader가 실패해도 다음 요청에서 다시 시도한다', async () => {
    let t = 0
    const cache = new QuoteCache({ ttlMs: 5_000, now: () => t })
    await cache.get(['005930'], async (codes) => codes.map((c) => quote(c, 1000)))

    t = 10_000
    await cache.get(['005930'], async () => {
      throw new Error('일시 장애')
    })

    const loader = vi.fn(async (codes: string[]) => codes.map((c) => quote(c, 2000)))
    const result = await cache.get(['005930'], loader)

    expect(loader).toHaveBeenCalledTimes(1)
    expect(result.quotes[0].price).toBe(2000)
    expect(result.stale).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/server/__tests__/QuoteCache.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/QuoteCache"`

- [ ] **Step 3: 구현**

`src/server/QuoteCache.ts`:

```ts
import type { Quote } from '@/domain/types'

interface Entry {
  quote: Quote
  storedAt: number
}

export interface QuoteResult {
  quotes: Quote[]
  /** 시세 조회에 실패해 만료된 캐시로 응답했음을 뜻한다 */
  stale: boolean
}

/**
 * 종목별 TTL 캐시.
 * - 같은 종목을 동시에 요청하면 loader 호출을 하나로 수렴시킨다.
 * - loader가 실패하면 만료된 캐시라도 돌려준다. 총액이 화면에서 사라지는 것이 최악이다.
 */
export class QuoteCache {
  private readonly entries = new Map<string, Entry>()
  private readonly inflight = new Map<string, Promise<void>>()
  private readonly ttlMs: number
  private readonly now: () => number

  constructor(opts: { ttlMs: number; now?: () => number }) {
    this.ttlMs = opts.ttlMs
    this.now = opts.now ?? (() => Date.now())
  }

  async get(
    codes: string[],
    loader: (missing: string[]) => Promise<Quote[]>,
  ): Promise<QuoteResult> {
    const at = this.now()
    const fresh: string[] = []
    const pending: string[] = []
    const missing: string[] = []

    for (const code of codes) {
      const entry = this.entries.get(code)
      if (entry && at - entry.storedAt < this.ttlMs) fresh.push(code)
      else if (this.inflight.has(code)) pending.push(code)
      else missing.push(code)
    }

    let stale = false
    if (missing.length > 0) {
      // 조회와 저장을 하나의 프라미스로 묶는다. 동시 요청이 이 프라미스를 기다리면
      // 캐시에 값이 들어간 뒤에 깨어난다. 둘을 분리하면 나중 요청이 빈 캐시를 읽는다.
      const request = (async () => {
        const quotes = await loader(missing)
        const storedAt = this.now()
        for (const quote of quotes) {
          this.entries.set(quote.code, { quote, storedAt })
        }
      })()

      for (const code of missing) this.inflight.set(code, request)

      try {
        await request
      } catch (error) {
        const anyCached = missing.some((code) => this.entries.has(code))
        if (!anyCached) throw error
        stale = true
      } finally {
        for (const code of missing) this.inflight.delete(code)
      }
    }

    if (pending.length > 0) {
      await Promise.allSettled(pending.map((code) => this.inflight.get(code)))
    }

    const quotes = codes
      .map((code) => this.entries.get(code)?.quote)
      .filter((q): q is Quote => q !== undefined)

    return { quotes, stale }
  }
}
```

> **실행 중 정정 (2026-09-04, 커밋 d3200b0).** 아래 Step 3의 코드에는 결함이 있었다.
> 진행 중인 요청에 편승한(piggyback) 호출자는 `missing` 분기를 타지 않아 `stale` 플래그가
> 영영 `false`로 남고, 공유 요청이 실패하면 만료된 캐시를 최신인 것처럼 돌려주거나
> 종목을 조용히 누락했다. 설계 문서의 "총액이 화면에서 사라지는 것이 최악이다" 원칙에
> 어긋나므로 계획을 뒤집었다.
>
> 정정된 구현은 `stale`을 분기 안에서 세우지 않고 `get()` 마지막에 요청된 코드들을
> `entries`와 대조해 유도한다 — 항목이 없으면 `stale = true`에 결과에서 제외, 만료됐으면
> `stale = true`에 시세는 포함. `fresh` 배열은 쓰이지 않아 제거했다. 최초 호출자만
> 캐시가 전혀 없을 때 throw하고, 편승 호출자는 throw 대신 `stale: true`로 응답한다.
> 편승 + 실패 조합을 덮는 테스트 2개를 추가해 총 10개가 됐다.
> 실제 코드는 `src/server/QuoteCache.ts`를 보라.

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/server/__tests__/QuoteCache.test.ts`
Expected: PASS (10 tests — 원래 8개 + 정정으로 추가된 2개)

- [ ] **Step 5: 커밋**

```bash
git add src/server
git commit -m "feat: 시세 TTL 캐시와 stale 폴백 추가"
```

---

### Task 6: KisTokenManager

KIS 접근토큰은 유효기간이 24시간이고 **발급 빈도에 제한이 있다.** 매 요청마다 발급하면 즉시 차단된다.

**Files:**
- Create: `src/providers/KisTokenManager.ts`
- Test: `src/providers/__tests__/KisTokenManager.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `class KisTokenManager` — 생성자 `{ appKey: string; appSecret: string; baseUrl: string; fetchFn?: typeof fetch; now?: () => number; refreshMarginMs?: number }`
  - `manager.getToken(): Promise<string>`

- [ ] **Step 1: 실패 테스트 작성**

`src/providers/__tests__/KisTokenManager.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { KisTokenManager } from '@/providers/KisTokenManager'

const BASE = 'https://openapi.example.com'

function tokenResponse(token: string, expiresInSec = 86400) {
  return new Response(
    JSON.stringify({ access_token: token, token_type: 'Bearer', expires_in: expiresInSec }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

function make(fetchFn: typeof fetch, now: () => number) {
  return new KisTokenManager({
    appKey: 'KEY',
    appSecret: 'SECRET',
    baseUrl: BASE,
    fetchFn,
    now,
  })
}

describe('KisTokenManager', () => {
  it('처음 호출하면 토큰을 발급받는다', async () => {
    const fetchFn = vi.fn(async () => tokenResponse('T1')) as unknown as typeof fetch
    const manager = make(fetchFn, () => 0)

    expect(await manager.getToken()).toBe('T1')
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('올바른 엔드포인트에 앱키와 시크릿을 보낸다', async () => {
    const fetchFn = vi.fn(async () => tokenResponse('T1')) as unknown as typeof fetch
    await make(fetchFn, () => 0).getToken()

    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe(`${BASE}/oauth2/tokenP`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      grant_type: 'client_credentials',
      appkey: 'KEY',
      appsecret: 'SECRET',
    })
  })

  it('유효기간 안에서는 캐시된 토큰을 재사용한다', async () => {
    let t = 0
    const fetchFn = vi.fn(async () => tokenResponse('T1')) as unknown as typeof fetch
    const manager = make(fetchFn, () => t)

    await manager.getToken()
    t = 3_600_000 // 1시간 뒤
    expect(await manager.getToken()).toBe('T1')
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('만료가 임박하면 새로 발급받는다', async () => {
    let t = 0
    let issued = 0
    const fetchFn = vi.fn(async () => tokenResponse(`T${++issued}`)) as unknown as typeof fetch
    const manager = make(fetchFn, () => t)

    await manager.getToken()
    t = 86_400_000 - 60_000 // 만료 1분 전, 기본 여유 10분보다 짧다
    expect(await manager.getToken()).toBe('T2')
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('동시에 호출해도 발급 요청은 한 번만 나간다', async () => {
    const fetchFn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10))
      return tokenResponse('T1')
    }) as unknown as typeof fetch
    const manager = make(fetchFn, () => 0)

    const [a, b] = await Promise.all([manager.getToken(), manager.getToken()])

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(a).toBe('T1')
    expect(b).toBe('T1')
  })

  it('갱신에 실패해도 아직 만료 전이면 기존 토큰을 쓴다', async () => {
    let t = 0
    let call = 0
    const fetchFn = vi.fn(async () => {
      call += 1
      if (call === 1) return tokenResponse('T1')
      throw new Error('network down')
    }) as unknown as typeof fetch
    const manager = make(fetchFn, () => t)

    await manager.getToken()
    t = 86_400_000 - 60_000
    expect(await manager.getToken()).toBe('T1')
  })

  it('토큰이 없는데 발급에 실패하면 에러를 던진다', async () => {
    const fetchFn = vi.fn(async () => new Response('rate limited', { status: 403 })) as unknown as typeof fetch
    await expect(make(fetchFn, () => 0).getToken()).rejects.toThrow(/403/)
  })

  it('발급 실패 뒤 다음 호출에서 다시 시도한다', async () => {
    let call = 0
    const fetchFn = vi.fn(async () => {
      call += 1
      if (call === 1) return new Response('oops', { status: 500 })
      return tokenResponse('T1')
    }) as unknown as typeof fetch
    const manager = make(fetchFn, () => 0)

    await expect(manager.getToken()).rejects.toThrow()
    expect(await manager.getToken()).toBe('T1')
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/providers/__tests__/KisTokenManager.test.ts`
Expected: FAIL — `Failed to resolve import "@/providers/KisTokenManager"`

- [ ] **Step 3: 구현**

`src/providers/KisTokenManager.ts`:

```ts
interface CachedToken {
  value: string
  expiresAt: number
}

interface TokenResponseBody {
  access_token: string
  expires_in: number
}

const DEFAULT_REFRESH_MARGIN_MS = 10 * 60 * 1000

/**
 * KIS 접근토큰을 발급받아 캐싱한다.
 * KIS는 토큰 발급 빈도를 제한하므로 매 요청마다 발급하면 차단된다.
 */
export class KisTokenManager {
  private cached: CachedToken | null = null
  private inflight: Promise<string> | null = null

  private readonly appKey: string
  private readonly appSecret: string
  private readonly baseUrl: string
  private readonly fetchFn: typeof fetch
  private readonly now: () => number
  private readonly refreshMarginMs: number

  constructor(opts: {
    appKey: string
    appSecret: string
    baseUrl: string
    fetchFn?: typeof fetch
    now?: () => number
    refreshMarginMs?: number
  }) {
    this.appKey = opts.appKey
    this.appSecret = opts.appSecret
    this.baseUrl = opts.baseUrl.replace(/\/$/, '')
    this.fetchFn = opts.fetchFn ?? fetch
    this.now = opts.now ?? (() => Date.now())
    this.refreshMarginMs = opts.refreshMarginMs ?? DEFAULT_REFRESH_MARGIN_MS
  }

  async getToken(): Promise<string> {
    const at = this.now()
    if (this.cached && at < this.cached.expiresAt - this.refreshMarginMs) {
      return this.cached.value
    }
    if (this.inflight) return this.inflight

    this.inflight = this.issue()
    try {
      return await this.inflight
    } catch (error) {
      // 아직 만료 전이라면 기존 토큰으로 버틴다
      if (this.cached && at < this.cached.expiresAt) return this.cached.value
      throw error
    } finally {
      this.inflight = null
    }
  }

  private async issue(): Promise<string> {
    const response = await this.fetchFn(`${this.baseUrl}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: this.appKey,
        appsecret: this.appSecret,
      }),
    })

    if (!response.ok) {
      throw new Error(`KIS 토큰 발급 실패: ${response.status}`)
    }

    const body = (await response.json()) as TokenResponseBody
    this.cached = {
      value: body.access_token,
      expiresAt: this.now() + body.expires_in * 1000,
    }
    return this.cached.value
  }
}
```

> **실행 중 정정 (2026-09-04, 커밋 5dad094).** 위 Step 3의 코드에는 Task 5와 같은 계열의
> 결함이 있었다. `if (this.inflight) return this.inflight`가 `try/catch` 바깥에서 반환하기
> 때문에, 진행 중인 발급에 편승한 호출자는 발급이 실패했을 때 폴백을 받지 못하고 예외를
> 그대로 맞는다 — 아직 만료되지 않은 토큰이 캐시에 있어도 마찬가지다. 갱신을 시작한
> 호출자만 보호받는 셈이라 스펙의 "토큰 실패에도 가진 것으로 계속 서빙한다"에 어긋난다.
>
> 정정된 구현은 편승 분기와 최초 분기를 하나의 `try/catch/finally`로 합친다.
> `const pending = this.inflight ?? this.issue()`로 같은 프라미스를 얻어 각자의 `try`에서
> await하므로 두 호출자 모두 같은 폴백을 탄다. `finally`는 `this.inflight === pending`일
> 때만 슬롯을 비워, 편승 호출자가 더 나중 세대의 발급을 지우지 못하게 한다.
> 신선도 판정은 마진을 뺀 `expiresAt - refreshMarginMs`, 폴백 판정은 마진 없는
> `expiresAt`으로 서로 달라야 한다 — 합치면 폴백 경로가 죽는다.
> 동시 호출 + 갱신 실패 조합을 덮는 테스트를 추가해 총 9개가 됐다.
> 실제 코드는 `src/providers/KisTokenManager.ts`를 보라.

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/providers/__tests__/KisTokenManager.test.ts`
Expected: PASS (9 tests — 원래 8개 + 정정으로 추가된 1개)

- [ ] **Step 5: 커밋**

```bash
git add src/providers
git commit -m "feat: KIS 접근토큰 발급·캐싱 관리자 추가"
```

---

### Task 7: KisKrxProvider

**Files:**
- Create: `src/providers/KisKrxProvider.ts`
- Test: `src/providers/__tests__/KisKrxProvider.test.ts`

**Interfaces:**
- Consumes: `PriceProvider` (Task 4), `KisTokenManager` (Task 6), `searchStocks`·`STOCK_MASTER` (Task 3)
- Produces: `class KisKrxProvider implements PriceProvider` — 생성자 `{ tokenManager: KisTokenManager; appKey: string; appSecret: string; baseUrl: string; master?: StockSummary[]; fetchFn?: typeof fetch }`

**응답 필드 매핑 주의:** KIS 국내주식 현재가 시세(`FHKST01010100`)의 `output`에서 아래 필드를 쓴다. 실제 응답 필드명이 다르면 **이 파일의 `toQuote()`와 테스트 픽스처만** 고치면 되고 다른 코드는 영향받지 않는다.

| Quote 필드 | KIS 필드 | 비고 |
|---|---|---|
| `price` | `stck_prpr` | 현재가 |
| `prevClose` | `stck_sdpr` | 주식 기준가 = 전일 종가 |
| `high52w` | `w52_hgpr` | 52주 최고가 |
| `tradingHalted` | `temp_stop_yn` | `'Y'`면 정지. 필드가 없으면 `false` |
| `name` | — | 응답을 믿지 않고 로컬 종목 마스터를 쓴다 |

- [ ] **Step 1: 실패 테스트 작성**

`src/providers/__tests__/KisKrxProvider.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { KisKrxProvider } from '@/providers/KisKrxProvider'
import { KisTokenManager } from '@/providers/KisTokenManager'
import type { StockSummary } from '@/domain/types'

const BASE = 'https://openapi.example.com'

const master: StockSummary[] = [
  { code: '005930', name: '삼성전자', market: 'KOSPI' },
  { code: '000660', name: 'SK하이닉스', market: 'KOSPI' },
]

function priceResponse(over: Record<string, string> = {}) {
  return new Response(
    JSON.stringify({
      rt_cd: '0',
      msg1: '정상처리',
      output: {
        stck_prpr: '61200',
        stck_sdpr: '62600',
        w52_hgpr: '85000',
        temp_stop_yn: 'N',
        ...over,
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

function makeProvider(fetchFn: typeof fetch) {
  const tokenManager = {
    getToken: async () => 'TOKEN',
  } as unknown as KisTokenManager

  return new KisKrxProvider({
    tokenManager,
    appKey: 'KEY',
    appSecret: 'SECRET',
    baseUrl: BASE,
    master,
    fetchFn,
  })
}

describe('KisKrxProvider', () => {
  it('검색은 로컬 종목 마스터를 쓰고 네트워크를 타지 않는다', async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch
    const result = await makeProvider(fetchFn).search('삼성')

    expect(result).toEqual([master[0]])
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('KIS 응답을 Quote로 변환한다', async () => {
    const fetchFn = vi.fn(async () => priceResponse()) as unknown as typeof fetch
    const [quote] = await makeProvider(fetchFn).getQuotes(['005930'])

    expect(quote).toMatchObject({
      code: '005930',
      name: '삼성전자',
      price: 61200,
      prevClose: 62600,
      high52w: 85000,
      tradingHalted: false,
    })
    expect(quote.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('종목명은 응답이 아니라 로컬 마스터에서 가져온다', async () => {
    const fetchFn = vi.fn(async () =>
      priceResponse({ hts_kor_isnm: '엉뚱한이름' }),
    ) as unknown as typeof fetch
    const [quote] = await makeProvider(fetchFn).getQuotes(['005930'])

    expect(quote.name).toBe('삼성전자')
  })

  it('인증 헤더와 조회 파라미터를 규격대로 보낸다', async () => {
    const fetchFn = vi.fn(async () => priceResponse()) as unknown as typeof fetch
    await makeProvider(fetchFn).getQuotes(['005930'])

    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toBe(
      `${BASE}/uapi/domestic-stock/v1/quotations/inquire-price` +
        `?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=005930`,
    )
    expect(init.headers.authorization).toBe('Bearer TOKEN')
    expect(init.headers.appkey).toBe('KEY')
    expect(init.headers.appsecret).toBe('SECRET')
    expect(init.headers.tr_id).toBe('FHKST01010100')
  })

  it('temp_stop_yn이 Y이면 거래정지로 표시한다', async () => {
    const fetchFn = vi.fn(async () => priceResponse({ temp_stop_yn: 'Y' })) as unknown as typeof fetch
    const [quote] = await makeProvider(fetchFn).getQuotes(['005930'])

    expect(quote.tradingHalted).toBe(true)
  })

  it('temp_stop_yn 필드가 없으면 거래정지가 아니라고 본다', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            rt_cd: '0',
            output: { stck_prpr: '61200', stck_sdpr: '62600', w52_hgpr: '85000' },
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch
    const [quote] = await makeProvider(fetchFn).getQuotes(['005930'])

    expect(quote.tradingHalted).toBe(false)
  })

  it('마스터에 없는 코드는 조회하지 않고 건너뛴다', async () => {
    const fetchFn = vi.fn(async () => priceResponse()) as unknown as typeof fetch
    const quotes = await makeProvider(fetchFn).getQuotes(['999999'])

    expect(quotes).toEqual([])
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('한 종목이 실패해도 나머지 종목은 살린다', async () => {
    let call = 0
    const fetchFn = vi.fn(async () => {
      call += 1
      if (call === 1) return new Response('boom', { status: 500 })
      return priceResponse({ stck_prpr: '205000' })
    }) as unknown as typeof fetch

    const quotes = await makeProvider(fetchFn).getQuotes(['005930', '000660'])

    expect(quotes).toHaveLength(1)
    expect(quotes[0].code).toBe('000660')
  })

  it('rt_cd가 0이 아니면 그 종목은 결과에서 뺀다', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ rt_cd: '1', msg1: '조회할 수 없습니다', output: {} }), {
          status: 200,
        }),
    ) as unknown as typeof fetch

    expect(await makeProvider(fetchFn).getQuotes(['005930'])).toEqual([])
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/providers/__tests__/KisKrxProvider.test.ts`
Expected: FAIL — `Failed to resolve import "@/providers/KisKrxProvider"`

- [ ] **Step 3: 구현**

`src/providers/KisKrxProvider.ts`:

```ts
import type { PriceProvider } from './PriceProvider'
import type { KisTokenManager } from './KisTokenManager'
import type { StockSummary, Quote } from '@/domain/types'
import { searchStocks } from '@/domain/search'
import { STOCK_MASTER } from '@/data/stocks'

const PRICE_PATH = '/uapi/domestic-stock/v1/quotations/inquire-price'
const TR_ID_PRICE = 'FHKST01010100'

interface KisPriceBody {
  rt_cd?: string
  output?: Record<string, string | undefined>
}

export class KisKrxProvider implements PriceProvider {
  private readonly tokenManager: KisTokenManager
  private readonly appKey: string
  private readonly appSecret: string
  private readonly baseUrl: string
  private readonly master: StockSummary[]
  private readonly fetchFn: typeof fetch

  constructor(opts: {
    tokenManager: KisTokenManager
    appKey: string
    appSecret: string
    baseUrl: string
    master?: StockSummary[]
    fetchFn?: typeof fetch
  }) {
    this.tokenManager = opts.tokenManager
    this.appKey = opts.appKey
    this.appSecret = opts.appSecret
    this.baseUrl = opts.baseUrl.replace(/\/$/, '')
    this.master = opts.master ?? STOCK_MASTER
    this.fetchFn = opts.fetchFn ?? fetch
  }

  async search(query: string): Promise<StockSummary[]> {
    return searchStocks(this.master, query)
  }

  /** 한 종목이 실패해도 나머지는 살린다. 총액을 최대한 보여주는 쪽이 낫다 */
  async getQuotes(codes: string[]): Promise<Quote[]> {
    const stocks = codes
      .map((code) => this.master.find((s) => s.code === code))
      .filter((s): s is StockSummary => s !== undefined)

    const settled = await Promise.allSettled(stocks.map((s) => this.fetchQuote(s)))

    return settled
      .map((r) => (r.status === 'fulfilled' ? r.value : undefined))
      .filter((q): q is Quote => q !== undefined)
  }

  private async fetchQuote(stock: StockSummary): Promise<Quote | undefined> {
    const token = await this.tokenManager.getToken()
    const url =
      `${this.baseUrl}${PRICE_PATH}` +
      `?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${stock.code}`

    const response = await this.fetchFn(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        appkey: this.appKey,
        appsecret: this.appSecret,
        tr_id: TR_ID_PRICE,
      },
    })

    if (!response.ok) {
      throw new Error(`KIS 시세 조회 실패: ${stock.code} ${response.status}`)
    }

    const body = (await response.json()) as KisPriceBody
    if (body.rt_cd !== '0' || !body.output) return undefined

    return this.toQuote(stock, body.output)
  }

  private toQuote(stock: StockSummary, output: Record<string, string | undefined>): Quote {
    const num = (raw: string | undefined): number => {
      const value = Number(raw)
      return Number.isFinite(value) ? value : 0
    }

    return {
      code: stock.code,
      name: stock.name,
      price: num(output.stck_prpr),
      prevClose: num(output.stck_sdpr),
      high52w: num(output.w52_hgpr),
      tradingHalted: output.temp_stop_yn === 'Y',
      asOf: new Date().toISOString(),
    }
  }
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/providers/__tests__/KisKrxProvider.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/providers
git commit -m "feat: KIS 국내주식 시세 Provider 추가"
```

---

### Task 8: Provider 팩토리와 API Route Handler

**Files:**
- Create: `src/server/provider.ts`
- Create: `src/app/api/search/route.ts`
- Create: `src/app/api/quotes/route.ts`
- Create: `.env.example`
- Test: `src/app/api/__tests__/routes.test.ts`

**Interfaces:**
- Consumes: `MockProvider` (Task 4), `KisKrxProvider` (Task 7), `KisTokenManager` (Task 6), `QuoteCache` (Task 5)
- Produces:
  - `getProvider(): PriceProvider` — 싱글턴
  - `getQuoteCache(): QuoteCache` — 싱글턴
  - `GET /api/search?q=삼성` → `{ stocks: StockSummary[] }`
  - `GET /api/quotes?codes=005930,000660` → `{ quotes: Quote[]; stale: boolean }`

- [ ] **Step 1: 환경변수 예시 파일 작성**

`.env.example`:

```bash
# 비워두면 MockProvider로 동작한다. KIS 앱키 없이도 개발할 수 있다.
KIS_APP_KEY=
KIS_APP_SECRET=
# 실전 계좌: https://openapi.koreainvestment.com:9443
# 모의투자:  https://openapivts.koreainvestment.com:29443
KIS_BASE_URL=https://openapi.koreainvestment.com:9443
```

- [ ] **Step 2: 실패 테스트 작성**

`src/app/api/__tests__/routes.test.ts`:

이 파일은 DOM이 필요 없고 `next/server`가 Node 런타임 전역을 쓰므로 첫 줄에 환경 지시자를 둔다.
`getProvider()`는 모듈 싱글턴이라 테스트마다 초기화해야 환경변수 변경이 반영된다.

```ts
// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET as searchGet } from '@/app/api/search/route'
import { GET as quotesGet } from '@/app/api/quotes/route'
import { resetProviderForTest } from '@/server/provider'

beforeEach(() => {
  vi.stubEnv('KIS_APP_KEY', '')
  vi.stubEnv('KIS_APP_SECRET', '')
  resetProviderForTest()
})

describe('GET /api/search', () => {
  it('질의에 맞는 종목을 반환한다', async () => {
    const res = await searchGet(new Request('http://localhost/api/search?q=삼성전자'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.stocks[0]).toMatchObject({ code: '005930', name: '삼성전자' })
  })

  it('q가 없으면 빈 목록을 준다', async () => {
    const res = await searchGet(new Request('http://localhost/api/search'))

    expect(res.status).toBe(200)
    expect((await res.json()).stocks).toEqual([])
  })
})

describe('GET /api/quotes', () => {
  it('요청한 종목의 시세를 반환한다', async () => {
    const res = await quotesGet(
      new Request('http://localhost/api/quotes?codes=005930,000660'),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.quotes.map((q: { code: string }) => q.code)).toEqual(['005930', '000660'])
    expect(body.stale).toBe(false)
  })

  it('codes가 없으면 빈 목록을 준다', async () => {
    const res = await quotesGet(new Request('http://localhost/api/quotes'))

    expect(res.status).toBe(200)
    expect((await res.json()).quotes).toEqual([])
  })

  it('빈 문자열이 섞인 codes를 걸러낸다', async () => {
    const res = await quotesGet(new Request('http://localhost/api/quotes?codes=005930,,'))

    expect((await res.json()).quotes).toHaveLength(1)
  })

  it('한 번에 조회할 수 있는 종목 수를 제한한다', async () => {
    const codes = Array.from({ length: 60 }, (_, i) => String(i).padStart(6, '0')).join(',')
    const res = await quotesGet(new Request(`http://localhost/api/quotes?codes=${codes}`))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/50/)
  })
})
```

- [ ] **Step 3: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/app/api/__tests__/routes.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/api/search/route"`

- [ ] **Step 4: Provider 팩토리 구현**

`src/server/provider.ts`:

```ts
import type { PriceProvider } from '@/providers/PriceProvider'
import { MockProvider } from '@/providers/MockProvider'
import { KisKrxProvider } from '@/providers/KisKrxProvider'
import { KisTokenManager } from '@/providers/KisTokenManager'
import { QuoteCache } from './QuoteCache'

const QUOTE_TTL_MS = 5_000

let provider: PriceProvider | null = null
let cache: QuoteCache | null = null

/**
 * 앱키가 없으면 MockProvider로 동작한다.
 * 덕분에 KIS 발급을 기다리지 않고 화면 전체를 개발할 수 있다.
 */
export function getProvider(): PriceProvider {
  if (provider) return provider

  const appKey = process.env.KIS_APP_KEY
  const appSecret = process.env.KIS_APP_SECRET
  const baseUrl = process.env.KIS_BASE_URL

  if (!appKey || !appSecret || !baseUrl) {
    provider = new MockProvider()
    return provider
  }

  provider = new KisKrxProvider({
    tokenManager: new KisTokenManager({ appKey, appSecret, baseUrl }),
    appKey,
    appSecret,
    baseUrl,
  })
  return provider
}

export function getQuoteCache(): QuoteCache {
  if (!cache) cache = new QuoteCache({ ttlMs: QUOTE_TTL_MS })
  return cache
}

/** 테스트에서 환경변수를 바꿔가며 검증할 때 쓴다 */
export function resetProviderForTest(): void {
  provider = null
  cache = null
}
```

- [ ] **Step 5: Route Handler 구현**

`src/app/api/search/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getProvider } from '@/server/provider'

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams.get('q') ?? ''
  const stocks = await getProvider().search(query)
  return NextResponse.json({ stocks })
}
```

`src/app/api/quotes/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getProvider, getQuoteCache } from '@/server/provider'

const MAX_CODES = 50

export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get('codes') ?? ''
  const codes = raw.split(',').map((c) => c.trim()).filter((c) => c !== '')

  if (codes.length === 0) {
    return NextResponse.json({ quotes: [], stale: false })
  }
  if (codes.length > MAX_CODES) {
    return NextResponse.json(
      { error: `한 번에 조회할 수 있는 종목은 최대 ${MAX_CODES}개입니다` },
      { status: 400 },
    )
  }

  const provider = getProvider()

  try {
    const result = await getQuoteCache().get(codes, (missing) => provider.getQuotes(missing))
    return NextResponse.json(result)
  } catch {
    // 캐시조차 없어 아무것도 보여줄 수 없는 경우에만 여기로 온다
    return NextResponse.json({ error: '시세를 가져오지 못했습니다' }, { status: 502 })
  }
}
```

- [ ] **Step 6: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/app/api/__tests__/routes.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 7: 전체 테스트와 빌드 확인**

```bash
npm test
npm run build
```

Expected: 테스트 전부 PASS, 빌드 성공

- [ ] **Step 8: 커밋**

```bash
git add src/server src/app/api .env.example
git commit -m "feat: 시세·검색 API Route Handler와 Provider 팩토리 추가"
```

---

### Task 9: useCart — 장바구니 상태와 localStorage 동기화

**Files:**
- Create: `src/hooks/useCart.ts`
- Test: `src/hooks/__tests__/useCart.test.tsx`

**Interfaces:**
- Consumes: `CartItem` (Task 2)
- Produces:
  - `useCart(): { items: CartItem[]; ready: boolean; add(code: string, qty: number, price: number): void; setQty(code: string, qty: number): void; remove(code: string): void; clear(): void }`
  - `CART_STORAGE_KEY = 'stockshopping.cart.v1'`

**설계 결정:** 이미 담긴 종목을 다시 담으면 **수량만 더하고 `addedPrice`는 처음 값을 유지한다.** "담아둔 사이 얼마나 변했나"의 기준점이 흔들리면 안 된다.

- [ ] **Step 1: 실패 테스트 작성**

`src/hooks/__tests__/useCart.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCart, CART_STORAGE_KEY } from '@/hooks/useCart'

beforeEach(() => {
  localStorage.clear()
})

describe('useCart', () => {
  it('처음에는 비어 있다', () => {
    const { result } = renderHook(() => useCart())
    expect(result.current.items).toEqual([])
    expect(result.current.ready).toBe(true)
  })

  it('종목을 담는다', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('005930', 2, 61200))

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0]).toMatchObject({ code: '005930', qty: 2, addedPrice: 61200 })
    expect(result.current.items[0].addedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('이미 담은 종목은 수량만 더하고 담은 가격은 유지한다', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('005930', 2, 61200))
    act(() => result.current.add('005930', 3, 63000))

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].qty).toBe(5)
    expect(result.current.items[0].addedPrice).toBe(61200)
  })

  it('수량을 바꾼다', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('005930', 2, 61200))
    act(() => result.current.setQty('005930', 7))

    expect(result.current.items[0].qty).toBe(7)
  })

  it('수량을 0 이하로 만들면 장바구니에서 뺀다', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('005930', 2, 61200))
    act(() => result.current.setQty('005930', 0))

    expect(result.current.items).toEqual([])
  })

  it('종목을 뺀다', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('005930', 2, 61200))
    act(() => result.current.add('000660', 1, 205000))
    act(() => result.current.remove('005930'))

    expect(result.current.items.map((i) => i.code)).toEqual(['000660'])
  })

  it('전체를 비운다', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('005930', 2, 61200))
    act(() => result.current.clear())

    expect(result.current.items).toEqual([])
  })

  it('localStorage에 저장한다', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('005930', 2, 61200))

    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '[]')
    expect(saved[0]).toMatchObject({ code: '005930', qty: 2 })
  })

  it('저장된 장바구니를 복원한다', () => {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([
        { code: '005930', qty: 4, addedPrice: 61200, addedAt: '2026-09-03T04:00:00.000Z' },
      ]),
    )

    const { result } = renderHook(() => useCart())
    expect(result.current.items[0].qty).toBe(4)
  })

  it('저장된 값이 깨져 있으면 빈 장바구니로 시작한다', () => {
    localStorage.setItem(CART_STORAGE_KEY, '{{{ 깨진 JSON')

    const { result } = renderHook(() => useCart())
    expect(result.current.items).toEqual([])
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/hooks/__tests__/useCart.test.tsx`
Expected: FAIL — `Failed to resolve import "@/hooks/useCart"`

- [ ] **Step 3: 구현**

`src/hooks/useCart.ts`:

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CartItem } from '@/domain/types'

export const CART_STORAGE_KEY = 'stockshopping.cart.v1'

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.code === 'string' &&
    typeof v.qty === 'number' &&
    typeof v.addedPrice === 'number' &&
    typeof v.addedAt === 'string'
  )
}

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : []
  } catch {
    return []
  }
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])
  const [ready, setReady] = useState(false)

  // 서버 렌더링에는 localStorage가 없으므로 마운트 후에 복원한다
  useEffect(() => {
    setItems(load())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
    } catch {
      // 저장 실패(사생활 보호 모드 등)는 무시한다. 화면 동작은 유지된다
    }
  }, [items, ready])

  const add = useCallback((code: string, qty: number, price: number) => {
    setItems((prev) => {
      const found = prev.find((i) => i.code === code)
      // 담은 가격은 처음 값을 유지한다. "담아둔 사이 변동"의 기준점이기 때문이다
      if (found) {
        return prev.map((i) => (i.code === code ? { ...i, qty: i.qty + qty } : i))
      }
      return [...prev, { code, qty, addedPrice: price, addedAt: new Date().toISOString() }]
    })
  }, [])

  const setQty = useCallback((code: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.code !== code)
        : prev.map((i) => (i.code === code ? { ...i, qty } : i)),
    )
  }, [])

  const remove = useCallback((code: string) => {
    setItems((prev) => prev.filter((i) => i.code !== code))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  return { items, ready, add, setQty, remove, clear }
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/hooks/__tests__/useCart.test.tsx`
Expected: PASS (10 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/hooks
git commit -m "feat: 장바구니 상태 훅과 localStorage 동기화 추가"
```

---

### Task 10: useQuotes — 시세 조회 · 폴링 · 지연 상태

**Files:**
- Create: `src/hooks/useQuotes.ts`
- Test: `src/hooks/__tests__/useQuotes.test.tsx`

**Interfaces:**
- Consumes: `Quote` (Task 2)
- Produces: `useQuotes(codes: string[], opts?: { pollMs?: number }): { quotes: Record<string, Quote>; stale: boolean; loading: boolean }`

**주의:** 이 훅의 테스트에서는 `vi.stubGlobal('fetch', ...)`를 쓴다. 훅은 브라우저의 전역 `fetch`를 쓰는 게 자연스럽고, 주입을 위한 인자를 만들면 호출부만 번거로워진다.

- [ ] **Step 1: 실패 테스트 작성**

`src/hooks/__tests__/useQuotes.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useQuotes } from '@/hooks/useQuotes'

function quotesResponse(price: number, stale = false) {
  return new Response(
    JSON.stringify({
      quotes: [
        {
          code: '005930',
          name: '삼성전자',
          price,
          prevClose: 62600,
          high52w: 85000,
          tradingHalted: false,
          asOf: '2026-09-03T05:00:00.000Z',
        },
      ],
      stale,
    }),
    { status: 200 },
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useQuotes', () => {
  it('코드 목록으로 시세를 가져온다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => quotesResponse(61200)))
    const { result } = renderHook(() => useQuotes(['005930']))

    await waitFor(() => expect(result.current.quotes['005930']?.price).toBe(61200))
    expect(result.current.loading).toBe(false)
  })

  it('요청 URL에 코드를 콤마로 이어 붙인다', async () => {
    const fetchMock = vi.fn(async () => quotesResponse(61200))
    vi.stubGlobal('fetch', fetchMock)
    renderHook(() => useQuotes(['005930', '000660']))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/quotes?codes=005930%2C000660')
  })

  it('코드가 없으면 요청하지 않는다', async () => {
    const fetchMock = vi.fn(async () => quotesResponse(61200))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useQuotes([]))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.quotes).toEqual({})
  })

  it('응답의 stale 플래그를 그대로 노출한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => quotesResponse(61200, true)))
    const { result } = renderHook(() => useQuotes(['005930']))

    await waitFor(() => expect(result.current.stale).toBe(true))
  })

  it('요청이 실패하면 stale로 표시하고 직전 시세를 유지한다', async () => {
    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1
        if (call === 1) return quotesResponse(61200)
        throw new Error('offline')
      }),
    )

    const { result, rerender } = renderHook(({ codes }) => useQuotes(codes), {
      initialProps: { codes: ['005930'] },
    })
    await waitFor(() => expect(result.current.quotes['005930']?.price).toBe(61200))

    rerender({ codes: ['005930', '005930'] })
    await waitFor(() => expect(result.current.stale).toBe(true))
    expect(result.current.quotes['005930']?.price).toBe(61200)
  })

  it('pollMs를 주면 주기적으로 다시 조회한다', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => quotesResponse(61200))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useQuotes(['005930'], { pollMs: 5_000 }))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('pollMs가 없으면 반복 조회하지 않는다', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => quotesResponse(61200))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useQuotes(['005930']))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/hooks/__tests__/useQuotes.test.tsx`
Expected: FAIL — `Failed to resolve import "@/hooks/useQuotes"`

- [ ] **Step 3: 구현**

`src/hooks/useQuotes.ts`:

```ts
'use client'

import { useEffect, useRef, useState } from 'react'
import type { Quote } from '@/domain/types'

interface QuotesResponse {
  quotes: Quote[]
  stale: boolean
}

/**
 * 종목 시세를 가져오고, pollMs가 주어지면 주기적으로 갱신한다.
 * 조회에 실패해도 직전 시세를 지우지 않는다. 총액이 사라지는 것이 최악이다.
 */
export function useQuotes(codes: string[], opts: { pollMs?: number } = {}) {
  const { pollMs } = opts
  const key = codes.join(',')

  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [stale, setStale] = useState(false)
  const [loading, setLoading] = useState(false)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    if (key === '') {
      setQuotes({})
      setStale(false)
      setLoading(false)
      return
    }

    let cancelled = false

    const run = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/quotes?codes=${encodeURIComponent(key)}`)
        if (!res.ok) throw new Error(`시세 조회 실패: ${res.status}`)
        const body = (await res.json()) as QuotesResponse
        if (cancelled) return

        setQuotes((prev) => {
          const next = { ...prev }
          for (const quote of body.quotes) next[quote.code] = quote
          return next
        })
        setStale(body.stale)
      } catch {
        if (!cancelled) setStale(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()

    if (!pollMs) return () => {
      cancelled = true
    }

    const timer = setInterval(() => void run(), pollMs)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [key, pollMs])

  return { quotes, stale, loading }
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/hooks/__tests__/useQuotes.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/hooks
git commit -m "feat: 시세 조회·폴링 훅 추가"
```

---

### Task 11: 표시 형식과 상품 카드 컴포넌트

여기서 "쇼핑몰처럼 보이게 하는" 시각 언어가 정해진다.

**Files:**
- Create: `src/domain/format.ts`
- Create: `src/components/PriceBadge.tsx`
- Create: `src/components/QtyStepper.tsx`
- Create: `src/components/StockCard.tsx`
- Test: `src/domain/__tests__/format.test.ts`
- Test: `src/components/__tests__/StockCard.test.tsx`

**Interfaces:**
- Consumes: `Quote` (Task 2), `discountFromHigh`·`changeFromPrevClose` (Task 2)
- Produces:
  - `formatWon(value: number): string` — `61200` → `'61,200원'`
  - `formatPercent(rate: number, digits?: number): string` — `0.283` → `'28.3%'` (부호 없음, 절댓값)
  - `formatSignedPercent(rate: number, digits?: number): string` — `-0.0224` → `'-2.2%'`
  - `<PriceBadge changeRate={number} />`
  - `<QtyStepper value={number} onChange={(qty: number) => void} label={string} />`
  - `<StockCard quote={Quote} onAdd={(code: string, qty: number, price: number) => void} />`

- [ ] **Step 1: format 실패 테스트 작성**

`src/domain/__tests__/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatWon, formatPercent, formatSignedPercent } from '@/domain/format'

describe('formatWon', () => {
  it('천 단위 구분 기호를 넣고 원을 붙인다', () => {
    expect(formatWon(61200)).toBe('61,200원')
  })

  it('0원도 표시한다', () => {
    expect(formatWon(0)).toBe('0원')
  })

  it('소수점은 반올림한다', () => {
    expect(formatWon(61200.6)).toBe('61,201원')
  })
})

describe('formatPercent', () => {
  it('소수를 퍼센트로 바꾼다', () => {
    expect(formatPercent(0.283)).toBe('28.3%')
  })

  it('부호를 빼고 절댓값으로 보여준다', () => {
    expect(formatPercent(-0.0224)).toBe('2.2%')
  })

  it('자릿수를 지정할 수 있다', () => {
    expect(formatPercent(0.283, 0)).toBe('28%')
  })
})

describe('formatSignedPercent', () => {
  it('상승에는 +를 붙인다', () => {
    expect(formatSignedPercent(0.0064)).toBe('+0.6%')
  })

  it('하락에는 -를 붙인다', () => {
    expect(formatSignedPercent(-0.0224)).toBe('-2.2%')
  })

  it('보합은 0.0%다', () => {
    expect(formatSignedPercent(0)).toBe('0.0%')
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/domain/__tests__/format.test.ts`
Expected: FAIL — `Failed to resolve import "@/domain/format"`

- [ ] **Step 3: format 구현**

`src/domain/format.ts`:

```ts
const WON = new Intl.NumberFormat('ko-KR')

export function formatWon(value: number): string {
  return `${WON.format(Math.round(value))}원`
}

/** 절댓값 퍼센트. 부호는 배지의 문구와 색이 이미 말해준다 */
export function formatPercent(rate: number, digits = 1): string {
  return `${(Math.abs(rate) * 100).toFixed(digits)}%`
}

export function formatSignedPercent(rate: number, digits = 1): string {
  const sign = rate > 0 ? '+' : rate < 0 ? '-' : ''
  return `${sign}${(Math.abs(rate) * 100).toFixed(digits)}%`
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/domain/__tests__/format.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: PriceBadge와 QtyStepper 구현**

`src/components/PriceBadge.tsx`:

```tsx
import { formatPercent } from '@/domain/format'

/** 전일 종가 대비 등락을 쇼핑 언어로 번역한다 */
export function PriceBadge({ changeRate }: { changeRate: number }) {
  if (changeRate < 0) {
    return (
      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">
        🔥 세일중 {formatPercent(changeRate)}
      </span>
    )
  }
  if (changeRate > 0) {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
        ↑ 가격인상 {formatPercent(changeRate)}
      </span>
    )
  }
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
      보합
    </span>
  )
}
```

`src/components/QtyStepper.tsx`:

```tsx
'use client'

export function QtyStepper({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (qty: number) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`${label} 수량 줄이기`}
        onClick={() => onChange(value - 1)}
        className="h-8 w-8 rounded border border-slate-300 text-lg leading-none"
      >
        −
      </button>
      <span aria-label={`${label} 수량`} className="w-8 text-center tabular-nums">
        {value}
      </span>
      <button
        type="button"
        aria-label={`${label} 수량 늘리기`}
        onClick={() => onChange(value + 1)}
        className="h-8 w-8 rounded border border-slate-300 text-lg leading-none"
      >
        +
      </button>
    </div>
  )
}
```

- [ ] **Step 6: StockCard 실패 테스트 작성**

`src/components/__tests__/StockCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StockCard } from '@/components/StockCard'
import type { Quote } from '@/domain/types'

function quote(over: Partial<Quote> = {}): Quote {
  return {
    code: '005930',
    name: '삼성전자',
    price: 61200,
    prevClose: 62600,
    high52w: 85000,
    tradingHalted: false,
    asOf: '2026-09-03T05:00:00.000Z',
    ...over,
  }
}

describe('StockCard', () => {
  it('종목명과 현재가를 보여준다', () => {
    render(<StockCard quote={quote()} onAdd={vi.fn()} />)

    expect(screen.getByText('삼성전자')).toBeInTheDocument()
    expect(screen.getByText('61,200원')).toBeInTheDocument()
  })

  it('52주 최고가를 정가로 보여주고 할인율을 배지로 띄운다', () => {
    render(<StockCard quote={quote()} onAdd={vi.fn()} />)

    expect(screen.getByText('85,000원')).toBeInTheDocument()
    expect(screen.getByText('28% OFF')).toBeInTheDocument()
  })

  it('할인이 없으면 정가와 할인 배지를 숨긴다', () => {
    render(<StockCard quote={quote({ price: 85000 })} onAdd={vi.fn()} />)

    expect(screen.queryByText(/OFF/)).not.toBeInTheDocument()
  })

  it('전일 대비 하락이면 세일 배지를 띄운다', () => {
    render(<StockCard quote={quote()} onAdd={vi.fn()} />)

    expect(screen.getByText(/세일중/)).toBeInTheDocument()
  })

  it('전일 대비 상승이면 가격인상 배지를 띄운다', () => {
    render(<StockCard quote={quote({ price: 63000 })} onAdd={vi.fn()} />)

    expect(screen.getByText(/가격인상/)).toBeInTheDocument()
  })

  it('정가 기준을 명시한다', () => {
    render(<StockCard quote={quote()} onAdd={vi.fn()} />)

    expect(screen.getByText(/정가는 52주 최고가 기준/)).toBeInTheDocument()
  })

  it('수량을 정해 담으면 코드·수량·현재가를 넘긴다', async () => {
    const onAdd = vi.fn()
    render(<StockCard quote={quote()} onAdd={onAdd} />)

    await userEvent.click(screen.getByLabelText('삼성전자 수량 늘리기'))
    await userEvent.click(screen.getByRole('button', { name: '담기' }))

    expect(onAdd).toHaveBeenCalledWith('005930', 2, 61200)
  })

  it('수량은 1 아래로 내려가지 않는다', async () => {
    render(<StockCard quote={quote()} onAdd={vi.fn()} />)

    await userEvent.click(screen.getByLabelText('삼성전자 수량 줄이기'))
    expect(screen.getByLabelText('삼성전자 수량')).toHaveTextContent('1')
  })

  it('거래정지 종목은 담을 수 없다', () => {
    render(<StockCard quote={quote({ tradingHalted: true })} onAdd={vi.fn()} />)

    expect(screen.getByRole('button', { name: '거래정지' })).toBeDisabled()
  })
})
```

- [ ] **Step 7: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/components/__tests__/StockCard.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/StockCard"`

- [ ] **Step 8: StockCard 구현**

`src/components/StockCard.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type { Quote } from '@/domain/types'
import { discountFromHigh, changeFromPrevClose } from '@/domain/pricing'
import { formatWon, formatPercent } from '@/domain/format'
import { PriceBadge } from './PriceBadge'
import { QtyStepper } from './QtyStepper'

export function StockCard({
  quote,
  onAdd,
}: {
  quote: Quote
  onAdd: (code: string, qty: number, price: number) => void
}) {
  const [qty, setQty] = useState(1)

  const discount = discountFromHigh(quote.price, quote.high52w)
  const change = changeFromPrevClose(quote.price, quote.prevClose)
  const onSale = discount > 0

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header>
        <h3 className="font-semibold text-slate-900">{quote.name}</h3>
        <p className="text-xs text-slate-400">{quote.code}</p>
      </header>

      <div className="flex flex-wrap items-baseline gap-2">
        {onSale && (
          <s className="text-sm text-slate-400">{formatWon(quote.high52w)}</s>
        )}
        <strong className="text-xl font-bold text-slate-900">{formatWon(quote.price)}</strong>
        {onSale && (
          <span className="rounded bg-rose-600 px-1.5 py-0.5 text-xs font-bold text-white">
            {formatPercent(discount, 0)} OFF
          </span>
        )}
      </div>

      <PriceBadge changeRate={change} />

      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <QtyStepper value={qty} onChange={(next) => setQty(Math.max(1, next))} label={quote.name} />
        <button
          type="button"
          disabled={quote.tradingHalted}
          onClick={() => onAdd(quote.code, qty, quote.price)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
        >
          {quote.tradingHalted ? '거래정지' : '담기'}
        </button>
      </div>

      <p className="text-[11px] text-slate-400">정가는 52주 최고가 기준입니다</p>
    </article>
  )
}
```

- [ ] **Step 9: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/components/__tests__/StockCard.test.tsx`
Expected: PASS (9 tests)

- [ ] **Step 10: 커밋**

```bash
git add src/domain/format.ts src/domain/__tests__/format.test.ts src/components
git commit -m "feat: 표시 형식 함수와 상품 카드 컴포넌트 추가"
```

---

### Task 12: 장바구니 컨텍스트와 공통 레이아웃

검색 화면에서 담으면 헤더의 장바구니 개수가 **즉시** 바뀌어야 한다. 그러려면 장바구니 상태가 한 곳에 있어야 한다.

**Files:**
- Create: `src/components/CartProvider.tsx`
- Create: `src/components/SiteHeader.tsx`
- Modify: `src/app/layout.tsx` (create-next-app이 만든 파일 전체 교체)
- Test: `src/components/__tests__/CartProvider.test.tsx`

**Interfaces:**
- Consumes: `useCart` (Task 9)
- Produces:
  - `<CartProvider>{children}</CartProvider>`
  - `useCartContext(): ReturnType<typeof useCart>` — Provider 밖에서 부르면 에러를 던진다
  - `<SiteHeader />`

- [ ] **Step 1: 실패 테스트 작성**

`src/components/__tests__/CartProvider.test.tsx`:

```tsx
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
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/components/__tests__/CartProvider.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/CartProvider"`

- [ ] **Step 3: CartProvider 구현**

`src/components/CartProvider.tsx`:

```tsx
'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useCart } from '@/hooks/useCart'

type CartApi = ReturnType<typeof useCart>

const CartContext = createContext<CartApi | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const cart = useCart()
  return <CartContext.Provider value={cart}>{children}</CartContext.Provider>
}

export function useCartContext(): CartApi {
  const cart = useContext(CartContext)
  if (!cart) throw new Error('useCartContext는 CartProvider 안에서만 쓸 수 있습니다')
  return cart
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/components/__tests__/CartProvider.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: SiteHeader 구현**

`src/components/SiteHeader.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useCartContext } from './CartProvider'

export function SiteHeader() {
  const { items } = useCartContext()
  const count = items.reduce((sum, item) => sum + item.qty, 0)

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          주식 쇼핑
        </Link>
        <Link
          href="/cart"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700"
        >
          🛒 장바구니
          {count > 0 && (
            <span className="ml-1.5 rounded-full bg-rose-600 px-1.5 text-xs text-white">
              {count}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
```

- [ ] **Step 6: 레이아웃 교체**

`src/app/layout.tsx` 전체를 아래로 바꾼다.

```tsx
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
```

- [ ] **Step 7: 전체 테스트와 빌드 확인**

```bash
npm test
npm run build
```

Expected: 전부 PASS, 빌드 성공

- [ ] **Step 8: 커밋**

```bash
git add src/components src/app/layout.tsx
git commit -m "feat: 장바구니 컨텍스트와 공통 헤더·레이아웃 추가"
```

---

### Task 13: 검색 화면

**Files:**
- Create: `src/hooks/useStockSearch.ts`
- Modify: `src/app/page.tsx` (create-next-app이 만든 파일 전체 교체)
- Test: `src/hooks/__tests__/useStockSearch.test.tsx`
- Test: `src/app/__tests__/home-page.test.tsx`

**Interfaces:**
- Consumes: `StockSummary` (Task 2), `useQuotes` (Task 10), `useCartContext` (Task 12), `StockCard` (Task 11)
- Produces: `useStockSearch(query: string, opts?: { debounceMs?: number }): { stocks: StockSummary[]; loading: boolean }`

- [ ] **Step 1: useStockSearch 실패 테스트 작성**

`src/hooks/__tests__/useStockSearch.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useStockSearch } from '@/hooks/useStockSearch'

function searchResponse() {
  return new Response(
    JSON.stringify({ stocks: [{ code: '005930', name: '삼성전자', market: 'KOSPI' }] }),
    { status: 200 },
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useStockSearch', () => {
  it('빈 질의는 요청하지 않는다', async () => {
    const fetchMock = vi.fn(async () => searchResponse())
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useStockSearch(''))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.stocks).toEqual([])
  })

  it('디바운스 시간이 지난 뒤에만 요청한다', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => searchResponse())
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useStockSearch('삼성', { debounceMs: 250 }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(fetchMock).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('질의를 URL로 인코딩해 보낸다', async () => {
    const fetchMock = vi.fn(async () => searchResponse())
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useStockSearch('삼성', { debounceMs: 0 }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(String(fetchMock.mock.calls[0][0])).toBe(`/api/search?q=${encodeURIComponent('삼성')}`)
  })

  it('결과를 반환한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => searchResponse()))

    const { result } = renderHook(() => useStockSearch('삼성', { debounceMs: 0 }))

    await waitFor(() => expect(result.current.stocks).toHaveLength(1))
    expect(result.current.stocks[0].name).toBe('삼성전자')
  })

  it('요청이 실패하면 빈 결과로 둔다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))

    const { result } = renderHook(() => useStockSearch('삼성', { debounceMs: 0 }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.stocks).toEqual([])
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/hooks/__tests__/useStockSearch.test.tsx`
Expected: FAIL — `Failed to resolve import "@/hooks/useStockSearch"`

- [ ] **Step 3: useStockSearch 구현**

`src/hooks/useStockSearch.ts`:

```ts
'use client'

import { useEffect, useState } from 'react'
import type { StockSummary } from '@/domain/types'

const DEFAULT_DEBOUNCE_MS = 250

export function useStockSearch(query: string, opts: { debounceMs?: number } = {}) {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const [stocks, setStocks] = useState<StockSummary[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === '') {
      setStocks([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        if (!res.ok) throw new Error(`검색 실패: ${res.status}`)
        const body = (await res.json()) as { stocks: StockSummary[] }
        if (!cancelled) setStocks(body.stocks)
      } catch {
        if (!cancelled) setStocks([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, debounceMs)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, debounceMs])

  return { stocks, loading }
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/hooks/__tests__/useStockSearch.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: 검색 화면 실패 테스트 작성**

`src/app/__tests__/home-page.test.tsx`:

```tsx
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
})
```

- [ ] **Step 6: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/app/__tests__/home-page.test.tsx`
Expected: FAIL — create-next-app 기본 페이지에는 검색창이 없어 `Unable to find role="searchbox"`

- [ ] **Step 7: 검색 화면 구현**

`src/app/page.tsx` 전체를 아래로 바꾼다.

```tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useStockSearch } from '@/hooks/useStockSearch'
import { useQuotes } from '@/hooks/useQuotes'
import { useCartContext } from '@/components/CartProvider'
import { StockCard } from '@/components/StockCard'

export default function HomePage() {
  const [query, setQuery] = useState('')
  const { stocks, loading } = useStockSearch(query)
  const codes = useMemo(() => stocks.map((s) => s.code), [stocks])
  const { quotes } = useQuotes(codes)
  const { items, add } = useCartContext()

  const cartCount = items.reduce((sum, item) => sum + item.qty, 0)

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="mb-3 text-2xl font-bold">오늘 뭐 담을까요?</h1>
        <input
          type="search"
          role="searchbox"
          aria-label="종목 검색"
          placeholder="삼성전자, 005930 …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-slate-900"
        />
      </section>

      {cartCount > 0 && (
        <Link
          href="/cart"
          className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white"
        >
          장바구니에 {cartCount}주 담겨 있습니다 · 결제 화면 보기
        </Link>
      )}

      {query.trim() === '' ? (
        <p className="py-16 text-center text-slate-400">종목명이나 코드를 검색해보세요</p>
      ) : loading && stocks.length === 0 ? (
        <p className="py-16 text-center text-slate-400">찾는 중…</p>
      ) : stocks.length === 0 ? (
        <p className="py-16 text-center text-slate-400">일치하는 종목이 없습니다</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stocks.map((stock) => {
            const quote = quotes[stock.code]
            return (
              <li key={stock.code}>
                {quote ? (
                  <StockCard quote={quote} onAdd={add} />
                ) : (
                  <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 8: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/app/__tests__/home-page.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 9: 커밋**

```bash
git add src/hooks src/app/page.tsx src/app/__tests__
git commit -m "feat: 종목 검색 화면 추가"
```

---

### Task 14: 장바구니 화면

**Files:**
- Create: `src/app/cart/page.tsx`
- Test: `src/app/cart/__tests__/cart-page.test.tsx`

**Interfaces:**
- Consumes: `useCartContext` (Task 12), `useQuotes` (Task 10), `cartTotal`·`lineSubtotal`·`changeSinceAdded` (Task 2), `isMarketOpen` (Task 2), `QtyStepper` (Task 11), `formatWon`·`formatSignedPercent` (Task 11)
- Produces: `/cart` 화면

**폴링 규칙:** 장이 열려 있을 때만 7초 주기로 갱신한다. 폐장 중에는 값이 변하지 않으므로 호출을 아낀다.

- [ ] **Step 1: 실패 테스트 작성**

`src/app/cart/__tests__/cart-page.test.tsx`:

```tsx
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
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/app/cart/__tests__/cart-page.test.tsx`
Expected: FAIL — `Failed to resolve import "@/app/cart/page"`

- [ ] **Step 3: 구현**

`src/app/cart/page.tsx`:

```tsx
'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useCartContext } from '@/components/CartProvider'
import { useQuotes } from '@/hooks/useQuotes'
import { QtyStepper } from '@/components/QtyStepper'
import { cartTotal, lineSubtotal, changeSinceAdded } from '@/domain/pricing'
import { isMarketOpen } from '@/domain/market'
import { formatWon, formatSignedPercent } from '@/domain/format'

const POLL_MS = 7_000

export default function CartPage() {
  const { items, setQty, remove, clear } = useCartContext()
  const codes = useMemo(() => items.map((i) => i.code), [items])

  const marketOpen = isMarketOpen(new Date())
  const { quotes, stale } = useQuotes(codes, marketOpen ? { pollMs: POLL_MS } : {})

  const total = cartTotal(items, quotes)

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4 text-slate-400">장바구니가 비어 있습니다</p>
        <Link href="/" className="font-semibold text-slate-900 underline">
          종목 담으러 가기
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">장바구니</h1>
        <span className="text-xs text-slate-400">
          {marketOpen ? `장중 · ${POLL_MS / 1000}초마다 갱신` : '폐장 · 종가 기준'}
        </span>
      </div>

      {stale && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          ⚠️ 시세 지연 — 마지막으로 받은 가격으로 계산했습니다
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const quote = quotes[item.code]
          const since = quote ? changeSinceAdded(quote.price, item.addedPrice) : 0

          return (
            <li
              key={item.code}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="min-w-32 flex-1">
                <p className="font-semibold">{quote?.name ?? item.code}</p>
                <p className="text-xs text-slate-400">
                  {quote ? formatWon(quote.price) : '시세 조회 중…'}
                  {quote && (
                    <span className={since < 0 ? ' text-rose-600' : ' text-slate-500'}>
                      {' '}
                      · 담은 뒤 {formatSignedPercent(since)}
                    </span>
                  )}
                </p>
                {quote?.tradingHalted && (
                  <p className="text-xs font-semibold text-amber-600">
                    거래정지 — 총액에서 제외했습니다
                  </p>
                )}
              </div>

              <QtyStepper
                value={item.qty}
                onChange={(next) => setQty(item.code, next)}
                label={quote?.name ?? item.code}
              />

              <span
                data-testid={`subtotal-${item.code}`}
                className="w-28 text-right font-semibold tabular-nums"
              >
                {quote ? formatWon(lineSubtotal(quote, item.qty)) : '—'}
              </span>

              <button
                type="button"
                aria-label={`${quote?.name ?? item.code} 빼기`}
                onClick={() => remove(item.code)}
                className="text-sm text-slate-400 hover:text-slate-900"
              >
                ✕
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex items-center justify-between rounded-xl bg-slate-900 px-5 py-4 text-white">
        <span className="text-sm">현재가 기준 총액</span>
        <strong data-testid="cart-total" className="text-2xl font-bold tabular-nums">
          {formatWon(total)}
        </strong>
      </div>

      <div className="flex justify-between">
        <Link href="/" className="text-sm font-semibold text-slate-600 underline">
          계속 담기
        </Link>
        <button type="button" onClick={clear} className="text-sm text-slate-400">
          장바구니 비우기
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/app/cart/__tests__/cart-page.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: 전체 테스트와 빌드 확인**

```bash
npm test
npm run build
```

Expected: 전부 PASS, 빌드 성공

- [ ] **Step 6: 커밋**

```bash
git add src/app/cart
git commit -m "feat: 장바구니 화면 추가"
```

---

### Task 15: 문서화와 수동 검증

코드는 다 됐다. 이제 **실제로 브라우저에서 동작하는지** 확인하고 실행 방법을 남긴다.

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: 전체
- Produces: 없음

- [ ] **Step 1: README 작성**

`README.md` 전체를 아래로 바꾼다.

````markdown
# 주식 쇼핑 (stockShopping)

국내 주식을 쇼핑몰처럼 검색해 장바구니에 담고, 현재가 기준 총액을 확인하는 시뮬레이터.
주문·체결은 없다. "이 조합을 사려면 지금 얼마인가"에만 답한다.

가격 변동은 쇼핑 언어로 번역해 보여준다.

| 쇼핑몰 | 주식 |
|---|---|
| 정가 (취소선) | 52주 최고가 |
| 할인율 | 52주 최고가 대비 하락폭 |
| 🔥 세일중 | 전일 종가 대비 하락 |
| ↑ 가격인상 | 전일 종가 대비 상승 |

## 실행

```bash
npm install
npm run dev
```

**KIS 앱키 없이도 바로 돌아간다.** 환경변수가 없으면 가짜 시세(`MockProvider`)로 동작한다.

## 실제 시세 연결

한국투자증권 KIS Developers에서 앱키·시크릿을 발급받아 `.env.local`에 넣는다.

```bash
cp .env.example .env.local
# KIS_APP_KEY, KIS_APP_SECRET 채우기
```

## 테스트

```bash
npm test
```

## 문서

- 설계: `docs/superpowers/specs/2026-09-03-stock-shopping-design.md`
- 구현 계획: `docs/superpowers/plans/2026-09-03-stock-shopping-mvp.md`
````

- [ ] **Step 2: 개발 서버를 띄우고 직접 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 열고 아래를 눈으로 확인한다.

1. 검색창에 `삼성`을 입력하면 상품 카드가 뜬다
2. 카드에 취소선 정가와 `N% OFF` 배지가 보인다
3. 카드에 `🔥 세일중` 또는 `↑ 가격인상` 배지가 보인다
4. 수량을 2로 올리고 담으면 헤더의 장바구니 개수가 즉시 2로 바뀐다
5. `/cart`로 가면 소계와 총액이 보이고, 수량을 바꾸면 총액이 따라 바뀐다
6. 장중이라면 몇 초 뒤 가격과 총액이 저절로 갱신된다
7. 새로고침해도 장바구니가 남아 있다
8. 개발자 도구에서 네트워크를 끊고 새로고침하면 "시세 지연" 배너가 뜨거나 시세 조회 중으로 남고, **앱이 깨지지 않는다**

- [ ] **Step 3: 확인이 끝나면 커밋**

```bash
git add README.md
git commit -m "docs: 실행 방법과 프로젝트 소개 작성"
```

---

## 완료 기준

설계 문서의 성공 기준과 대응한다.

- [ ] 종목명으로 검색하면 결과가 즉시 뜬다 (로컬 마스터 검색이라 네트워크 왕복이 없다)
- [ ] 담기 → 수량 조절 → 총액 반영이 즉시 이뤄진다
- [ ] 장바구니 총액이 실제 현재가를 반영한다
- [ ] 시세 API가 실패해도 총액이 화면에서 사라지지 않고 "시세 지연"으로 표시된다
- [ ] `npm test` 전부 통과
- [ ] `npm run build` 성공
- [ ] KIS 앱키 없이 `npm run dev`만으로 전체 플로우가 동작한다

## 이 계획에서 의도적으로 제외한 것

로그인 · DB · 모의주문 · 체결 · 포트폴리오 · 수익률 · 미국 주식 · 차트 · 관심종목 ·
상품 상세 페이지 · 공휴일 판정 · KRX 전체 종목 마스터.

설계 문서 8절의 **"호출 제한 초과 시 캐시 TTL 자동 연장"도 구현하지 않는다.** 고정 5초 TTL,
한 번에 최대 50종목 제한, 그리고 종목당 하나로 수렴하는 캐시만으로 MVP의 호출량은 충분히
통제된다. 실제로 제한에 걸리는 것을 확인한 뒤에 넣는다.

확장 경로는 설계 문서 11절을 따른다.
