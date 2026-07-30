import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { CommentSection } from '@/components/CommentSection'
import { MetaLine } from '@/components/PrayerMeta'
import { PrayedButton, TodayCompanions } from '@/components/PrayedButton'
import { Watermark } from '@/components/Watermark'
import { Icon } from '@/components/ui/Icon'
import { getCurrentUser } from '@/lib/auth/session'
import { getRepository } from '@/lib/db'
import { formatDateTime } from '@/lib/format'
import { isLeader } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

export default async function PrayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const viewer = await getCurrentUser()
  if (!viewer) redirect('/login')

  const { id } = await params
  const repo = await getRepository()
  const detail = await repo.getPrayer(viewer, id)
  if (!detail) notFound()

  const { prayer, engagement, updates } = detail
  const canChangeStatus = isLeader(viewer.role) || prayer.authorIdPublic === viewer.id

  return (
    <div className="reading-column enter-rise relative py-6">
      <Watermark name={viewer.displayName} />

      <Link
        href="/prayers"
        className="inline-flex h-11 items-center gap-1.5 text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text"
      >
        <Icon name="arrow-left" size={17} />
        목록
      </Link>

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
  )
}
