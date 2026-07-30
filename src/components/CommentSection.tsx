'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { Icon } from '@/components/ui/Icon'
import { addUpdateAction, setStatusAction } from '@/lib/actions/prayers'
import {
  STATUSES,
  STATUS_LABEL,
  type PrayerUpdate,
  type Status,
} from '@/lib/domain/types'
import { formatDateTime } from '@/lib/format'

const TYPE_LABEL: Record<PrayerUpdate['type'], string> = {
  comment: '',
  status_change: '상태 변경',
  answer: '응답 나눔',
  edit: '본문 수정',
}

interface Props {
  prayerId: string
  updates: PrayerUpdate[]
  currentStatus: Status
  canChangeStatus: boolean
}

/**
 * 상세 화면 아래의 나눔(댓글) 영역.
 *
 * 시트 안에 감춰두지 않고 본문 바로 아래에 펼쳐 둔다.
 * 기도제목은 읽고 끝나는 글이 아니라 소식이 이어지는 글이라서,
 * 남긴 말들이 먼저 보여야 다음 사람도 한마디 보태게 된다.
 */
export function CommentSection({ prayerId, updates, currentStatus, canChangeStatus }: Props) {
  const [state, formAction, pending] = useActionState(addUpdateAction, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.ok) formRef.current?.reset()
  }, [state])

  return (
    <section aria-labelledby="comments-heading" className="flex flex-col gap-6">
      <h2 id="comments-heading" className="type-caption">
        나눔 {updates.length > 0 ? updates.length : ''}
      </h2>

      {updates.length > 0 ? (
        <ol className="flex flex-col gap-6">
          {updates.map((update) => (
            <li key={update.id} className="flex flex-col gap-1.5">
              <p className="type-caption flex flex-wrap items-center gap-x-2">
                <span className={update.type === 'answer' ? 'text-answered' : 'text-text-secondary'}>
                  {update.authorDisplayName ?? '익명'}
                </span>
                <time dateTime={update.createdAt}>{formatDateTime(update.createdAt)}</time>
                {TYPE_LABEL[update.type] ? (
                  <span className={update.type === 'answer' ? 'text-answered' : undefined}>
                    · {TYPE_LABEL[update.type]}
                  </span>
                ) : null}
              </p>
              <p className="type-body whitespace-pre-line text-text">{update.body}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="type-caption">
          아직 나눔이 없습니다. 기도하며 떠오른 말씀이나 소식을 남겨 주세요.
        </p>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="prayerId" value={prayerId} />
        <label htmlFor="comment-body" className="sr-only">
          나눔 남기기
        </label>
        <textarea
          id="comment-body"
          name="body"
          rows={3}
          required
          maxLength={2000}
          placeholder="함께 기도하며 남기고 싶은 말을 적어 주세요."
          className="w-full resize-none rounded-[12px] border border-line bg-surface p-4 text-[15px] leading-[1.7] text-text outline-none placeholder:text-text-tertiary focus:border-accent/50"
        />
        {state?.error ? (
          <p className="type-caption text-urgent" role="alert">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="h-12 self-start rounded-button bg-accent px-5 text-[15px] font-medium text-white transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-90 disabled:opacity-50"
        >
          {pending ? '남기는 중…' : '나눔 남기기'}
        </button>
      </form>

      {canChangeStatus ? (
        <StatusForm prayerId={prayerId} currentStatus={currentStatus} />
      ) : null}
    </section>
  )
}

/** 상태 변경은 리더 또는 본인만. 응답으로 옮기는 것도 여기서 한다. */
function StatusForm({ prayerId, currentStatus }: { prayerId: string; currentStatus: Status }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>(currentStatus)
  const [state, formAction, pending] = useActionState(setStatusAction, null)

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="type-caption flex h-11 items-center gap-1.5 self-start underline-offset-4 hover:underline"
      >
        <Icon name="check" size={14} />
        상태 바꾸기 (지금은 {STATUS_LABEL[currentStatus]})
      </button>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-line pt-6">
      <input type="hidden" name="prayerId" value={prayerId} />
      <input type="hidden" name="status" value={status} />
      <p className="type-caption">상태 바꾸기</p>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={[
              'h-11 rounded-[10px] border px-3 text-[13px]',
              'transition-colors duration-200 ease-[var(--ease-quiet)]',
              status === s
                ? 'border-accent/40 bg-accent-weak font-medium text-accent'
                : 'border-line text-text-secondary hover:text-text',
            ].join(' ')}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <textarea
        name="note"
        rows={2}
        placeholder={
          status === 'answered'
            ? '어떻게 응답되었는지 함께 나눠 주세요.'
            : '상태와 함께 남길 한마디 (선택)'
        }
        className="w-full resize-none rounded-[12px] border border-line bg-surface p-4 text-[15px] leading-[1.7] text-text outline-none placeholder:text-text-tertiary focus:border-accent/50"
      />
      {state?.error ? (
        <p className="type-caption text-urgent" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || status === currentStatus}
          className="h-12 rounded-button border border-line px-4 text-[15px] text-text transition-colors duration-200 ease-[var(--ease-quiet)] hover:border-accent/40 disabled:opacity-40"
        >
          {STATUS_LABEL[status]}(으)로 바꾸기
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-12 px-3 text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text"
        >
          취소
        </button>
      </div>
    </form>
  )
}
