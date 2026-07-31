import Link from 'next/link'

import { MetaLine } from '@/components/PrayerMeta'
import { PrayedButton } from '@/components/PrayedButton'
import { Icon } from '@/components/ui/Icon'
import type { PrayerWithEngagement } from '@/lib/domain/types'

/**
 * PRD §9.2 — 카드 대신 구분선 기반 리스트.
 *
 * 오른편에 기도 표시와 나눔 수를 세로로 둔다. 한 행에서 바로 기도를 남길 수 있어야
 * 목록이 읽기 전용으로 끝나지 않고, 나눔 수가 보여야 소식이 있는 제목으로 들어가게 된다.
 */
export function PrayerRow({ item }: { item: PrayerWithEngagement }) {
  const { prayer, engagement } = item

  return (
    <li className="border-b border-line">
      <div className="flex items-start gap-4 py-5">
        <div className="min-w-0 flex-1">
          <Link
            prefetch={false}
            href={`/prayers/${prayer.id}`}
            className="block text-[17px] font-medium leading-[1.5] tracking-[-0.01em] text-text transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-70"
          >
            {prayer.title}
          </Link>
          {prayer.body ? (
            <p className="mt-1 line-clamp-2 text-[15px] leading-[1.6] text-text-secondary">
              {prayer.body}
            </p>
          ) : null}
          <div className="mt-2">
            <MetaLine prayer={prayer} />
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <PrayedButton prayerId={prayer.id} engagement={engagement} />
          <p className="type-caption flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Icon name="hands" size={14} />
              <span className="tabular-nums">{engagement.total}</span>
            </span>
            <Link
              prefetch={false}
              href={`/prayers/${prayer.id}`}
              aria-label={`나눔 ${engagement.commentCount}개 보기`}
              className="inline-flex items-center gap-1 transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text-secondary"
            >
              <Icon name="comment" size={14} />
              <span className="tabular-nums">{engagement.commentCount}</span>
            </Link>
          </p>
        </div>
      </div>
    </li>
  )
}
