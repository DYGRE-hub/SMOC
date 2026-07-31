'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { Icon } from '@/components/ui/Icon'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  DEFAULT_PRAYER_SORT,
  PRAYER_SORT_LABEL,
  PRAYER_SORTS,
  STATUS_LABEL,
  STATUSES,
  type Category,
  type PrayerSort,
  type Status,
} from '@/lib/domain/types'

interface Props {
  initialQuery: string
  category: Category | null
  status: Status | null
  urgentOnly: boolean
  sort: PrayerSort
}

/**
 * 검색·필터는 URL 에 실린다.
 * 리더가 특정 조건의 목록을 그대로 링크로 공유할 수 있어야 하기 때문이다.
 */
export function PrayerFilters({ initialQuery, category, status, urgentOnly, sort }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [query, setQuery] = useState(initialQuery)
  const [, startTransition] = useTransition()

  // 타이핑이 멈춘 뒤에 반영한다. 매 글자마다 서버를 때리지 않기 위해서.
  useEffect(() => {
    if (query === initialQuery) return
    const timer = setTimeout(() => {
      push({ q: query || null })
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function push(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    const qs = next.toString()
    startTransition(() => {
      router.replace(qs ? `/prayers?${qs}` : '/prayers', { scroll: false })
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-11 items-center gap-2 rounded-[10px] border border-line px-3">
        <Icon name="search" size={18} className="shrink-0 text-text-tertiary" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목이나 내용으로 찾기"
          aria-label="기도제목 검색"
          className="h-full w-full bg-transparent text-[15px] text-text outline-none placeholder:text-text-tertiary"
        />
      </div>

      {/*
        정렬은 필터 칩과 나란히 두지 않는다. 칩은 '무엇을 볼지'를 고르는 자리고
        정렬은 '어떤 순서로 볼지'라, 같은 줄에 있으면 눌러 보기 전에는 구분되지 않는다.
      */}
      <div className="flex items-center gap-2">
        <label htmlFor="sort" className="type-caption shrink-0">
          정렬
        </label>
        <select
          id="sort"
          value={sort}
          onChange={(e) => push({ sort: e.target.value === DEFAULT_PRAYER_SORT ? null : e.target.value })}
          className="h-11 rounded-[10px] border border-line bg-surface px-3 text-[15px] text-text outline-none transition-colors duration-200 ease-[var(--ease-quiet)] focus:border-accent/50"
        >
          {PRAYER_SORTS.map((s) => (
            <option key={s} value={s}>
              {PRAYER_SORT_LABEL[s]}
            </option>
          ))}
        </select>
        <p className="type-caption">긴급은 항상 맨 위</p>
      </div>

      <div className="no-scrollbar -mx-5 overflow-x-auto px-5">
        <div className="flex w-max items-center gap-2 pb-1">
          <Chip active={urgentOnly} onClick={() => push({ urgent: urgentOnly ? null : '1' })}>
            긴급만
          </Chip>
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          {STATUSES.map((s) => (
            <Chip
              key={s}
              active={status === s}
              onClick={() => push({ status: status === s ? null : s })}
            >
              {STATUS_LABEL[s]}
            </Chip>
          ))}
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              active={category === c}
              onClick={() => push({ category: category === c ? null : c })}
            >
              {CATEGORY_LABEL[c]}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'h-11 shrink-0 rounded-[10px] border px-3 text-[13px] whitespace-nowrap',
        'transition-colors duration-200 ease-[var(--ease-quiet)]',
        active
          ? 'border-accent/40 bg-accent-weak font-medium text-accent'
          : 'border-line text-text-secondary hover:text-text',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
