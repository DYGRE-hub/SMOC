import { CATEGORIES, type Category } from '@/lib/domain/types'

/**
 * 카카오톡 대화록 파서 (PRD §5 첫째 갈래).
 *
 * 카카오는 단톡방 대화를 외부 서버로 실시간 수집하는 공식 API를 제공하지 않는다.
 * 그래서 리더가 "대화 내용 내보내기"로 얻은 텍스트를 붙여넣는 경로를 쓴다.
 * iOS 와 Android 의 줄 포맷이 다르므로 양쪽을 모두 흡수한다.
 *
 * 여기서 나온 결과는 전부 "검토 대기"다. 자동 게시는 하지 않는다.
 * 신학적 뉘앙스와 개인의 사정을 기계가 판단하게 두어서는 안 되기 때문이다.
 */

export interface ParsedMessage {
  speaker: string
  at: string | null
  text: string
}

export interface DraftCandidate {
  speaker: string
  spokenAt: string | null
  rawExcerpt: string
  draftTitle: string
  draftBody: string
  draftCategory: Category
  sensitiveHits: string[]
}

export interface ParseResult {
  messages: ParsedMessage[]
  candidates: DraftCandidate[]
  lastMessageAt: string | null
}

// ─────────────────────────────────────────────────────────────
// 줄 파싱
// ─────────────────────────────────────────────────────────────

/** Android: `2026년 7월 28일 오후 9:14, 김은혜 : 내용` */
const ANDROID_LINE =
  /^(\d{4})년 (\d{1,2})월 (\d{1,2})일 (오전|오후) (\d{1,2}):(\d{2}), (.+?) : ([\s\S]*)$/

/** iOS: `[김은혜] [오후 9:14] 내용` */
const IOS_LINE = /^\[(.+?)\] \[(오전|오후) (\d{1,2}):(\d{2})\] ([\s\S]*)$/

/** iOS/Android 공통 날짜 구분선: `--------------- 2026년 7월 28일 화요일 ---------------` */
const DATE_DIVIDER = /^-+\s*(\d{4})년 (\d{1,2})월 (\d{1,2})일.*?-+$/

/** 시스템 줄 — 입장/퇴장/삭제 안내는 기도제목이 될 수 없다. */
const SYSTEM_LINE =
  /^(.*)(님이 (들어왔습니다|나갔습니다|초대했습니다)|삭제된 메시지입니다|저장한 날짜|채팅방 관리자)/

function toHour24(meridiem: string, hour: number): number {
  if (meridiem === '오전') return hour === 12 ? 0 : hour
  return hour === 12 ? 12 : hour + 12
}

function isoFrom(y: number, m: number, d: number, h: number, min: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return new Date(
    `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00+09:00`,
  ).toISOString()
}

export function parseKakaoTranscript(raw: string): ParsedMessage[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const messages: ParsedMessage[] = []
  // iOS 포맷은 줄마다 날짜가 없다. 직전 날짜 구분선을 기억해 두고 이어 붙인다.
  let currentDate: { y: number; m: number; d: number } | null = null

  for (const line of lines) {
    const divider = DATE_DIVIDER.exec(line.trim())
    if (divider) {
      currentDate = {
        y: Number(divider[1]),
        m: Number(divider[2]),
        d: Number(divider[3]),
      }
      continue
    }

    const android = ANDROID_LINE.exec(line)
    if (android) {
      const [, y, m, d, meridiem, h, min, speaker, text] = android
      messages.push({
        speaker: (speaker ?? '').trim(),
        at: isoFrom(
          Number(y),
          Number(m),
          Number(d),
          toHour24(meridiem ?? '오전', Number(h)),
          Number(min),
        ),
        text: (text ?? '').trim(),
      })
      continue
    }

    const ios = IOS_LINE.exec(line)
    if (ios) {
      const [, speaker, meridiem, h, min, text] = ios
      messages.push({
        speaker: (speaker ?? '').trim(),
        at: currentDate
          ? isoFrom(
              currentDate.y,
              currentDate.m,
              currentDate.d,
              toHour24(meridiem ?? '오전', Number(h)),
              Number(min),
            )
          : null,
        text: (text ?? '').trim(),
      })
      continue
    }

    // 어느 포맷에도 맞지 않는 줄은 직전 메시지의 이어지는 줄로 본다.
    // 카카오 내보내기는 줄바꿈이 포함된 메시지를 그대로 여러 줄로 쓴다.
    const previous = messages[messages.length - 1]
    if (previous && line.trim()) {
      previous.text = `${previous.text}\n${line.trim()}`.trim()
    }
  }

  return messages.filter((m) => m.text && !SYSTEM_LINE.test(m.text) && !SYSTEM_LINE.test(m.speaker))
}

