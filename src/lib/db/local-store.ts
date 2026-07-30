import 'server-only'

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'

import type { Prayer, PrayerUpdate } from '@/lib/domain/types'
import { dateKey } from '@/lib/timezone'
import type { AccountRecord } from '@/lib/db/accounts'

/**
 * 로컬 파일 저장소.
 *
 * Supabase 를 붙이기 전까지 이 앱의 실제 백엔드다. 메모리가 아니라 JSON 파일에
 * 쓰기 때문에 서버를 재시작해도 가입한 계정과 기도제목이 남는다.
 * 계정 기능이 의미를 가지려면 영속성이 전제여야 하므로 이렇게 했다.
 *
 * 단일 프로세스(`next start` 기본값)를 가정한다. 여러 인스턴스로 늘릴 때는
 * 이 파일을 Postgres 로 교체해야 한다 — 그래서 모든 접근이 Repository 뒤에 있다.
 */

const DATA_FILE = process.env.GOLBANG_DATA_FILE ?? join(process.cwd(), '.data', 'golbang.json')

export type Account = AccountRecord

export interface Engagement {
  prayerId: string
  userId: string
  kind: 'prayed' | 'committed'
  dateKey: string
  createdAt: string
}

export interface Revision {
  prayerId: string
  prevBody: string
  editorId: string
  createdAt: string
}

export interface AuditRow {
  actorId: string | null
  action: string
  targetType: string
  targetId: string
  meta: Record<string, unknown>
  createdAt: string
}

/** 대화록 업로드 한 건 (PRD §5) */
export interface ImportRecord {
  id: string
  churchId: string
  uploaderId: string
  label: string
  messageCount: number
  lastMessageAt: string | null
  createdAt: string
}

/** 검수 대기 중인 AI/파서 초안. 자동 게시는 절대 하지 않는다. */
export interface ImportDraft {
  id: string
  importId: string
  rawExcerpt: string
  speaker: string
  spokenAt: string | null
  draftTitle: string
  draftBody: string
  draftCategory: Prayer['category']
  /** 마스킹 후보로 잡힌 조각들 — 리더가 눈으로 확인하라고 남긴다. */
  sensitiveHits: string[]
  decision: 'pending' | 'approved' | 'discarded'
  prayerId: string | null
  createdAt: string
}

/**
 * 하루치 고정된 기도 미션.
 *
 * 매번 다시 계산하면 체크할 때마다 순위가 흔들려 목록이 눈앞에서 재배열된다.
 * "오늘의 미션"은 아침에 정해지고 하루 동안 그대로여야 의미가 있으므로,
 * 그날 처음 열었을 때의 목록을 그대로 얼려 둔다.
 */
export interface DailyMission {
  userId: string
  dateKey: string
  prayerIds: string[]
}

interface StoreState {
  version: number
  sessionSecret: string
  missions: DailyMission[]
  accounts: Account[]
  prayers: Prayer[]
  updates: PrayerUpdate[]
  engagements: Engagement[]
  revisions: Revision[]
  /** 익명 요청의 실제 작성자. 읽기 함수를 만들지 않는다. */
  authorPrivate: Record<string, string>
  audit: AuditRow[]
  imports: ImportRecord[]
  importDrafts: ImportDraft[]
}

export const DEFAULT_CHURCH_ID = 'church-1'

const globalRef = globalThis as unknown as { __golbangStore?: StoreState }

function emptyState(): StoreState {
  return {
    version: 1,
    sessionSecret: randomBytes(32).toString('hex'),
    missions: [],
    accounts: [],
    prayers: [],
    updates: [],
    engagements: [],
    revisions: [],
    authorPrivate: {},
    audit: [],
    imports: [],
    importDrafts: [],
  }
}

function load(): StoreState {
  try {
    const raw = readFileSync(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw) as StoreState
    // 필드가 늘어나도 예전 파일이 그대로 열리도록 기본값과 병합한다.
    return { ...emptyState(), ...parsed }
  } catch {
    return emptyState()
  }
}

export function state(): StoreState {
  if (!globalRef.__golbangStore) globalRef.__golbangStore = load()
  return globalRef.__golbangStore
}

export function persist(): void {
  const s = state()
  try {
    mkdirSync(dirname(DATA_FILE), { recursive: true })
    writeFileSync(DATA_FILE, JSON.stringify(s, null, 2), 'utf8')
  } catch (error) {
    // 저장에 실패해도 요청은 살려 보낸다. 다만 조용히 넘어가지는 않는다.
    console.error('로컬 저장소 쓰기 실패:', error)
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`
}

export { dateKey }
