import { redirect } from 'next/navigation'
import Link from 'next/link'

import { MissionList } from '@/app/(app)/tracker/MissionList'
import { StreakStrip } from '@/app/(app)/tracker/StreakStrip'
import { getCurrentUser } from '@/lib/auth/session'
import { getRepository } from '@/lib/db'
import { formatFullDate } from '@/lib/format'

export const metadata = { title: '나의 기도 트래커' }
export const dynamic = 'force-dynamic'

/**
 * 나만의 기도 트래커.
 *
 * 여기 있는 숫자는 전부 이 사람만 본다. 누구도 남의 진행률을 볼 수 없고,
 * 요청자에게도 "몇 명이 기도했는지"만 전달된다(PRD §4.3).
 * 그래서 이 화면은 성취를 겨루는 곳이 아니라 스스로 붙잡는 곳에 가깝다.
 */
export default async function TrackerPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const repo = await getRepository()
  const tracker = await repo.tracker(user)
  const complete = tracker.totalToday > 0 && tracker.doneToday >= tracker.totalToday

  return (
    <div className="reading-column enter-rise py-10">
      <header className="flex flex-col gap-1">
        <p className="type-caption">{formatFullDate()}</p>
        <h1 className="type-display text-text">
          {tracker.totalToday === 0
            ? '오늘의 미션이 비어 있습니다'
            : complete
              ? '오늘의 기도를 마쳤습니다'
              : `오늘의 기도 ${tracker.doneToday} / ${tracker.totalToday}`}
        </h1>
      </header>

      {tracker.totalToday > 0 ? (
        <div className="mt-6">
          <Progress done={tracker.doneToday} total={tracker.totalToday} />
        </div>
      ) : null}

      <section className="mt-10" aria-labelledby="mission-heading">
        <h2 id="mission-heading" className="type-caption mb-1">
          오늘의 기도 미션
        </h2>
        <p className="type-caption mb-4">
          체크사항은 본인만 보여지는 기능입니다.
        </p>

        {tracker.mission.length > 0 ? (
          <MissionList
            items={tracker.mission.map(({ prayer, engagement }) => ({
              id: prayer.id,
              title: prayer.title,
              category: prayer.category,
              urgency: prayer.urgency,
              prayUntil: prayer.prayUntil,
              prayedToday: engagement.viewerPrayedToday,
            }))}
          />
        ) : (
          <p className="type-body mt-6 text-text-secondary">
            아직 기도할 제목이 없습니다.{' '}
            <Link href="/new" className="text-accent underline-offset-4 hover:underline">
              첫 제목을 올려 주세요
            </Link>
            .
          </p>
        )}
      </section>

      <section className="mt-14 border-t border-line pt-8" aria-labelledby="record-heading">
        <h2 id="record-heading" className="type-caption mb-4">
          나의 기록
        </h2>
        <div className="flex flex-col gap-6">
          <div className="flex gap-10">
            <Stat value={`${tracker.streak}일`} label="연속" />
            <Stat value={`${tracker.lifetimeCount}회`} label="누적 기도" />
          </div>
          <StreakStrip history={tracker.history} />
        </div>
      </section>
    </div>
  )
}

function Progress({ done, total }: { done: number; total: number }) {
  const ratio = total === 0 ? 0 : (done / total) * 100
  return (
    <div
      className="h-[2px] w-full bg-line"
      role="progressbar"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`오늘 ${total}개 중 ${done}개 완료`}
    >
      <div
        className="h-full bg-accent transition-[width] duration-[240ms] ease-[var(--ease-quiet)]"
        style={{ width: `${ratio}%` }}
      />
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="type-title tabular-nums text-text">{value}</span>
      <span className="type-caption">{label}</span>
    </div>
  )
}
