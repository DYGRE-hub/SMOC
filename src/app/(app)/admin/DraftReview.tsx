'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { Icon } from '@/components/ui/Icon'
import { decideDraftAction } from '@/lib/actions/admin'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  VISIBILITIES,
  VISIBILITY_LABEL,
  type Category,
  type Visibility,
} from '@/lib/domain/types'
import { formatDateTime } from '@/lib/format'
import type { ImportDraft } from '@/lib/db/local-store'

interface Item {
  draft: ImportDraft
  label: string
}

/**
 * 리더 검수 화면 (PRD §9.3).
 * 좌측 원문, 우측 편집 가능한 초안. 키보드로 빠르게 넘긴다 — J/K 이동, A 승인, X 폐기.
 */
export function DraftReview({ items }: { items: Item[] }) {
  const [focused, setFocused] = useState(0)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      // 입력 중에는 단축키가 글자를 먹어버리면 안 된다.
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const key = event.key.toLowerCase()
      if (key === 'j') {
        event.preventDefault()
        setFocused((i) => Math.min(i + 1, items.length - 1))
      } else if (key === 'k') {
        event.preventDefault()
        setFocused((i) => Math.max(i - 1, 0))
      } else if (key === 'a' || key === 'x') {
        const card = cardRefs.current[focused]
        const form = card?.querySelector<HTMLFormElement>('form')
        if (!form) return
        event.preventDefault()
        const field = form.querySelector<HTMLInputElement>('input[name="decision"]')
        if (field) field.value = key === 'a' ? 'approved' : 'discarded'
        form.requestSubmit()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focused, items.length])

  useEffect(() => {
    cardRefs.current[focused]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focused])

  if (items.length === 0) {
    return (
      <p className="type-body text-text-secondary">
        검토를 기다리는 초안이 없습니다.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="type-caption">
        단축키 — <Key>J</Key> 다음 <Key>K</Key> 이전 <Key>A</Key> 승인 <Key>X</Key> 폐기
      </p>
      {items.map((item, index) => (
        <div
          key={item.draft.id}
          ref={(el) => {
            cardRefs.current[index] = el
          }}
          onFocusCapture={() => setFocused(index)}
          onMouseDown={() => setFocused(index)}
        >
          <DraftCard item={item} focused={index === focused} />
        </div>
      ))}
    </div>
  )
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 rounded-[4px] border border-line px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
      {children}
    </kbd>
  )
}

function DraftCard({ item, focused }: { item: Item; focused: boolean }) {
  const { draft } = item
  const [state, formAction, pending] = useActionState(decideDraftAction, null)
  const [anonymous, setAnonymous] = useState(false)

  return (
    <article
      className={[
        'rounded-[12px] border transition-colors duration-200 ease-[var(--ease-quiet)]',
        focused ? 'border-accent/40' : 'border-line',
      ].join(' ')}
    >
      <div className="grid gap-0 md:grid-cols-2">
        {/* 원문 — 언제든 대조할 수 있어야 한다(PRD §6) */}
        <div className="border-b border-line p-5 md:border-b-0 md:border-r">
          <p className="type-caption mb-3">
            원문 · {draft.speaker}
            {draft.spokenAt ? ` · ${formatDateTime(draft.spokenAt)}` : ''}
          </p>
          <p className="whitespace-pre-line text-[14px] leading-[1.7] text-text-secondary">
            {draft.rawExcerpt}
          </p>

          {draft.sensitiveHits.length > 0 ? (
            <div className="mt-4 rounded-[10px] border border-line p-3">
              <p className="type-caption flex items-center gap-1.5 text-urgent">
                <Icon name="alert" size={14} />
                개인정보로 보이는 부분이 있습니다
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {draft.sensitiveHits.map((hit) => (
                  <li key={hit} className="type-caption break-all">
                    {hit}
                  </li>
                ))}
              </ul>
              <p className="type-caption mt-2">
                게시 전에 오른쪽 본문에서 지워 주세요.
              </p>
            </div>
          ) : null}
        </div>

        {/* 정리안 */}
        <form action={formAction} className="flex flex-col gap-4 p-5">
          <input type="hidden" name="draftId" value={draft.id} />
          <input type="hidden" name="decision" defaultValue="approved" />

          <div className="flex flex-col gap-2">
            <label htmlFor={`title-${draft.id}`} className="type-caption">
              제목
            </label>
            <input
              id={`title-${draft.id}`}
              name="title"
              defaultValue={draft.draftTitle}
              maxLength={120}
              className="h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-[15px] text-text outline-none focus:border-accent/50"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor={`body-${draft.id}`} className="type-caption">
              내용
            </label>
            <textarea
              id={`body-${draft.id}`}
              name="body"
              rows={5}
              defaultValue={draft.draftBody}
              className="w-full resize-y rounded-[12px] border border-line bg-surface p-3 text-[14px] leading-[1.7] text-text outline-none focus:border-accent/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              id={`category-${draft.id}`}
              name="category"
              label="카테고리"
              defaultValue={draft.draftCategory}
              options={CATEGORIES.map((c) => [c, CATEGORY_LABEL[c]] as [Category, string])}
            />
            <Select
              id={`visibility-${draft.id}`}
              name="visibility"
              label="공개 범위"
              defaultValue="public"
              options={VISIBILITIES.map(
                (v) => [v, VISIBILITY_LABEL[v]] as [Visibility, string],
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="h-[18px] w-[18px] accent-[var(--c-accent)]"
              />
              <span className="text-[14px] text-text">익명으로 올리기</span>
            </label>
            <input type="hidden" name="authorMode" value={anonymous ? 'anonymous' : 'named'} />
            {!anonymous ? (
              <input
                name="authorDisplayName"
                defaultValue={draft.speaker}
                maxLength={40}
                aria-label="표시할 작성자 이름"
                className="h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-[14px] text-text outline-none focus:border-accent/50"
              />
            ) : (
              <p className="type-caption">
                대화록에서 온 건이라 작성자 계정과는 연결되지 않습니다.
              </p>
            )}
          </div>

          {state?.error ? (
            <p className="type-caption text-urgent" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              disabled={pending}
              onClick={(e) => setDecision(e.currentTarget, 'approved')}
              className="h-11 flex-1 rounded-button bg-accent text-[14px] font-medium text-white transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-90 disabled:opacity-50"
            >
              승인하고 게시
            </button>
            <button
              type="submit"
              disabled={pending}
              onClick={(e) => setDecision(e.currentTarget, 'discarded')}
              className="h-11 rounded-button border border-line px-4 text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text disabled:opacity-50"
            >
              폐기
            </button>
          </div>
        </form>
      </div>
    </article>
  )
}

function setDecision(button: HTMLButtonElement, value: 'approved' | 'discarded') {
  const field = button.form?.querySelector<HTMLInputElement>('input[name="decision"]')
  if (field) field.value = value
}

function Select<T extends string>({
  id,
  name,
  label,
  defaultValue,
  options,
}: {
  id: string
  name: string
  label: string
  defaultValue: T
  options: [T, string][]
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="type-caption">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="h-11 w-full rounded-[10px] border border-line bg-surface px-2.5 text-[14px] text-text outline-none focus:border-accent/50"
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  )
}