// ─────────────────────────────────────────────────────────────
// 기도 요청 추출
// ─────────────────────────────────────────────────────────────

/** 부탁의 표지 — 이게 있으면 기도 요청일 가능성이 높다. */
const REQUEST_MARKERS = [
  /기도\s*(?:좀|많이)?\s*(?:부탁|해\s*주|드립니다|합니다|요청)/,
  /중보\s*(?:부탁|요청)/,
  /기도\s*제목/,
  /함께\s*기도/,
  /기도가\s*필요/,
]

/** 상황의 표지 — 부탁 표현이 없어도 사정이 적혀 있으면 후보로 올린다. */
const SITUATION_MARKERS = [
  /수술|입원|중환자|응급실|진단|항암|검사\s*결과/,
  /실직|해고|권고사직|폐업|부도/,
  /이혼|별거|가출/,
  /사고|장례|소천|위독/,
  /시험|수능|면접|합격/,
]

/** 잡담·반응만 있는 줄은 걸러낸다. */
const NOISE = /^(ㅋ+|ㅎ+|넵|넹|네+|아멘+|감사합니다|고맙습니다|굿|👍|🙏|\.|\s)*$/

/**
 * 카테고리 규칙.
 *
 * 순서가 곧 우선순위다. 한 메시지에 여러 단서가 섞이는 일이 흔하기 때문에
 * (예: "남편이 실직해서 아이들에게 뭐라 말할지") 매치 개수로 점수를 매기고,
 * 동점이면 위쪽 규칙이 이긴다. 사람이 그 글을 요약할 때 무엇을 핵심으로
 * 볼지에 가깝도록, 삶을 크게 흔드는 사건을 위에 두었다.
 */
const CATEGORY_RULES: [Category, RegExp][] = [
  ['healing', /수술|병원|입원|중환자|아프|치유|암|검사|건강|통증|진단|항암/g],
  ['finance', /재정|빚|대출|생활비|실직|월세|폐업|부도|파산/g],
  ['work', /직장|이직|면접|취업|사업|승진|회사|권고사직|해고/g],
  ['family', /남편|아내|부모|가정|시댁|친정|가족|이혼|별거/g],
  ['children', /아이|자녀|아들|딸|수능|시험|학교|입시|유치원|학원/g],
  ['salvation', /구원|전도|믿음|예수|복음|영접|불신/g],
  ['mission', /선교|파송|현지|단기선교/g],
  ['thanks', /감사|응답|기쁨|축하|은혜/g],
  ['church', /교회|사역|예배|목장|셀|새가족|찬양/g],
]

const URGENT = /긴급|급하게|지금\s*바로|위독|응급|중환자|당장/

/** PRD §5 — 전화번호·주소·병원명 같은 식별 정보는 마스킹 후보로 표시한다. */
const SENSITIVE_PATTERNS: [string, RegExp][] = [
  ['전화번호', /01[016-9][-\s.]?\d{3,4}[-\s.]?\d{4}/g],
  ['전화번호', /0\d{1,2}[-\s.]\d{3,4}[-\s.]\d{4}/g],
  ['이메일', /[\w.+-]+@[\w-]+\.[\w.]+/g],
  ['주소', /[가-힣]+(?:시|도)\s?[가-힣]+(?:구|군|시)\s?[가-힣0-9]+(?:동|로|길)\s?[\d-]*/g],
  ['병원명', /[가-힣A-Za-z]{2,10}(?:병원|의원|한의원|요양원)/g],
  ['주민등록번호', /\d{6}[-\s]?\d{7}/g],
]

export function detectSensitive(text: string): string[] {
  const hits = new Set<string>()
  for (const [label, pattern] of SENSITIVE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      hits.add(`${label}: ${match[0]}`)
    }
  }
  return [...hits]
}

function guessCategory(text: string): Category {
  if (URGENT.test(text)) return 'urgent'

  let best: Category | null = null
  let bestScore = 0
  for (const [category, pattern] of CATEGORY_RULES) {
    const score = [...text.matchAll(pattern)].length
    // 동점이면 먼저 선언된 규칙이 이긴다.
    if (score > bestScore) {
      bestScore = score
      best = category
    }
  }
  return best ?? 'church'
}

