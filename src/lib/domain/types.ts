/**
 * PRD §7 데이터 모델을 타입으로 옮긴 것.
 * DB 스키마(supabase/migrations)와 1:1로 대응하며, 값이 바뀌면 양쪽을 함께 고쳐야 한다.
 */

export const ROLES = ['guest', 'intercessor', 'leader', 'admin'] as const
export type Role = (typeof ROLES)[number]

/** 권한 비교용 서열. guest < intercessor < leader < admin */
export const ROLE_RANK: Record<Role, number> = {
  guest: 0,
  intercessor: 1,
  leader: 2,
  admin: 3,
}

export const VISIBILITIES = ['public', 'group', 'leaders_only'] as const
export type Visibility = (typeof VISIBILITIES)[number]

export const AUTHOR_MODES = ['named', 'initials', 'anonymous'] as const
export type AuthorMode = (typeof AUTHOR_MODES)[number]

export const STATUSES = ['active', 'answered', 'ongoing', 'paused', 'closed'] as const
export type Status = (typeof STATUSES)[number]

export const UPDATE_TYPES = ['comment', 'status_change', 'answer', 'edit'] as const
export type UpdateType = (typeof UPDATE_TYPES)[number]

export const ENGAGEMENT_KINDS = ['prayed'] as const
export type EngagementKind = (typeof ENGAGEMENT_KINDS)[number]

/** PRD §4.1 — 기본 10종. 교회별로 편집 가능하다는 전제이므로 DB 이전(移轉)을 염두에 두고 배열로 둔다. */
export const CATEGORIES = [
  'healing',
  'family',
  'children',
  'work',
  'finance',
  'salvation',
  'church',
  'mission',
  'thanks',
  'urgent',
] as const
export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABEL: Record<Category, string> = {
  healing: '질병·치유',
  family: '가정',
  children: '자녀·학업',
  work: '직장·진로',
  finance: '재정',
  salvation: '구원·전도',
  church: '교회·사역',
  mission: '선교',
  thanks: '감사',
  urgent: '긴급',
}

export const STATUS_LABEL: Record<Status, string> = {
  active: '진행 중',
  answered: '응답됨',
  ongoing: '계속 기도',
  paused: '보류',
  closed: '종료',
}

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  public: '모임 전체',
  group: '우리 셀',
  leaders_only: '리더에게만',
}

export const AUTHOR_MODE_LABEL: Record<AuthorMode, string> = {
  named: '이름 밝히기',
  initials: '이니셜만',
  anonymous: '익명',
}

export const ROLE_LABEL: Record<Role, string> = {
  guest: '게스트',
  intercessor: '중보자',
  leader: '리더',
  admin: '관리자',
}

export interface User {
  id: string
  /** 실명. 리더가 멤버를 식별할 때만 쓰고, 다른 멤버에게는 노출하지 않는다. */
  name: string
  /**
   * 표시 ID — 기도제목과 타임라인에 보이는 이름.
   * 설정에서 언제든 바꿀 수 있다. 실명을 그대로 쓰고 싶지 않은 사람이
   * 익명까지 가지 않고도 거리를 둘 수 있게 하는 장치다.
   */
  displayName: string
  role: Role
  churchId: string
  groupId: string | null
  email: string | null
}

export interface Prayer {
  id: string
  churchId: string
  groupId: string | null
  title: string
  body: string
  category: Category
  urgency: boolean
  visibility: Visibility
  authorMode: AuthorMode
  /**
   * 화면에 노출해도 되는 작성자 식별자.
   * authorMode 가 anonymous 면 null 이고, 실제 작성자는 prayer_author_private 에만 남는다.
   * (PRD §3 — 어떤 역할로도 조회 API가 존재하지 않는다)
   */
  authorIdPublic: string | null
  authorDisplayName: string | null
  status: Status
  /** "언제까지 기도해 주세요" — PRD §4.1 */
  prayUntil: string | null
  source: 'app' | 'guest_link' | 'import'
  /** 어떤 리스트/대화록에서 들어왔는지 (PRD §7 source_ref) */
  sourceRef?: string | null
  createdAt: string
  updatedAt: string
  revisionCount: number
}

export interface PrayerUpdate {
  id: string
  prayerId: string
  type: UpdateType
  body: string
  authorDisplayName: string | null
  createdAt: string
}

export interface EngagementSummary {
  /** 누적 총계 */
  total: number
  /** 오늘 기도한 사람 수 — "오늘 12명이 함께 기도했어요" */
  today: number
  /** 이 제목에 달린 나눔(댓글) 수 */
  commentCount: number
  /** 현재 사용자가 오늘 이미 기도했는지 (하루 1회 제한) */
  viewerPrayedToday: boolean
  /** 큐 가중치 계산에 쓰는, 최근 7일간 받은 기도 수 */
  recentCount: number
}

/** 목록/카드 화면이 필요로 하는 최소 단위 */
export interface PrayerWithEngagement {
  prayer: Prayer
  engagement: EngagementSummary
}

/**
 * 화면에 표시할 작성자 이름을 익명 규칙에 맞춰 만든다.
 * 상세·타임라인·내보내기 등 이름을 그리는 모든 곳은 반드시 이 함수를 거친다.
 */
export function displayAuthor(
  authorMode: AuthorMode,
  displayName: string | null,
): string {
  if (authorMode === 'anonymous' || !displayName) return '익명'
  if (authorMode === 'initials') return toInitials(displayName)
  return displayName
}

/** 한글 이름은 성만 남기고 가운뎃점 처리, 라틴 문자는 이니셜을 딴다. */
export function toInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '익명'
  if (/^[가-힣]+$/.test(trimmed)) {
    const first = trimmed[0] ?? ''
    return `${first}${'○'.repeat(Math.max(trimmed.length - 1, 1))}`
  }
  return trimmed
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('.')
}

export function isLeader(role: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.leader
}

/**
 * PRD §3 권한표의 열람 규칙.
 * 게스트는 링크로 작성만 할 수 있고 어떤 제목도 열람하지 못한다.
 * 'group' 은 같은 셀에 속한 중보자에게만 보인다.
 * 이 함수는 UI 판단용이고, 진짜 방어선은 DB의 RLS 정책이다(PRD §7).
 */
export function canSee(
  viewer: { role: Role; groupId: string | null },
  prayer: { visibility: Visibility; groupId: string | null },
): boolean {
  if (viewer.role === 'guest') return false
  if (isLeader(viewer.role)) return true
  if (prayer.visibility === 'leaders_only') return false
  if (prayer.visibility === 'group') {
    return prayer.groupId !== null && viewer.groupId === prayer.groupId
  }
  return true
}

/** 기도 참여 중복 방지 키. Asia/Seoul 기준 하루 1회. */
export function dateKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}
