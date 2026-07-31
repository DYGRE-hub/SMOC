'use client'

import Link from 'next/link'
import { useOptimistic, useTransition } from 'react'

import { Icon } from '@/components/ui/Icon'
import { setPrayedAction } from '@/lib/actions/prayers'
import { CATEGORY_LABEL, type Category } from '@/lib/domain/types'
import { prayUntilLabel } from '@/lib/format'

/**
 * 이 화면이 실제로 쓰는 필드만 받는다.
 * 서버 컴포넌트에서 객체를 통째로 넘기면 쓰지 않는 값까지 클라이언트로
 * 직렬화되어 나간다. 기도제목처럼 민감한 데이터에서는 습관적으로 좁혀 두는 편이 낫다.
 */
export interface MissionItem {
  id: string
  title: string
  category: Category
  urgency: boolean
  prayUntil: string | null
  prayedToday: boolean
}

/**
 * 미션 체크 목록.
 *
 * 체크를 되돌릴 수 있게 한 것은 의도적이다. 잘못 눌렀는데 되돌릴 수 없으면
 * 사람들은 체크를 아예 미루게 되고, 그 순간 트래커는 쓸모를 잃는다.
 */
export function MissionList({ items }: { items: MissionItem[] }) {
  return (
    <ul className="border-t border-line">
      {items.map((item) => (
        <MissionRow key={item.id} item={item} />
      ))}
    </ul>
  )
}

function MissionRow({ item }: { item: MissionItem }) {
  const [pending, startTransition] = useTransition()
  const [checked, setChecked] = useOptimistic(item.prayedToday)

  function toggle() {
    startTransition(async () => {
      setChecked(!checked)
      await setPrayedAction(item.id, !checked)
    })
  }

  return (
    <li className="border-b border-line">
      <div className="flex items-start gap-3 py-4">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          role="checkbox"
          aria-checked={checked}
          aria-label={`${item.title} — ${checked ? '기도함, 해제하기' : '기도했다고 표시하기'}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center"
        >
          <span
            className={[
              'flex h-[22px] w-[22px] items-center justify-center rounded-[7px] border',
              'transition-colors duration-200 ease-[var(--ease-quiet)]',
              checked ? 'border-accent bg-accent text-white' : 'border-line text-transparent',
            ].join(' ')}
          >
            <Icon name="check" size={14} />
          </span>
        </button>

        <div className="min-w-0 flex-1 pt-[10px]">
          <Link
            prefetch={false}
            href={`/prayers/${item.id}`}
            className={[
              'block text-[16px] leading-[1.5] tracking-[-0.01em]',
              'transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-70',
              checked ? 'text-text-tertiary line-through decoration-1' : 'text-text',
            ].join(' ')}
          >
            {item.title}
          </Link>
          <p className="type-caption mt-1 flex flex-wrap items-center gap-x-2">
            {item.urgency ? <span className="text-urgent">긴급</span> : null}
            {/* 긴급 건은 카테고리도 '긴급'이라 배지와 겹친다. 한 번만 말한다. */}
            {item.urgency && item.category === 'urgent' ? null : (
              <span>{CATEGORY_LABEL[item.category]}</span>
            )}
            {item.prayUntil ? <span>· {prayUntilLabel(item.prayUntil)}</span> : null}
          </p>
        </div>
      </div>
    </li>
  )
}
