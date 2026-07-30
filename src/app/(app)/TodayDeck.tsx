'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { MetaLine } from '@/components/PrayerMeta'
import { PrayedButton, TodayCompanions } from '@/components/PrayedButton'
import { Icon } from '@/components/ui/Icon'
import type { PrayerUpdate, PrayerWithEngagement } from '@/lib/domain/types'
import { formatDate } from '@/lib/format'

/**
 * '오늘' 탭의 세로 롤링.
 *
 * 위로 밀면 다음 기도로 넘어간다. 순서는 긴급한 것이 먼저다.
 * 목록을 눈으로 훑다 지쳐 이탈하는 대신, 한 번에 한 제목만 마주하게 하려는 구조라
 * 스크롤 스냅으로 한 화면에 한 장씩만 멈추게 했다.
 *
 * 스냅은 브라우저가 처리하므로 스크롤이 끊기지 않고, JS는 지금 몇 번째인지
 * 표시하는 데만 쓴다.
 */
export function TodayDeck({
  items,
  comments,
}: {
  items: PrayerWithEngagement[]
  /** 기도제목 id → 최근 나눔 */
  comments: Record<string, PrayerUpdate[]>
}) {
  const [index, setIndex] = useState(0)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    // 화면 한가운데에 가장 가까운 카드를 현재 카드로 본다.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const i = cardRefs.current.indexOf(entry.target as HTMLElement)
          if (i >= 0) setIndex(i)
        }
      },
      { root: scroller, threshold: 0.6 },
    )

    for (const card of cardRefs.current) if (card) observer.observe(card)
    return () => observer.disconnect()
  }, [items.length])

  function goTo(next: number) {
    const target = cardRefs.current[next]
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const isLast = index >= items.length - 1

  return (
    // 부모가 정해 준 높이를 그대로 채운다. min-h-0 이 없으면 flex 자식이
    // 내용 높이만큼 부풀어 스크롤이 바깥으로 새어 나간다.
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollerRef}
        className="no-scrollbar min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain"
      >
        {items.map((item, i) => (
          <article
            key={item.prayer.id}
            ref={(el) => {
              cardRefs.current[i] = el
            }}
            className="flex min-h-full snap-start flex-col justify-between gap-8 py-6"
          >
            <div className="flex flex-col gap-5">
              <p className="type-caption">
                {i + 1} / {items.length}
                {item.prayer.urgency ? ' · 긴급' : ''}
              </p>

              <Link
                href={`/prayers/${item.prayer.id}`}
                className="type-title text-text transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-70"
              >
                {item.prayer.title}
              </Link>

              {item.prayer.body ? (
                <p className="type-body whitespace-pre-line text-text-secondary">
                  {item.prayer.body}
                </p>
              ) : null}

              <div className="flex flex-col gap-2">
                <MetaLine prayer={item.prayer} />
                <TodayCompanions engagement={item.engagement} />
              </div>

              <RecentComments
                prayerId={item.prayer.id}
                comments={comments[item.prayer.id] ?? []}
              />
            </div>

            <div className="flex flex-col gap-4">
              <PrayedButton
                prayerId={item.prayer.id}
                engagement={item.engagement}
                variant="bar"
              />
              <div className="flex items-center justify-between">
                <Link
                  href={`/prayers/${item.prayer.id}`}
                  className="type-caption inline-flex h-11 items-center gap-1.5 underline-offset-4 hover:underline"
                >
                  <Icon name="comment" size={15} />
                  나눔 {item.engagement.commentCount}
                </Link>

                {i < items.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => goTo(i + 1)}
                    className="type-caption inline-flex h-11 items-center gap-1.5 underline-offset-4 hover:underline"
                  >
                    다음 기도
                    <Icon name="arrow-up" size={15} />
                  </button>
                ) : (
                  <Link
                    href="/prayers"
                    className="type-caption inline-flex h-11 items-center underline-offset-4 hover:underline"
                  >
                    전체 목록 보기
                  </Link>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* 진행 표시 — 오른쪽에 얇은 점으로만. 지금 몇 번째인지만 알려준다. */}
      <ol
        aria-hidden
        className="pointer-events-none fixed right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1.5"
      >
        {items.map((item, i) => (
          <li
            key={item.prayer.id}
            className={[
              'h-1.5 w-1.5 rounded-full transition-colors duration-200 ease-[var(--ease-quiet)]',
              i === index ? 'bg-text-secondary' : 'bg-line',
            ].join(' ')}
          />
        ))}
      </ol>

      <p className="type-caption pb-3 text-center" aria-live="polite">
        {isLast ? '마지막 기도입니다' : '위로 밀면 다음 기도로 넘어갑니다'}
      </p>
    </div>
  )
}

/**
 * 카드 아래 남는 자리에 채우는 최근 나눔.
 * 전문을 다 펼치지는 않는다 — 카드가 길어져 스냅이 깨지는 것보다,
 * 읽고 싶은 사람이 상세로 들어오게 두는 편이 낫다.
 */
function RecentComments({
  prayerId,
  comments,
}: {
  prayerId: string
  comments: PrayerUpdate[]
}) {
  if (comments.length === 0) return null

  return (
    <section className="mt-2 flex flex-col gap-3 border-t border-line pt-5">
      <h3 className="type-caption">최근 나눔</h3>
      <ol className="flex flex-col gap-3">
        {comments.map((comment) => (
          <li key={comment.id} className="flex flex-col gap-0.5">
            <p className="type-caption flex items-center gap-2">
              <span className={comment.type === 'answer' ? 'text-answered' : undefined}>
                {comment.authorDisplayName ?? '익명'}
              </span>
              <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
            </p>
            <p className="line-clamp-2 text-[14px] leading-[1.6] text-text-secondary">
              {comment.body}
            </p>
          </li>
        ))}
      </ol>
      <Link
        href={`/prayers/${prayerId}`}
        className="type-caption self-start underline-offset-4 hover:underline"
      >
        나눔 전체 보기
      </Link>
    </section>
  )
}
