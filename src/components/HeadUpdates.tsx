'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'

import { Icon } from '@/components/ui/Icon'
import {
  addHeadUpdateAction,
  deleteHeadUpdateAction,
  editHeadUpdateAction,
} from '@/lib/actions/prayers'
import type { PrayerHeadUpdate } from '@/lib/domain/types'
import { formatDate } from '@/lib/format'

/**
 * 원문 위에 얹는 업데이트.
 *
 * 지금까지는 부탁한 분이 본문 맨 앞에 직접 "[Update] 8/13" 을 적어 넣고 줄을 그어
 * 원문과 갈라 두셨다. 그 손길을 그대로 화면이 맡는다 — 새 소식이 위, 줄 하나,
 * 그 아래가 처음 올린 글이다.
 *
 * 원문을 덮어쓰지 않는다. 처음 어떤 마음으로 부탁했는지가 남아 있어야
 * 나중에 응답을 견줄 수 있다(PRD §4.2).
 */
export function HeadUpdates({
  prayerId,
  updates,
  canAdd,
}: {
  prayerId: string
  updates: PrayerHeadUpdate[]
  /** 올린 본인과 리더 이상에게만 보인다. */
  canAdd: boolean
}) {
  return (
    <div className="flex flex-col">
      {canAdd ? <AddForm prayerId={prayerId} /> : null}

      {updates.map((update) => (
        <HeadUpdateBlock key={update.id} update={update} prayerId={prayerId} />
      ))}
    </div>
  )
}

function HeadUpdateBlock({
  update,
  prayerId,
}: {
  update: PrayerHeadUpdate
  prayerId: string
}) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [state, formAction] = useActionState(editHeadUpdateAction, null)

  useEffect(() => {
    if (state?.ok) setEditing(false)
  }, [state])

  function remove() {
    startTransition(async () => {
      const result = await deleteHeadUpdateAction(update.id, prayerId)
      if (!result.ok) {
        setError(result.error ?? '지우지 못했습니다.')
        setConfirming(false)
      }
    })
  }

  return (
    <section className="flex flex-col gap-3 pb-6">
      <p className="type-caption">
        <span className="font-medium text-accent">[Update]</span>{' '}
        <time dateTime={update.createdAt}>{formatDate(update.createdAt)}</time>
      </p>

      {editing ? (
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="updateId" value={update.id} />
          <input type="hidden" name="prayerId" value={prayerId} />
          <label htmlFor={`head-${update.id}`} className="sr-only">
            업데이트 고치기
          </label>
          <textarea
            id={`head-${update.id}`}
            name="body"
            rows={5}
            required
            maxLength={4000}
            defaultValue={update.body}
            autoFocus
            className="w-full resize-none rounded-[12px] border border-line bg-surface p-4 text-[16px] leading-[1.75] text-text outline-none focus:border-accent/50"
          />
          {state?.error ? (
            <p className="type-caption text-urgent" role="alert">
              {state.error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              className="h-11 rounded-button bg-accent px-4 text-[14px] font-medium text-white transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-90 active:opacity-75"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="h-11 px-3 text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text active:opacity-70"
            >
              취소
            </button>
          </div>
        </form>
      ) : (
        <p className="type-body whitespace-pre-line text-text">{update.body}</p>
      )}

      {error ? (
        <p className="type-caption text-urgent" role="alert">
          {error}
        </p>
      ) : null}

      {update.editable && !editing ? (
        confirming ? (
          <p className="type-caption flex items-center gap-3">
            <span>이 업데이트를 지울까요?</span>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="h-9 text-urgent underline-offset-4 hover:underline active:opacity-70 disabled:opacity-50"
            >
              지우기
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-9 underline-offset-4 hover:underline active:opacity-70"
            >
              취소
            </button>
          </p>
        ) : (
          <p className="type-caption flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-9 underline-offset-4 hover:underline active:opacity-70"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="h-9 underline-offset-4 hover:underline active:opacity-70"
            >
              삭제
            </button>
          </p>
        )
      ) : null}

      {/* 새 소식과 처음 올린 글을 가르는 줄. 손으로 그어 오시던 그 줄이다. */}
      <hr className="mt-1 border-0 border-t border-line" />
    </section>
  )
}

/** 업데이트를 새로 얹는 자리. 접어 두었다가 누를 때만 펼친다. */
function AddForm({ prayerId }: { prayerId: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(addHeadUpdateAction, null)

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-6 inline-flex h-11 w-fit items-center gap-1.5 rounded-[10px] border border-line px-3 text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text active:opacity-70"
      >
        <Icon name="plus" size={16} />
        업데이트 추가
      </button>
    )
  }

  return (
    <form action={formAction} className="mb-6 flex flex-col gap-2">
      <input type="hidden" name="prayerId" value={prayerId} />
      <label htmlFor="head-new" className="type-caption">
        업데이트 — 원문 위에 새 소식으로 붙습니다
      </label>
      <textarea
        id="head-new"
        name="body"
        rows={5}
        required
        maxLength={4000}
        autoFocus
        placeholder="그동안 어떻게 되었는지, 지금은 무엇을 위해 기도하면 좋을지 적어 주세요."
        className="w-full resize-none rounded-[12px] border border-line bg-surface p-4 text-[16px] leading-[1.75] text-text outline-none placeholder:text-text-tertiary focus:border-accent/50"
      />
      {state?.error ? (
        <p className="type-caption text-urgent" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-button bg-accent px-4 text-[14px] font-medium text-white transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-90 active:opacity-75 disabled:opacity-50"
        >
          {pending ? '올리는 중…' : '업데이트 올리기'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-11 px-3 text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text active:opacity-70"
        >
          취소
        </button>
      </div>
    </form>
  )
}
