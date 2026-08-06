import Link from 'next/link'
import { redirect } from 'next/navigation'

import { PrayerRow } from '@/components/PrayerRow'
import { PrayerFilters } from '@/app/(app)/prayers/PrayerFilters'
import { Icon } from '@/components/ui/Icon'
import { getCurrentUser } from '@/lib/auth/session'
import { getRepository } from '@/lib/db'
import {
  CATEGORIES,
  DEFAULT_PRAYER_SORT,
  PRAYER_SORTS,
  STATUSES,
  type Category,
  type PrayerSort,
  type Status,
} from '@/lib/domain/types'

export const metadata = { title: '기도제목' }
export const dynamic = 'force-dynamic'

interface SearchParams {
  q?: string
  category?: string
  status?: string
  urgent?: string
  sort?: string
}

export default async function PrayersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const viewer = await getCurrentUser()
  if (!viewer) redirect('/login')

  const params = await searchParams
  const category = CATEGORIES.includes(params.category as Category)
    ? (params.category as Category)
    : null
  const status = STATUSES.includes(params.status as Status) ? (params.status as Status) : null
  // 모르는 값이 오면 조용히 기본값으로 돌린다. 목록이 비어 보이는 것보다 낫다.
  const sort: PrayerSort = PRAYER_SORTS.includes(params.sort as PrayerSort)
    ? (params.sort as PrayerSort)
    : DEFAULT_PRAYER_SORT

  const repo = await getRepository()
  const items = await repo.listPrayers(viewer, {
    q: params.q,
    category,
    status,
    urgentOnly: params.urgent === '1',
    sort,
    // 응답된 기도는 여기 남지 않는다. 응답 화면으로 옮겨 간다.
    // 다만 예전 링크로 ?status=answered 를 열고 온 사람에게까지 빈 목록을
    // 내밀지는 않는다 — 대놓고 응답된 것을 찾아온 경우다.
    hideAnswered: status !== 'answered',
  })

  return (
    <div className="reading-column enter-rise py-10">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="type-title text-text">기도제목</h1>
        <Link
          prefetch={false}
          href="/new"
          className="inline-flex h-11 items-center gap-1.5 text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text"
        >
          <Icon name="plus" size={17} />
          올리기
        </Link>
      </div>

      <div className="mt-6">
        <PrayerFilters
          initialQuery={params.q ?? ''}
          category={category}
          status={status}
          urgentOnly={params.urgent === '1'}
          sort={sort}
        />
      </div>

      {/* 응답된 건이 목록에서 사라진 것을 두고 "내 기도가 없어졌다" 고 여기지 않도록
          어디로 갔는지 같은 줄에서 알려 준다. */}
      <p className="type-caption mt-6 flex flex-wrap items-center gap-x-2" aria-live="polite">
        <span>{items.length}개의 기도제목</span>
        <span aria-hidden className="text-text-tertiary/60">
          ·
        </span>
        <Link
          prefetch={false}
          href="/archive"
          className="text-text-secondary underline-offset-4 transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text hover:underline"
        >
          응답된 기도는 응답에 있습니다
        </Link>
      </p>

      {items.length > 0 ? (
        <ul className="mt-2 border-t border-line">
          {items.map((item) => (
            <PrayerRow key={item.prayer.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="type-body mt-10 text-text-secondary">
          조건에 맞는 기도제목이 없습니다.
        </p>
      )}
    </div>
  )
}
