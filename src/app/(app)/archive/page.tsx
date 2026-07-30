import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Icon } from '@/components/ui/Icon'
import { getCurrentUser } from '@/lib/auth/session'
import { getRepository } from '@/lib/db'
import { formatDate, formatMonth } from '@/lib/format'
import { authorLabel, type PrayerUpdate, type PrayerWithEngagement } from '@/lib/domain/types'

export const metadata = { title: '응답' }
export const dynamic = 'force-dynamic'

interface AnsweredEntry {
  item: PrayerWithEngagement
  /** 응답으로 옮기며 남긴 나눔. 이 화면의 알맹이다. */
  testimony: PrayerUpdate | null
  shareCount: number
}

/**
 * 응답 — 기도가 응답으로 종료된 제목을 모아두고, 그 은혜를 함께 나누는 곳.
 *
 * 목록 화면과 달리 여기서는 제목보다 "어떻게 응답되었는가"가 먼저 보여야 한다.
 * 신규 멤버를 설득하는 가장 좋은 자산이므로 여백을 넉넉히 쓴다(PRD §4.4).
 */
export default async function AnsweredPage() {
  const viewer = await getCurrentUser()
  if (!viewer) redirect('/login')

  const repo = await getRepository()
  const all = await repo.listPrayers(viewer)
  const answered = all
    .filter(({ prayer }) => prayer.status === 'answered')
    .sort(
      (a, b) =>
        new Date(b.prayer.updatedAt).getTime() - new Date(a.prayer.updatedAt).getTime(),
    )

  // 응답 나눔을 함께 가져온다. 항목마다 상세를 열어보게 하면 아무도 읽지 않는다.
  const entries: AnsweredEntry[] = await Promise.all(
    answered.map(async (item) => {
      const detail = await repo.getPrayer(viewer, item.prayer.id)
      const updates = detail?.updates ?? []
      const shares = updates.filter((u) => u.type === 'answer' || u.type === 'comment')
      const testimony =
        [...shares].reverse().find((u) => u.type === 'answer') ??
        [...shares].reverse()[0] ??
        null
      return { item, testimony, shareCount: shares.length }
    }),
  )

  const byMonth = groupByMonth(entries)
  const totalPrayed = all.reduce((sum, entry) => sum + entry.engagement.total, 0)

  return (
    <div className="reading-column enter-rise py-14">
      <header className="flex flex-col gap-4">
        <h1 className="type-display text-text">응답의 기록</h1>
        <p className="type-body text-text-secondary">
          함께한 기도 {all.length}건 가운데 {answered.length}건이 응답으로 옮겨졌습니다.
          그동안 쌓인 중보는 {totalPrayed}회입니다.
        </p>
        <p className="type-caption">
          받은 은혜를 한 줄이라도 보태 주시면, 나중에 같은 자리를 지나는 사람에게 큰 힘이
          됩니다.
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="type-body mt-14 text-text-secondary">
          아직 응답으로 옮겨진 기도가 없습니다.
          <br />
          소식이 생기면 기도제목 상세에서 상태를 &lsquo;응답됨&rsquo;으로 바꿔 주세요.
        </p>
      ) : (
        <div className="mt-14 flex flex-col gap-14">
          {byMonth.map(([month, group]) => (
            <section key={month} aria-labelledby={`month-${month}`}>
              <h2 id={`month-${month}`} className="type-caption mb-6">
                {month}
              </h2>
              <ul className="flex flex-col gap-10">
                {group.map(({ item, testimony, shareCount }) => (
                  <li key={item.prayer.id} className="flex flex-col gap-3">
                    <p className="type-caption inline-flex items-center gap-1.5 text-answered">
                      <Icon name="check" size={14} />
                      응답됨 · {formatDate(item.prayer.updatedAt)}
                    </p>

                    <Link
                      href={`/prayers/${item.prayer.id}`}
                      className="type-title text-text transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-70"
                    >
                      {item.prayer.title}
                    </Link>

                    {testimony ? (
                      <blockquote className="border-l-2 border-line pl-4">
                        <p className="type-body whitespace-pre-line text-text-secondary">
                          {testimony.body}
                        </p>
                        <footer className="type-caption mt-2">
                          {testimony.authorDisplayName ?? '익명'}
                        </footer>
                      </blockquote>
                    ) : (
                      <p className="type-caption">
                        아직 어떻게 응답되었는지 나눔이 없습니다.
                      </p>
                    )}

                    <p className="type-caption flex flex-wrap items-center gap-x-3">
                      {item.prayer.subject || authorLabel(item.prayer) ? (
                        <span>{item.prayer.subject ?? authorLabel(item.prayer)}</span>
                      ) : null}
                      <span>{item.engagement.total}명이 함께 기도했습니다</span>
                      <Link
                        href={`/prayers/${item.prayer.id}`}
                        className="inline-flex items-center gap-1.5 text-accent underline-offset-4 hover:underline"
                      >
                        <Icon name="comment" size={14} />
                        은혜 나누기 {shareCount > 0 ? shareCount : ''}
                      </Link>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function groupByMonth(entries: AnsweredEntry[]): [string, AnsweredEntry[]][] {
  const map = new Map<string, AnsweredEntry[]>()
  for (const entry of entries) {
    const key = formatMonth(entry.item.prayer.updatedAt)
    const bucket = map.get(key)
    if (bucket) bucket.push(entry)
    else map.set(key, [entry])
  }
  return [...map.entries()]
}
