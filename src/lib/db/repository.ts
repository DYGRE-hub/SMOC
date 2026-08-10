import type {
  Category,
  PrayerRequest,
  RequestStatus,
  EngagementSummary,
  Prayer,
  PrayerSort,
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
  /** 긴급만 보기. 응답된 건은 더 이상 긴급으로 세지 않는다. */
  urgentOnly?: boolean
  /**
   * 응답된 건을 빼고 보기.
   *
   * 기본값을 끄지 않고 부르는 쪽에서 켜게 둔다. listPrayers 는 목록 화면 말고도
   * 응답 화면·주간 요약·리더 내보내기가 함께 쓰는데, 저장소가 알아서 응답 건을
   * 감춰 버리면 정작 응답만 모으는 화면이 빈다.
   */
  hideAnswered?: boolean
  /**
   * 긴급 아래의 순서. 기본은 'updated'.
   * 긴급을 맨 위로 올리는 규칙 자체는 고를 수 없다 — 급한 건이 묻히면
   * 목록을 정렬하는 의미가 없다.
   */
  sort?: PrayerSort
}

/** 밖에서 들어온 요청 한 건. 로그인 없이 만들어지므로 담기는 값이 적다. */
export interface CreateRequestInput {
  churchId: string
  title: string
  body: string
  subject: string | null
  category: Category
  urgency: boolean
  requesterName: string | null
  requesterContact: string | null
  anonymous: boolean
  sourceHash: string | null
}

/** 새로 올라온 사진 한 장. 이미 줄여 둔 바이트가 들어온다. */
export interface NewImage {
  mime: string
  width: number
  height: number
  data: Buffer
}

export interface StoredImage {
  mime: string
  data: Buffer
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

/** 수정 가능한 필드. 작성자 표기는 일부러 빠져 있다. */
export interface EditPrayerInput {
  title: string
  body: string
  subject: string | null
  category: Category
  urgency: boolean
  visibility: Visibility
  prayUntil: string | null
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

  /**
   * 기도제목 수정. 본인 건이거나 리더 이상일 때만 통과한다.
   *
   * 이전 본문은 revision 으로 스냅샷되고 "n회 수정됨"이 붙는다(PRD §4.2).
   * 작성자 표기(authorMode)는 여기서 바꿀 수 없다 — 익명으로 올린 사람을
   * 나중에 기명으로 돌리거나 그 반대로 만드는 길을 열면 안 된다.
   */
  editPrayer(id: string, patch: EditPrayerInput, editor: User): Promise<boolean>

  addUpdate(
    prayerId: string,
    type: PrayerUpdate['type'],
    body: string,
    actor: User,
    image?: NewImage | null,
  ): Promise<void>

  /* ── 밖에서 들어온 기도 요청 ─────────────────────────────── */

  /**
   * 교회 id. 로그인하지 않은 사람이 요청을 올릴 때 쓴다.
   *
   * 환경변수를 하나 더 두지 않고 이미 있는 계정에서 읽는다. 교회는 하나뿐이고,
   * 설정 파일이 늘수록 배포할 때 빠뜨릴 자리도 함께 는다.
   */
  defaultChurchId(): Promise<string>

  /** 로그인 없이 부른다. 보는 눈이 없으므로 여기서는 아무것도 돌려주지 않는다. */
  createRequest(input: CreateRequestInput): Promise<string>

  /** 같은 곳에서 최근 몇 건이나 들어왔는지. 쏟아붓기를 막는 데만 쓴다. */
  countRecentRequests(sourceHash: string, sinceMinutes: number): Promise<number>

  listRequests(viewer: User, status: RequestStatus | null): Promise<PrayerRequest[]>
  getRequest(viewer: User, id: string): Promise<PrayerRequest | null>
  countPendingRequests(viewer: User): Promise<number>

  /**
   * 요청을 기도제목으로 옮긴다. 리더 이상만.
   * 옮겨진 요청은 published 로 잠기고 같은 건이 두 번 올라가지 않는다.
   * 성공하면 새로 생긴 기도제목 id, 권한이 없거나 이미 처리된 건이면 null.
   */
  publishRequest(id: string, patch: EditPrayerInput, actor: User): Promise<string | null>

  /** 올리지 않기로 한 요청. 지우지 않고 기록으로 남긴다. */
  declineRequest(id: string, actor: User, note: string | null): Promise<boolean>

  /**
   * 나눔 사진의 실제 바이트. 볼 수 없는 기도제목의 사진이면 null.
   *
   * 판정을 부르는 쪽에 맡기지 않고 여기서 함께 한다. 사진은 주소만 알면
   * 열리는 자리라, 열람 규칙을 한 군데서만 걸어 두면 언젠가 빠뜨린다.
   */
  getUpdateImage(viewer: User, imageId: string): Promise<StoredImage | null>

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

  /**
   * soft delete — 30일간 복구 가능. 본인 건이거나 리더 이상만.
   * 목록에서는 사라지지만 행은 남아 있어 되돌릴 수 있다.
   */
  softDeletePrayer(prayerId: string, actor: User): Promise<boolean>

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
