import type {
  Category,
  EngagementSummary,
  Prayer,
  PrayerUpdate,
  PrayerWithEngagement,
  Role,
  Status,
  User,
  Visibility,
} from '@/lib/domain/types'
import type { ImportDraft, ImportRecord } from '@/lib/db/local-store'

export interface PrayerFilter {
  /** 제목·본문 부분 일치 */
  q?: string
  category?: Category | null
  status?: Status | null
  /** 긴급만 보기 */
  urgentOnly?: boolean
}

export interface CreatePrayerInput {
  churchId: string
  groupId: string | null
  title: string
  body: string
  /** 기도 대상자. 본인을 위한 기도면 null. */
  subject: string | null
  category: Category
  urgency: boolean
  visibility: Visibility
  authorMode: Prayer['authorMode']
  /** 실제 작성자. 익명이어도 여기로 들어오며, 저장 시 분리 보관된다. */
  authorId: string | null
  authorDisplayName: string | null
  prayUntil: string | null
  source: Prayer['source']
}

export interface PrayerDetail {
  prayer: Prayer
  engagement: EngagementSummary
  updates: PrayerUpdate[]
}

/** 감사 로그 한 줄 (PRD §4.2, §8) */
export interface AuditEntry {
  actorId: string | null
  action: string
  targetType: string
  targetId: string
  meta?: Record<string, unknown>
}

/** 하루치 기도 기록. 트래커의 최소 단위. */
export interface TrackerDay {
  dateKey: string
  count: number
  /** 그날의 미션을 다 채웠는지 */
  complete: boolean
}

/**
 * 나만의 기도 트래커 (개인 전용).
 * 다른 사람에게는 어떤 형태로도 노출되지 않는다.
 */
export interface TrackerSummary {
  /** 오늘의 미션 목록 */
  mission: PrayerWithEngagement[]
  doneToday: number
  totalToday: number
  /** 오늘까지 이어온 연속 일수 */
  streak: number
  /** 최근 14일 기록 (오래된 날부터) */
  history: TrackerDay[]
  /** 누적 기도 횟수 */
  lifetimeCount: number
}

/**
 * 데이터 접근 경계. 화면과 서버 액션은 이 인터페이스만 알고,
 * 뒤에 무엇이 있는지는 신경 쓰지 않는다.
 *
 * viewer 를 모든 읽기 메서드에 강제로 받는 이유는, 공개범위 판정을
 * 호출자가 잊어버릴 수 없게 만들기 위해서다.
 */
export interface Repository {
  getUserById(id: string): Promise<User | null>
  listUsers(churchId: string): Promise<User[]>
  /** 관리자 전용 — 역할 변경 */
  setRole(userId: string, role: Role, actor: User): Promise<void>

  listPrayers(viewer: User, filter?: PrayerFilter): Promise<PrayerWithEngagement[]>
  getPrayer(viewer: User, id: string): Promise<PrayerDetail | null>
  createPrayer(input: CreatePrayerInput): Promise<string>

  /** 본문 수정. 이전 본문은 revision 으로 스냅샷된다(PRD §4.2). */
  editPrayerBody(id: string, body: string, editor: User): Promise<void>

  addUpdate(
    prayerId: string,
    type: PrayerUpdate['type'],
    body: string,
    actor: User,
  ): Promise<void>

  /**
   * 나눔(댓글) 수정. 본인 글이거나 리더 이상일 때만 통과한다.
   *
   * comment 타입만 손댈 수 있다. status_change·answer·edit 은 시스템이 남긴
   * 기록이라 그대로 둔다 — 특히 answer 는 상태 줄과 한 덩어리라 고치면 어긋난다.
   *
   * 권한이 없거나 대상이 아니면 false 를 돌려주고 아무것도 바꾸지 않는다.
   */
  editComment(updateId: string, body: string, actor: User): Promise<boolean>
  deleteComment(updateId: string, actor: User): Promise<boolean>

  setStatus(prayerId: string, status: Status, actor: User, note?: string): Promise<void>

  /**
   * 카드에 미리 보여줄 최근 나눔.
   * 상세를 연 것이 아니므로 민감 등급 열람 감사 로그를 남기지 않는다.
   */
  listComments(viewer: User, prayerId: string, limit: number): Promise<PrayerUpdate[]>

  /** soft delete — 30일간 복구 가능 */
  softDeletePrayer(prayerId: string, actor: User): Promise<void>

  /** 하루 1회. 이미 눌렀으면 아무 일도 하지 않고 현재 상태를 돌려준다. */
  markPrayed(prayerId: string, user: User): Promise<EngagementSummary>
  /** 트래커에서 체크를 해제할 때 쓴다. 오늘 기록만 지운다. */
  unmarkPrayed(prayerId: string, user: User): Promise<EngagementSummary>

  /** PRD §4.3 — 오늘의 기도 큐 */
  todayQueue(viewer: User, size: number): Promise<PrayerWithEngagement[]>

  /** 나만의 기도 트래커 */
  tracker(viewer: User): Promise<TrackerSummary>

  // ── 대화록 정리 (PRD §5) ────────────────────────────────
  createImport(input: {
    churchId: string
    uploaderId: string
    label: string
    messageCount: number
    lastMessageAt: string | null
    drafts: Omit<ImportDraft, 'id' | 'importId' | 'decision' | 'prayerId' | 'createdAt'>[]
  }): Promise<string>
  listImports(churchId: string): Promise<ImportRecord[]>
  listDrafts(importId: string): Promise<ImportDraft[]>
  listPendingDrafts(churchId: string): Promise<{ draft: ImportDraft; label: string }[]>
  /** 승인하면 그때 비로소 기도제목이 만들어진다. 자동 게시는 없다. */
  decideDraft(
    draftId: string,
    decision: 'approved' | 'discarded',
    edited: {
      title: string
      body: string
      /** 대화록에서 온 건은 말한 사람이 곧 기도 대상자다. */
      subject: string | null
      category: Category
      visibility: Visibility
      authorMode: Prayer['authorMode']
    } | null,
    actor: User,
  ): Promise<string | null>

  writeAudit(entry: AuditEntry): Promise<void>
}
