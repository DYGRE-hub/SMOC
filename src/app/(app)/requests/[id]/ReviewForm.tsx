'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition } from 'react'

import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { declineRequestAction, publishRequestAction } from '@/lib/actions/requests'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  type Category,
  type PrayerRequest,
} from '@/lib/domain/types'

/**
 * 요청을 읽고 손봐서 목록으로 옮기는 화면.
 *
 * 올리기·수정 화면과 같은 칸을 같은 순서로 둔다. 리더가 하루에도 몇 번씩
 * 오가는 자리라, 화면마다 배치가 다르면 매번 눈으로 다시 찾아야 한다.
 *
 * 보낸 분의 글은 위에 원문 그대로 두고, 아래에서 고친다.
 * 무엇을 고쳤는지 나중에도 견줄 수 있어야 하기 때문이다.
 */
export function ReviewForm({ request }: { request: PrayerRequest }) {
  const [state, formAction, pending] = useActionState(publishRequestAction, null)
  const [title, setTitle] = useState(request.title)
  const [subject, setSubject] = useState(request.subject ?? '')
  const [body, setBody] = useState(request.body)
  const [category, setCategory] = useState<Category>(
    request.category === 'urgent' ? 'church' : request.category,
  )

  return (
    <div className="flex flex-col gap-12">
      <form action={formAction} className="flex flex-col gap-8">
        <input type="hidden" name="requestId" value={request.id} />

        <div className="flex flex-col gap-2">
          <label htmlFor="title" className="type-caption">
            제목
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-12 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[16px] text-text outline-none transition-colors duration-200 ease-[var(--ease-quiet)] focus:border-accent/50"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="subject" className="type-caption">
            기도 대상자 (선택)
          </label>
          <input
            id="subject"
            name="subject"
            maxLength={60}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="누구를 위한 기도인가요?"
            className="h-12 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[16px] text-text outline-none transition-colors duration-200 ease-[var(--ease-quiet)] placeholder:text-text-tertiary focus:border-accent/50"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="body" className="type-caption">
            내용
          </label>
          <textarea
            id="body"
            name="body"
            rows={8}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full resize-none rounded-[12px] border border-line bg-surface p-4 text-[16px] leading-[1.75] text-text outline-none transition-colors duration-200 ease-[var(--ease-quiet)] focus:border-accent/50"
          />
          <p className="type-caption">
            알아볼 만한 사정이 지나치게 자세히 담겼다면 여기서 다듬어 주세요.
            올라간 뒤에는 모임 전체가 읽습니다.
          </p>
        </div>

        <SegmentedControl
          name="visibility"
          legend="공개 범위"
          defaultValue="public"
          options={[
            { value: 'public', label: '모임 전체' },
            {
              value: 'leaders_only',
              label: '리더에게만',
              hint: '리더와 관리자만 열람할 수 있고, 열람 기록이 남습니다.',
            },
          ]}
        />

        <div className="flex flex-col gap-3">
          <p className="type-caption">카테고리</p>
          <input type="hidden" name="category" value={category} />
          <div className="no-scrollbar -mx-5 overflow-x-auto px-5">
            <div className="flex w-max gap-2 pb-1">
              {CATEGORIES.filter((c) => c !== 'urgent').map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={[
                    'h-11 shrink-0 rounded-[10px] border px-3 text-[13px] whitespace-nowrap',
                    'transition-colors duration-200 ease-[var(--ease-quiet)]',
                    category === c
                      ? 'border-accent/40 bg-accent-weak font-medium text-accent'
                      : 'border-line text-text-secondary hover:text-text active:opacity-70',
                  ].join(' ')}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label htmlFor="prayUntil" className="type-caption">
            언제까지 기도해 주세요 (선택)
          </label>
          <input
            type="date"
            id="prayUntil"
            name="prayUntil"
            className="h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-[16px] text-text outline-none focus:border-accent/50"
          />
        </div>

        <label className="flex items-center gap-3 py-1">
          <input
            type="checkbox"
            name="urgency"
            defaultChecked={request.urgency}
            className="h-5 w-5 shrink-0 accent-[var(--c-accent)]"
          />
          <span className="text-[15px] text-text">긴급 — 오늘의 기도 맨 앞에 올립니다</span>
        </label>

        {state?.error ? (
          <p className="type-caption text-urgent" role="alert">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="flex h-[52px] items-center justify-center rounded-button bg-accent text-[16px] font-medium text-white transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-90 active:opacity-75 disabled:opacity-50"
        >
          {pending ? '올리는 중…' : '기도제목 목록에 올리기'}
        </button>
      </form>

      <DeclineSection requestId={request.id} />
    </div>
  )
}

/**
 * 올리지 않기로 하는 자리. 폼 밖 맨 아래에 둔다.
 * 지우지 않고 남기는 이유는, 나중에 "그 요청 어떻게 됐나요" 라는 물음에
 * 답할 수 있어야 하기 때문이다.
 */
function DeclineSection({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function decline() {
    startTransition(async () => {
      const result = await declineRequestAction(requestId, note)
      if (result.ok) router.push('/requests')
      else setError(result.error ?? '처리하지 못했습니다.')
    })
  }

  return (
    <section className="border-t border-line pt-8">
      <h2 className="type-caption mb-2">올리지 않기</h2>
      <p className="type-caption mb-4">
        목록에 올리지 않고 기록으로만 남깁니다. 요청하신 분께는 따로 연락해 주세요.
      </p>

      {error ? (
        <p className="type-caption mb-3 text-urgent" role="alert">
          {error}
        </p>
      ) : null}

      {open ? (
        <div className="flex flex-col gap-3">
          <label htmlFor="note" className="sr-only">
            남길 메모
          </label>
          <textarea
            id="note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="왜 올리지 않았는지 한 줄 (선택)"
            className="w-full resize-none rounded-[12px] border border-line bg-surface p-4 text-[16px] leading-[1.7] text-text outline-none placeholder:text-text-tertiary focus:border-accent/50"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={decline}
              disabled={pending}
              className="h-12 rounded-button border border-urgent px-4 text-[15px] text-urgent transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-80 active:opacity-70 disabled:opacity-50"
            >
              {pending ? '처리 중…' : '올리지 않기'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-12 px-3 text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text active:opacity-70"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-12 rounded-button border border-line px-4 text-[15px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text active:opacity-70"
        >
          올리지 않기
        </button>
      )}
    </section>
  )
}
