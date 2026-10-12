/**
 * KIS가 배포하는 종목 마스터 파일을 받아 검색용 JSON으로 만든다.
 *
 * 인증이 필요 없는 공개 배포 파일이므로 앱키 없이도 돌아간다.
 * 결과(src/data/stocks.generated.json)는 저장소에 커밋한다 — 런타임에
 * 네트워크를 타지 않아야 검색이 즉시 응답하고, 상류 장애에 끌려가지 않는다.
 *
 * 상장·폐지를 반영하려면 다시 실행한다: npm run build:master
 *
 * unzip(1)을 쓴다. Node에 zip 해제가 없고, 이 스크립트 하나 때문에
 * 런타임 의존성을 추가하고 싶지 않다.
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://new.real.download.dws.co.kr/common/master'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'stocks.generated.json')

/** 국내: 증권그룹구분코드 ST만 주권. EF(ETF)·EN(ETN)·BC 등은 제외한다 */
const KR_STOCK_GROUP = 'ST'
/** 해외: 종목유형 2가 주식, 3은 ETF */
const US_STOCK_TYPE = '2'

const KR_SOURCES = [
  { file: 'kospi_code.mst.zip', market: 'KOSPI' },
  { file: 'kosdaq_code.mst.zip', market: 'KOSDAQ' },
]
const US_SOURCES = [
  { file: 'nasmst.cod.zip', market: 'NAS' },
  { file: 'nysmst.cod.zip', market: 'NYS' },
  { file: 'amsmst.cod.zip', market: 'AMS' },
]

const decoder = new TextDecoder('euc-kr') // WHATWG euc-kr은 CP949를 해석한다

async function fetchUnzipped(work, file) {
  const res = await fetch(`${BASE}/${file}`)
  if (!res.ok) throw new Error(`마스터 내려받기 실패: ${file} ${res.status}`)
  const zipPath = join(work, file)
  writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()))
  return execFileSync('unzip', ['-p', zipPath], { maxBuffer: 64 * 1024 * 1024 })
}

/**
 * 국내 마스터는 288바이트 고정폭이다. 한글명이 CP949 가변바이트라
 * 문자 단위로 자르면 경계가 어긋난다 — 반드시 바이트로 자른다.
 */
function parseKr(buf, market) {
  const stocks = []
  for (const line of splitLines(buf)) {
    if (line.length < 63) continue
    if (decoder.decode(line.subarray(61, 63)).trim() !== KR_STOCK_GROUP) continue
    const code = decoder.decode(line.subarray(0, 9)).trim()
    const name = decoder.decode(line.subarray(21, 61)).trim()
    if (code && name) stocks.push({ code, name, market, currency: 'KRW' })
  }
  return stocks
}

/** 해외 마스터는 탭 구분 24컬럼. 한글명(6)이 전 종목에 채워져 있다 */
function parseUs(buf, market) {
  const stocks = []
  for (const line of splitLines(buf)) {
    const cols = decoder.decode(line).split('\t')
    if (cols.length < 10 || cols[8] !== US_STOCK_TYPE) continue
    const code = cols[4].trim()
    const name = cols[6].trim()
    const englishName = cols[7].trim()
    if (code && name) stocks.push({ code, name, englishName, market, currency: 'USD' })
  }
  return stocks
}

function splitLines(buf) {
  const lines = []
  let start = 0
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0a) {
      let end = i
      if (end > start && buf[end - 1] === 0x0d) end--
      if (end > start) lines.push(buf.subarray(start, end))
      start = i + 1
    }
  }
  if (start < buf.length) lines.push(buf.subarray(start))
  return lines
}

const work = mkdtempSync(join(tmpdir(), 'kis-master-'))
try {
  const stocks = []
  for (const { file, market } of KR_SOURCES) {
    const parsed = parseKr(await fetchUnzipped(work, file), market)
    console.log(`${market}: ${parsed.length}종목`)
    stocks.push(...parsed)
  }
  for (const { file, market } of US_SOURCES) {
    const parsed = parseUs(await fetchUnzipped(work, file), market)
    console.log(`${market}: ${parsed.length}종목`)
    stocks.push(...parsed)
  }

  // 같은 심볼이 여러 거래소에 있으면 앞선 것만 남긴다. 시세 조회가 코드 하나로
  // 거래소를 특정해야 하므로, 중복을 남기면 어느 쪽 가격인지 말할 수 없다.
  const seen = new Set()
  const unique = stocks.filter((s) => !seen.has(s.code) && seen.add(s.code))
  const dropped = stocks.length - unique.length

  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), stocks: unique }) + '\n')
  console.log(`\n총 ${unique.length}종목 → ${OUT}`)
  if (dropped > 0) console.log(`중복 심볼 ${dropped}개는 앞선 거래소만 남겼습니다`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
