'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { Icon } from '@/components/ui/Icon'

export interface PagerNeighbor {
  id: string
  title: string
}

/** 이만큼 끌면 넘긴다. 짧으면 글을 읽다 실수로 넘어가고, 길면 넘기다 만다. */
const THRESHOLD = 64
/** 세로로 이만큼 더 움직였으면 읽으려는 손짓이다. 넘기지 않는다. */
const VERTICAL_SLOP = 24

/**
 * 상세에서 옆 글로 넘기기.
 *
 * 목록으로 돌아갔다 다시 들어오는 왕복을 없앤다. 목록에서 보던 조건(검색어·정렬·
 * 필터)을 그대로 물고 오므로, 넘기는 순서는 방금 보던 목록의 순서와 같다.
 *
 * 손가락으로 끄는 동안 화면이 그만큼 따라 움직인다. 끝까지 끌지 않으면 제자리로
 * 돌아온다 — 넘어갈지 말지를 손을 떼기 전에 알 수 있어야 한다.
 */
export function PrayerPager({
  prev,
  next,
  query,
  children,
}: {
  prev: PagerNeighbor | null
  next: PagerNeighbor | null
  query: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const [dx, setDx] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const axis = useRef<'x' | 'y' | null>(null)

  const href = (id: string) => (query ? `/prayers/${id}?${query}` : `/prayers/${id}`)

  function go(target: PagerNeighbor | null) {
    if (!target) return
    setLeaving(true)
    router.push(href(target.id))
  }

  function onTouchStart(e: React.TouchEvent) {
    // 사진을 크게 열어 둔 동안에는 넘기지 않는다. 사진을 보려던 손짓이다.
    if (document.querySelector('dialog[open]')) return
    const touch = e.touches[0]
    if (!touch || e.touches.length > 1) return
    start.current = { x: touch.clientX, y: touch.clientY }
    axis.current = null
  }

  function onTouchMove(e: React.TouchEvent) {
    const origin = start.current
    const touch = e.touches[0]
    if (!origin || !touch) return

    const moveX = touch.clientX - origin.x
    const moveY = touch.clientY - origin.y

    if (axis.current === null) {
      if (Math.abs(moveX) < 8 && Math.abs(moveY) < 8) return
      axis.current = Math.abs(moveX) > Math.abs(moveY) + VERTICAL_SLOP ? 'x' : 'y'
    }
    if (axis.current !== 'x') return

    // 갈 곳이 없는 쪽으로는 조금만 따라간다. 벽이 있다는 느낌만 준다.
    const blocked = (moveX > 0 && !prev) || (moveX < 0 && !next)
    setDx(blocked ? moveX * 0.25 : moveX)
  }

  function onTouchEnd() {
    const moved = dx
    start.current = null
    axis.current = null
    setDx(0)
    if (moved > THRESHOLD) go(prev)
    else if (moved < -THRESHOLD) go(next)
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      // 세로 스크롤은 브라우저가 그대로 맡고, 가로만 우리가 받는다.
      style={{
        touchAction: 'pan-y',
        transform: dx ? `translateX(${dx}px)` : undefined,
        transition: dx ? 'none' : 'transform 260ms var(--ease-quiet)',
        opacity: leaving ? 0.6 : 1,
      }}
      className="motion-reduce:!transform-none motion-reduce:!transition-none"
    >
      {children}

      {prev || next ? (
        <nav
          aria-label="옆 기도제목"
          className="mt-12 flex items-stretch gap-3 border-t border-line pt-6"
        >
          <NeighborLink side="prev" target={prev} href={href} />
          <NeighborLink side="next" target={next} href={href} />
        </nav>
      ) : null}

      {prev || next ? (
        <p className="type-caption mt-4 text-center">
          화면을 옆으로 밀어도 넘어갑니다
        </p>
      ) : null}
    </div>
  )
}

function NeighborLink({
  side,
  target,
  href,
}: {
  side: 'prev' | 'next'
  target: PagerNeighbor | null
  href: (id: string) => string
}) {
  const isPrev = side === 'prev'
  const label = isPrev ? '이전 기도' : '다음 기도'

  if (!target) {
    // 자리를 비워 두지 않는다. 양쪽 폭이 흔들리면 넘길 때마다 화살표가 옮겨 다닌다.
    return (
      <span
        aria-hidden
        className="type-caption flex-1 rounded-[12px] border border-transparent px-3 py-3"
      />
    )
  }

  return (
    <Link
      prefetch={false}
      href={href(target.id)}
      className={[
        'flex flex-1 flex-col gap-1 rounded-[12px] border border-line px-3 py-3',
        'transition-colors duration-200 ease-[var(--ease-quiet)]',
        'hover:bg-surface active:bg-accent-weak',
        isPrev ? 'items-start text-left' : 'items-end text-right',
      ].join(' ')}
    >
      <span className="type-caption inline-flex items-center gap-1">
        {isPrev ? <Icon name="arrow-left" size={14} /> : null}
        {label}
        {isPrev ? null : <Icon name="arrow-right" size={14} />}
      </span>
      <span className="line-clamp-2 text-[14px] leading-[1.5] text-text-secondary">
        {target.title}
      </span>
    </Link>
  )
}