/**
 * "여러분 기도 부탁드립니다" 같은 상투구.
 * 이런 문장만으로는 무엇을 위한 기도인지 알 수 없으므로 제목에서 걷어낸다.
 */
const BOILERPLATE =
  /(?:여러분|성도님들|모두들?|다들|저도)?\s*(?:같이|함께)?\s*(?:긴급\s*)?(?:중보\s*)?기도\s*(?:제목|요청|좀|많이)?\s*(?:부탁\s*)?(?:드립니다|드려요|드릴게요|드릴게|합니다|할게요|할게|하겠습니다|하겠어요|해요|해\s*주세요|해\s*주시겠어요|요청드립니다|부탁해요|부탁드려요|부탁)?[.!~\s]*/g

function stripBoilerplate(sentence: string): string {
  return sentence.replace(BOILERPLATE, ' ').replace(/\s+/g, ' ').trim()
}

function makeTitle(text: string): string {
  const sentences = text
    .split(/(?<=[.!?。])\s+|\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  // 상투구를 걷어내고도 내용이 남는 첫 문장을 제목으로 쓴다.
  // 전부 상투구뿐이면 어쩔 수 없이 원문 첫 문장으로 돌아간다.
  let chosen = ''
  for (const sentence of sentences) {
    const stripped = stripBoilerplate(sentence)
    if (stripped.length >= 6) {
      chosen = stripped
      break
    }
  }
  if (!chosen) chosen = stripBoilerplate(text) || (sentences[0] ?? text)

  const cleaned = chosen.replace(/\s+/g, ' ').replace(/[.,]$/, '').trim()
  return cleaned.length > 40 ? `${cleaned.slice(0, 40)}…` : cleaned
}

/**
 * 여러 메시지에 걸친 하나의 요청을 묶는다.
 * 같은 사람이 5분 안에 이어서 보낸 줄은 한 덩어리로 본다 — 단톡방에서
 * 사정을 여러 줄로 나눠 적는 것이 보통이기 때문이다.
 */
function groupMessages(messages: ParsedMessage[]): ParsedMessage[] {
  const grouped: ParsedMessage[] = []
  const WINDOW_MS = 5 * 60 * 1000

  for (const message of messages) {
    const previous = grouped[grouped.length - 1]
    const sameSpeaker = previous?.speaker === message.speaker
    const closeInTime =
      previous?.at && message.at
        ? new Date(message.at).getTime() - new Date(previous.at).getTime() <= WINDOW_MS
        : Boolean(previous) && !message.at

    if (previous && sameSpeaker && closeInTime) {
      previous.text = `${previous.text}\n${message.text}`
      continue
    }
    grouped.push({ ...message })
  }

  return grouped
}

export function extractCandidates(messages: ParsedMessage[]): DraftCandidate[] {
  const grouped = groupMessages(messages)
  const candidates: DraftCandidate[] = []

  for (const message of grouped) {
    const text = message.text.trim()
    if (!text || NOISE.test(text)) continue
    if (text.length < 8) continue

    const isRequest = REQUEST_MARKERS.some((p) => p.test(text))
    const isSituation = SITUATION_MARKERS.some((p) => p.test(text))
    if (!isRequest && !isSituation) continue

    // "아멘 함께 기도할게요" 같은 반응은 표지에 걸리지만 요청이 아니다.
    // 상투구를 걷어냈을 때 남는 내용이 없으면 초안으로 올리지 않는다.
    // 리더에게 폐기 버튼을 누르게 만드는 것도 결국 일이다.
    if (!isSituation && stripBoilerplate(text).replace(/^(아멘|할렐루야|저도)[\s,.!]*/, '').length < 8) {
      continue
    }

    candidates.push({
      speaker: message.speaker,
      spokenAt: message.at,
      rawExcerpt: text,
      draftTitle: makeTitle(text),
      draftBody: text,
      draftCategory: guessCategory(text),
      sensitiveHits: detectSensitive(text),
    })
  }

  return candidates
}

export function parseTranscript(raw: string): ParseResult {
  const messages = parseKakaoTranscript(raw)
  const withTime = messages.filter((m) => m.at)
  const lastMessageAt = withTime.length > 0 ? (withTime[withTime.length - 1]?.at ?? null) : null

  return {
    messages,
    candidates: extractCandidates(messages),
    lastMessageAt,
  }
}
