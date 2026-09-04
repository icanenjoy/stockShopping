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

`KIS_BASE_URL`은 선택 항목이다. 비워두면 실전 서버로 붙는다.
모의투자 계정을 쓴다면 `https://openapivts.koreainvestment.com:29443`을 직접 적어야 한다.

앱키·시크릿이 없으면 가짜 시세로 동작하며, 서버 로그에
`[provider] KIS 자격증명 없음 — MockProvider(가짜 시세)로 동작합니다` 경고가 남는다.

## 테스트

```bash
npm test
```

## 문서

- 설계: `docs/superpowers/specs/2026-09-03-stock-shopping-design.md`
- 구현 계획: `docs/superpowers/plans/2026-09-03-stock-shopping-mvp.md`
