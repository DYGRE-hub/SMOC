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

  /*
   * 이 화면은 긴급한 기도만 모은다. 제목이 그렇게 말하고 있고, 수요모임에서
   * 가장 먼저 붙들어야 하는 것도 그것이다. 응답된 건은 더 이상 긴급이 아니므로
   * 여기서 빠진다(isUrgentNow).
   *
   * 줄 세우는 기준은 마지막으로 소식이 오간 시각이다. 새 업데이트가 얹히거나
   * 본문을 고쳐 쓰면 그 제목이 맨 앞으로 온다 — 사정이 달라진 기도를 가장 먼저
   * 만나야 한다. 나눔이 달려도 마찬가지다.
   *
   * 기도했어요를 눌러도 이 시각은 움직이지 않는다. 그래서 손가락 밑에서 카드가
   * 갈리는 일은 없다.
   */
  const urgent = await repo.listPrayers(viewer, {
    urgentOnly: true,
    hideAnswered: true,
    sort: 'updated',
  })

  // 급한 건이 하나도 없는 날에는 빈 화면을 내밀지 않는다.
  // 트래커와 같은 '오늘의 미션'으로 갈아 끼우고, 제목도 그에 맞게 바꾼다.
  const { mission } = urgent.length > 0 ? { mission: [] } : await repo.tracker(viewer)
  const fallback = [...mission].sort(
    (a, b) =>
      new Date(b.prayer.updatedAt).getTime() - new Date(a.prayer.updatedAt).getTime(),
  )
  const ordered = urgent.length > 0 ? urgent : fallback
  const heading =
    ordered.length === 0
      ? '오늘은 조용합니다'
      : urgent.length > 0
        ? '오늘의 긴급한 기도'
        : '오늘의 기도'

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
          {heading}
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
        prefetch={false}
        href="/new"
        className="flex h-[52px] items-center justify-center gap-2 rounded-button bg-accent px-5 text-[16px] font-medium text-white transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-90 active:opacity-75"
      >
        <Icon name="plus" size={18} />
        기도제목 올리기
      </Link>
    </div>
  )
}
