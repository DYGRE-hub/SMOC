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
  /**
   * 기도 대상자 — 이 기도가 누구를 위한 것인가.
   * 남을 대신해 올리는 경우가 많아 작성자와 분리한다.
   * 본인을 위한 기도면 비어 있을 수 있다.
   */
  subject: string | null
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

/**
 * 원문 위에 얹는 업데이트.
 *
 * 나눔과 다르다. 나눔은 곁에서 보태는 말이고, 이것은 부탁한 사람이 사정이
 * 달라졌을 때 요청 자체를 고쳐 쓰는 자리다. 그래서 본문 위에 붙는다.
 */
export interface PrayerHeadUpdate {
  id: string
  prayerId: string
  body: string
  createdAt: string
  /** 지금 보는 사람이 이것을 고치거나 지울 수 있는가. 서버가 판정해 내려 준다. */
  editable?: boolean
}

/**
 * 나눔에 붙은 사진. 바이트는 여기 담지 않는다.
 *
 * 화면은 /api/images/{id} 로 따로 받아 간다. 목록을 그릴 때마다 사진까지
 * 함께 실려 오면 첫 화면이 무거워지고, 정작 열어 보지도 않을 사진을 매번 나른다.
 * 가로·세로를 함께 주는 것은 자리를 미리 잡아 두어 그림이 뜰 때 글이 밀리지 않게 하려고다.
 */
export interface PrayerUpdateImage {
  id: string
  width: number
  height: number
}

/** 사진 한 장이 넘을 수 없는 크기. 브라우저에서 줄이고 서버에서 한 번 더 막는다. */
export const IMAGE_MAX_BYTES = 3 * 1024 * 1024
/** 올리기 전에 줄여 둘 긴 변의 길이. 휴대폰 화면에서 크게 봐도 충분하다. */
export const IMAGE_MAX_EDGE = 1600
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export interface PrayerUpdate {
  id: string
  prayerId: string
  type: UpdateType
  body: string
  authorDisplayName: string | null
  createdAt: string
  /** 붙은 사진. 없으면 null. */
  image?: PrayerUpdateImage | null
  /**
   * 지금 보는 사람이 이 나눔을 고치거나 지울 수 있는가.
   *
   * 작성자 id 를 그대로 내보내지 않는 이유가 있다. 익명으로 올린 기도제목에
   * 원 작성자가 스스로 단 댓글은 표시 이름이 '익명'인데, id 가 함께 나가면
   * 그 익명이 깨진다. 그래서 서버가 판정한 결과만 넘긴다.
   *
   * 이 값은 버튼을 보일지 말지에만 쓴다. 진짜 권한 검사는 서버 액션에서 다시 한다.
   */
  editable?: boolean
}

/**
 * 밖에서 들어온 기도 요청.
 *
 * 아직 기도제목이 아니다. 리더가 읽고 손본 뒤에 목록으로 옮겨야 비로소 기도제목이 된다.
 */
export const REQUEST_STATUSES = ['pending', 'published', 'declined'] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: '기다리는 중',
  published: '목록에 올림',
  declined: '올리지 않음',
}

export interface PrayerRequest {
  id: string
  churchId: string
  title: string
  body: string
  subject: string | null
  category: Category
  urgency: boolean
  /** 올린 분이 남긴 이름. 익명을 고르면 비어 있다. */
  requesterName: string | null
  /** 리더가 확인할 때만 쓰는 연락처. 목록에는 보이지 않는다. */
  requesterContact: string | null
  anonymous: boolean
  status: RequestStatus
  publishedPrayerId: string | null
  handledBy: string | null
  handledAt: string | null
  note: string | null
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

/**
 * 목록·상세에 표시할 '올린 사람'. 보여줄 것이 없으면 null.
 *
 * 리스트로 가져온 기도제목에는 올린 사람이 없다(앱 계정과 무관하다).
 * 그럴 때 displayAuthor 를 그대로 쓰면 '익명' 이 찍히는데, 익명으로 올린 것과
 * 애초에 올린 사람이 없는 것은 다른 상태다.
 */
export function authorLabel(prayer: {
  authorMode: AuthorMode
  authorDisplayName: string | null
}): string | null {
  if (prayer.authorMode === 'anonymous') return '익명'
  if (!prayer.authorDisplayName) return null
  return displayAuthor(prayer.authorMode, prayer.authorDisplayName)
}

export function isLeader(role: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.leader
}

/**
 * 지금도 긴급한가.
 *
 * 응답된 기도는 급하지 않다. 답이 온 건을 계속 맨 위에 붙들어 두면
 * 아직 기다리는 사람들이 그만큼 뒤로 밀린다. 긴급 표시를 지우는 게 아니라
 * (올릴 때의 사정은 사실 그대로 남는다) 목록에서 앞자리를 내려놓는 것이다.
 *
 * 종료·보류는 그대로 둔다. 답이 왔다는 소식만이 자리를 비켜 줄 이유가 된다.
 */
export function isUrgentNow(prayer: { urgency: boolean; status: Status }): boolean {
  return prayer.urgency && prayer.status !== 'answered'
}

/** 목록 정렬. 긴급을 맨 위로 올리는 규칙은 고정이고, 그 아래 순서만 고른다. */
export const PRAYER_SORTS = ['updated', 'created', 'waiting', 'least'] as const
export type PrayerSort = (typeof PRAYER_SORTS)[number]

export const PRAYER_SORT_LABEL: Record<PrayerSort, string> = {
  updated: '최근 소식순',
  created: '올라온 순',
  waiting: '오래 기다린 순',
  least: '덜 기도한 순',
}

export const DEFAULT_PRAYER_SORT: PrayerSort = 'updated'

/**
 * 목록 정렬. 어떤 기준을 고르든 긴급이 먼저다.
 *
 * '덜 기도한 순'은 아직 아무도 함께하지 못한 제목을 앞으로 올린다.
 * 목록이 길어지면 위쪽 몇 개만 기도받고 아래는 매주 그대로 남는데,
 * 그걸 뒤집어 볼 수 있어야 빠지는 사람이 없다.
 */
export function sortPrayers<T extends PrayerWithEngagement>(
  items: readonly T[],
  sort: PrayerSort,
): T[] {
  const byUrgency = (a: T, b: T) =>
    Number(isUrgentNow(b.prayer)) - Number(isUrgentNow(a.prayer))
  const time = (value: string) => new Date(value).getTime()

  return [...items].sort((a, b) => {
    const urgent = byUrgency(a, b)
    if (urgent !== 0) return urgent

    switch (sort) {
      case 'created':
        return time(b.prayer.createdAt) - time(a.prayer.createdAt)
      case 'waiting':
        return time(a.prayer.createdAt) - time(b.prayer.createdAt)
      case 'least':
        // 함께한 수가 같으면 오래 기다린 쪽을 먼저 본다.
        return (
          a.engagement.total - b.engagement.total ||
          time(a.prayer.createdAt) - time(b.prayer.createdAt)
        )
      case 'updated':
      default:
        return time(b.prayer.updatedAt) - time(a.prayer.updatedAt)
    }
  })
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

/** 기도 참여 중복 방지 키. 기준 시간대의 하루 1회(src/lib/timezone.ts). */
export { dateKey } from '@/lib/timezone'
