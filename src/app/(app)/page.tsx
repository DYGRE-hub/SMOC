import Link from 'next/link'
import { redirect } from 'next/navigation'

import { TodayDeck } from '@/app/(app)/TodayDeck'
import { Icon } from '@/components/ui/Icon'
import { getCurrentUser } from '@/lib/auth/session'
import { getRepository } from '@/lib/db'
import { formatFullDate } from '@/lib/format'
import type { PrayerUpdate } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

/**
 * PRD §9.3 홈 — 목록이 아니라 카드 한 장으로 시작한다.
 * 위로 밀면 다음 기도로 롤링되고, 긴급한 제목이 먼저 온다.
 */
export default async function HomePage() {
  const viewer = await getCurrentUser()
  if (!viewer) redirect('/login')

  const repo = await getRepository()

  // 트래커와 같은 '오늘의 미션'을 쓴다.
  //
  // 매번 큐를 다시 계산하면 기도를 누르는 순간 순위가 바뀌어, 손가락 밑에서
  // 카드가 다른 기도로 갈린다. 하루 동안 얼려 둔 목록을 함께 쓰면 그 일이 없고,
  // 홈에서 넘긴 카드와 트래커의 체크 항목이 정확히 같아진다.
  const { mission } = await repo.tracker(viewer)

  // 롤링 순서는 긴급 우선. urgency 는 변하지 않으므로 이 정렬도 하루 내내 그대로다.
  const ordered = [...mission].sort(
    (a, b) => Number(b.prayer.urgency) - Number(a.prayer.urgency),
  )

  // 카드 아래 남는 자리에 최근 나눔을 채운다. 빈 여백보다, 이 제목에
  // 어떤 소식이 오갔는지 보이는 편이 다음 사람을 끌어들인다.
  const comments: Record<string, PrayerUpdate[]> = {}
  await Promise.all(
    ordered.map(async ({ prayer }) => {
      comments[prayer.id] = await repo.listComments(viewer, prayer.id, 3)
    }),
  )

  return (
    // 헤더(3.5rem)와 하단 탭(4rem)을 뺀 나머지를 정확히 채운다.
    // 카드 한 장이 화면에 딱 맞아야 스크롤 스냅이 제대로 걸린다.
    <div className="reading-column enter-rise flex h-[calc(100svh-var(--chrome-height))] flex-col">
      <header className="flex shrink-0 flex-col gap-1 pt-8">
        <p className="type-caption">{formatFullDate()}</p>
        <h1 className="type-display text-text">
          {ordered.length > 0 ? '오늘의 긴급한 기도' : '오늘은 조용합니다'}
        </h1>
      </header>

      {ordered.length > 0 ? (
        <TodayDeck items={ordered} comments={comments} />
      ) : (
        <EmptyToday />
      )}
    </div>
  )
}

function EmptyToday() {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-6">
      <p className="type-body text-text-secondary">
        아직 올라온 기도제목이 없습니다.
        <br />
        첫 번째 제목을 올려 주시겠어요?
      </p>
      <Link
        href="/new"
        className="flex h-[52px] items-center justify-center gap-2 rounded-button bg-accent px-5 text-[16px] font-medium text-white transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-90 active:opacity-75"
      >
        <Icon name="plus" size={18} />
        기도제목 올리기
      </Link>
    </div>
  )
}
