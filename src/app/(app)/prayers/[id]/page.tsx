import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { PrayerPager, type PagerNeighbor } from '@/app/(app)/prayers/[id]/PrayerPager'
import { CommentSection } from '@/components/CommentSection'
import { MetaLine } from '@/components/PrayerMeta'
import { PrayedButton, TodayCompanions } from '@/components/PrayedButton'
import { Watermark } from '@/components/Watermark'
import { Icon } from '@/components/ui/Icon'
import { getCurrentUser } from '@/lib/auth/session'
import { getRepository } from '@/lib/db'
import { formatDateTime } from '@/lib/format'
import {
  CATEGORIES,
  DEFAULT_PRAYER_SORT,
  isLeader,
  PRAYER_SORTS,
  STATUSES,
  type Category,
  type PrayerSort,
  type Status,
} from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

interface SearchParams {
  q?: string
  category?: string
  status?: string
  urgent?: string
  sort?: string
}

export default async function PrayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<SearchParams>
}) {
  const viewer = await getCurrentUser()
  if (!viewer) redirect('/login')

  const { id } = await params
  const repo = await getRepository()
  const detail = await repo.getPrayer(viewer, id)
  if (!detail) notFound()

  // 목록에서 보던 조건을 그대로 다시 세워 같은 줄에서 옆 글을 찾는다.
  // 조건을 물고 오지 않았으면(오늘·응답에서 들어온 경우) 기본 목록을 본다.
  const search = await searchParams
  const listCategory = CATEGORIES.includes(search.category as Category)
    ? (search.category as Category)
    : null
  const listStatus = STATUSES.includes(search.status as Status)
    ? (search.status as Status)
    : null
  const listSort: PrayerSort = PRAYER_SORTS.includes(search.sort as PrayerSort)
    ? (search.sort as PrayerSort)
    : DEFAULT_PRAYER_SORT

  const siblings = await repo.listPrayers(viewer, {
    q: search.q,
    category: listCategory,
    status: listStatus,
    urgentOnly: search.urgent === '1',
    sort: listSort,
    hideAnswered: listStatus !== 'answered',
  })
  const here = siblings.findIndex((entry) => entry.prayer.id === id)
  const toNeighbor = (offset: number): PagerNeighbor | null => {
    if (here < 0) return null
    const found = siblings[here + offset]
    return found ? { id: found.prayer.id, title: found.prayer.title } : null
  }
  const listQuery = new URLSearchParams()
  if (search.q) listQuery.set('q', search.q)
  if (listCategory) listQuery.set('category', listCategory)
  if (listStatus) listQuery.set('status', listStatus)
  if (search.urgent === '1') listQuery.set('urgent', '1')
  if (listSort !== DEFAULT_PRAYER_SORT) listQuery.set('sort', listSort)
  const queryString = listQuery.toString()

  const { prayer, engagement, updates } = detail
  const canChangeStatus = isLeader(viewer.role) || prayer.authorIdPublic === viewer.id

  return (
    <PrayerPager prev={toNeighbor(-1)} next={toNeighbor(1)} query={queryString}>
      <div className="reading-column enter-rise relative py-6">
        <Watermark name={viewer.displayName} />

        <div className="flex items-center justify-between">
          <Link
            prefetch={false}
            href={queryString ? `/prayers?${queryString}` : '/prayers'}
            className="inline-flex h-11 items-center gap-1.5 text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text active:opacity-70"
          >
            <Icon name="arrow-left" size={17} />
            목록
          </Link>

          {/* 수정 권한과 상태 변경 권한은 같은 규칙이다 — 본인 건이거나 리더 이상. */}
          {canChangeStatus ? (
            <Link
              prefetch={false}
              href={`/prayers/${prayer.id}/edit`}
              className="inline-flex h-11 items-center text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text active:opacity-70"
            >
              수정
            </Link>
          ) : null}
        </div>

        {/* 원문은 상단에 고정된다 — 수정해도 덮어쓰지 않는다(PRD §4.2) */}
        <article className="mt-4 flex flex-col gap-4">
          <h1 className="type-title text-text">{prayer.title}</h1>
          {prayer.body ? (
            <p className="type-body whitespace-pre-line text-text">{prayer.body}</p>
          ) : null}

          <div className="flex flex-col gap-2">
            <MetaLine
              prayer={prayer}
              extra={prayer.revisionCount > 0 ? `${prayer.revisionCount}회 수정됨` : undefined}
            />
            <p className="type-caption">
              <time dateTime={prayer.createdAt}>{formatDateTime(prayer.createdAt)}</time>에
              올라왔습니다
            </p>
          </div>
        </article>

        {/* 기도 표시는 본문 바로 아래. 이 화면에서 유일한 강조 요소다. */}
        <div className="mt-8 flex flex-col gap-3 border-y border-line py-6">
          <PrayedButton prayerId={prayer.id} engagement={engagement} variant="bar" />
          <TodayCompanions engagement={engagement} />
        </div>

        <div className="mt-10">
          <CommentSection
            prayerId={prayer.id}
            updates={updates}
            currentStatus={prayer.status}
            canChangeStatus={canChangeStatus}
          />
        </div>
      </div>
    </PrayerPager>
  )
}
