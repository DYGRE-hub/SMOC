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
 *
 * 칸 전체가 누르는 자리다.
 * 제목 글자만 링크였을 때는 어디를 눌러야 열리는지 알 수 없었고, 눌러도 아무 반응이
 * 없어 눌린 건지조차 알 수 없었다. 그래서 행을 덮는 층을 하나 깔고, 눌리는 동안
 * 배경이 옅게 물들게 했다. 손가락을 떼기 전에 "지금 이 칸이 눌렸다"가 보여야 한다.
 */
export function PrayerRow({
  item,
  /** 목록에서 보던 조건. 상세에서 이전·다음으로 넘길 때 같은 줄을 따라가게 한다. */
  listQuery,
}: {
  item: PrayerWithEngagement
  listQuery?: string
}) {
  const { prayer, engagement } = item
  const href = listQuery ? `/prayers/${prayer.id}?${listQuery}` : `/prayers/${prayer.id}`

  return (
    <li className="relative border-b border-line">
      {/*
        행 전체를 덮는 층. 배경색만 담당하고 글보다 뒤에 깔린다.
        스크린리더와 키보드는 아래 제목 링크를 쓰므로 여기서는 빠져 있는다 —
        같은 곳으로 가는 링크가 둘로 읽히면 목록을 훑기가 도리어 성가시다.
      */}
      <Link
        prefetch={false}
        href={href}
        aria-hidden
        tabIndex={-1}
        className="absolute inset-0 z-0 -mx-3 rounded-[12px] transition-colors duration-200 ease-[var(--ease-quiet)] hover:bg-surface active:bg-accent-weak"
      />

      {/* 글은 위층에 있지만 누르는 것은 아래층이 받는다. 오른쪽 기도 단추만 예외다. */}
      <div className="pointer-events-none relative z-10 flex items-start gap-4 py-5">
        <div className="min-w-0 flex-1">
          <Link
            prefetch={false}
            href={href}
            className="pointer-events-auto block text-[17px] font-medium leading-[1.5] tracking-[-0.01em] text-text transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-70"
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

        <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-2">
          <PrayedButton prayerId={prayer.id} engagement={engagement} />
          <p className="type-caption flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Icon name="hands" size={14} />
              <span className="tabular-nums">{engagement.total}</span>
            </span>
            <span
              className="inline-flex items-center gap-1"
              aria-label={`나눔 ${engagement.commentCount}개`}
            >
              <Icon name="comment" size={14} />
              <span className="tabular-nums">{engagement.commentCount}</span>
            </span>
          </p>
        </div>
      </div>
    </li>
  )
}
