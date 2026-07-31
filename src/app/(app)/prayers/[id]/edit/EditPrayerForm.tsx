'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition } from 'react'

import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { deletePrayerAction, editPrayerAction } from '@/lib/actions/prayers'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  type Category,
  type Prayer,
} from '@/lib/domain/types'

/**
 * 올리기 화면과 같은 순서·같은 문구를 쓴다.
 * 고칠 때 처음 올릴 때와 다른 화면을 만나면 어디를 봐야 할지 다시 찾게 된다.
 */
export function EditPrayerForm({
  prayer,
  canChooseGroup,
}: {
  prayer: Prayer
  canChooseGroup: boolean
}) {
  const [state, formAction, pending] = useActionState(editPrayerAction, null)
  const [title, setTitle] = useState(prayer.title)
  const [subject, setSubject] = useState(prayer.subject ?? '')
  const [body, setBody] = useState(prayer.body)
  const [category, setCategory] = useState<Category>(prayer.category)

  return (
    <div className="flex flex-col gap-12">
      <form action={formAction} className="flex flex-col gap-8">
        <input type="hidden" name="prayerId" value={prayer.id} />

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
            고치기 전 내용은 기록으로 남고, 타임라인에 &lsquo;수정됨&rsquo;이 표시됩니다.
          </p>
        </div>

        <SegmentedControl
          name="visibility"
          legend="공개 범위"
          defaultValue={prayer.visibility}
          options={[
            { value: 'public', label: '모임 전체' },
            {
              value: 'group',
              label: '우리 셀',
              hint: canChooseGroup
                ? '같은 셀에 속한 분들에게만 보입니다.'
                : '아직 셀에 소속되어 있지 않아 모임 전체로 올라갑니다.',
            },
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
            defaultValue={prayer.prayUntil ?? ''}
            className="h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-[16px] text-text outline-none focus:border-accent/50"
          />
        </div>

        <label className="flex items-center gap-3 py-1">
          <input
            type="checkbox"
            name="urgency"
            defaultChecked={prayer.urgency}
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
          {pending ? '저장 중…' : '저장'}
        </button>
      </form>

      <DeleteSection prayerId={prayer.id} />
    </div>
  )
}

/**
 * 삭제는 폼 밖 맨 아래에 둔다.
 * 저장 버튼 옆에 나란히 두면 손이 미끄러진다.
 */
function DeleteSection({ prayerId }: { prayerId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function remove() {
    startTransition(async () => {
      const result = await deletePrayerAction(prayerId)
      if (result.ok) router.push('/prayers')
      else {
        setError(result.error ?? '지우지 못했습니다.')
        setConfirming(false)
      }
    })
  }

  return (
    <section className="border-t border-line pt-8">
      <h2 className="type-caption mb-2">기도제목 지우기</h2>
      <p className="type-caption mb-4">
        목록과 오늘의 기도에서 사라집니다. 함께 기도한 기록과 나눔도 보이지 않게 됩니다.
      </p>

      {error ? (
        <p className="type-caption mb-3 text-urgent" role="alert">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="h-12 rounded-button border border-urgent px-4 text-[15px] text-urgent transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-80 active:opacity-70 disabled:opacity-50"
          >
            {pending ? '지우는 중…' : '정말 지웁니다'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-12 px-3 text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text active:opacity-70"
          >
            취소
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="h-12 rounded-button border border-line px-4 text-[15px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text active:opacity-70"
        >
          지우기
        </button>
      )}
    </section>
  )
}
