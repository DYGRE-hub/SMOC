'use client'

import { useOptimistic, useTransition } from 'react'

import { Icon } from '@/components/ui/Icon'
import { markPrayedAction } from '@/lib/actions/prayers'
import type { EngagementSummary } from '@/lib/domain/types'

interface Props {
  prayerId: string
  engagement: EngagementSummary
  variant?: 'row' | 'bar'
  disabled?: boolean
}

/**
 * PRD §4.3 — 탭 한 번으로 "기도했습니다".
 * 하루 1회만 반영되고, 이미 눌렀으면 조용히 완료 상태로 남는다.
 * 요청자에게는 누가 아니라 몇 명인지만 전달되므로 여기서도 이름은 다루지 않는다.
 */
export function PrayedButton({ prayerId, engagement, variant = 'row', disabled }: Props) {
  const [pending, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(engagement)

  const done = optimistic.viewerPrayedToday

  function handleClick() {
    if (done || disabled) return
    startTransition(async () => {
      setOptimistic({
        ...optimistic,
        viewerPrayedToday: true,
        today: optimistic.today + 1,
        total: optimistic.total + 1,
      })
      await markPrayedAction(prayerId)
    })
  }

  const label = done ? '오늘 기도했습니다' : '기도했어요'

  if (variant === 'bar') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={done || disabled || pending}
        aria-pressed={done}
        className={[
          'flex h-12 flex-1 items-center justify-center gap-2 rounded-button text-[15px] font-medium',
          'transition-colors duration-200 ease-[var(--ease-quiet)]',
          done
            ? 'bg-accent-weak text-accent'
            : 'bg-accent text-white hover:opacity-90 active:opacity-75 disabled:opacity-60',
        ].join(' ')}
      >
        <Icon name={done ? 'check' : 'hands'} size={18} />
        {label}
      </button>
    )
  }

  // 목록에서 누르는 버튼. 손가락으로 정확히 눌러야 하므로 넉넉하게 잡는다.
  // 누른 뒤에도 '오늘'을 붙여 두는 이유는, 내일 다시 눌러야 한다는 것을
  // 버튼 자체가 말해주게 하려는 것이다.
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={done || disabled || pending}
      aria-pressed={done}
      aria-label={`${label}. 지금까지 ${optimistic.total}명이 함께했습니다`}
      className={[
        'flex h-11 w-[104px] shrink-0 items-center justify-center gap-1.5 rounded-button border text-[14px]',
        'transition-colors duration-200 ease-[var(--ease-quiet)]',
        done
          ? 'border-accent/40 bg-accent-weak font-medium text-accent'
          : 'border-accent bg-accent text-white hover:opacity-90 active:opacity-75',
      ].join(' ')}
    >
      <Icon name={done ? 'check' : 'hands'} size={17} />
      <span>{done ? '오늘 기도함' : '기도하기'}</span>
    </button>
  )
}

/** "오늘 12명이 함께 기도했어요" — 참여를 압박이 아니라 동행으로 읽히게 하는 문장. */
export function TodayCompanions({ engagement }: { engagement: EngagementSummary }) {
  if (engagement.today === 0 && engagement.total === 0) {
    return <p className="type-caption">아직 아무도 이 기도를 함께하지 않았어요.</p>
  }
  if (engagement.today === 0) {
    return <p className="type-caption">지금까지 {engagement.total}명이 함께 기도했어요.</p>
  }
  return (
    <p className="type-caption">
      오늘 {engagement.today}명이 함께 기도했어요
      {engagement.total > engagement.today ? ` · 누적 ${engagement.total}명` : ''}
    </p>
  )
}
