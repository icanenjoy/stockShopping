# 주식 쇼핑 (stockShopping)

국내·미국 주식을 쇼핑몰처럼 검색해 장바구니에 담고, 현재가 기준 총액을 확인하는 시뮬레이터.
주문·체결은 없다. "이 조합을 사려면 지금 얼마인가"에만 답한다.

미국 종목도 한글로 찾는다 — "애플", "테슬라", "코카콜라". KIS 종목 마스터가 한글명을 준다.

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

## 장바구니는 통화별로 나뉜다

원화와 달러를 하나로 더하면 아무 뜻도 없는 숫자가 나온다. 환율로 환산해 합칠 수도
있지만, 그러면 "지금 얼마인가"의 답이 환율 시점에 묶인다. 그래서 통화별 탭으로
나누고 총액도 따로 낸다.

## 종목 마스터

KIS가 배포하는 공개 마스터 파일에서 생성한다. 앱키가 필요 없다.

```bash
npm run build:master   # 국내 2,720 + 해외 6,699 종목 → src/data/stocks.generated.json
```

결과 JSON은 저장소에 커밋되어 있으므로 평소에는 실행할 필요가 없다.
상장·폐지를 반영하고 싶을 때만 다시 돌린다. 서버에서만 읽으므로 브라우저로
내려가지 않는다.

## 테스트

```bash
npm test
```

## 문서

- 설계: `docs/superpowers/specs/2026-09-03-stock-shopping-design.md`
- 구현 계획: `docs/superpowers/plans/2026-09-03-stock-shopping-mvp.md`
