'use client'

import { useActionState, useState } from 'react'

import { submitRequestAction } from '@/lib/actions/requests'
import { CATEGORIES, CATEGORY_LABEL, type Category } from '@/lib/domain/types'

/**
 * 교인 누구나 쓰는 기도 요청 칸.
 *
 * 앱에 올리는 화면(ComposeForm)과 순서와 말투를 맞추되, 계정이 없는 분이
 * 쓰는 자리라 공개 범위 같은 선택지는 두지 않는다. 어디까지 보일지는
 * 리더가 옮기면서 정한다. 여기서 고를 것이 많아질수록 그냥 단톡방에 쓰게 된다.
 */
export function RequestForm() {
  const [state, formAction, pending] = useActionState(submitRequestAction, null)
  const [anonymous, setAnonymous] = useState(false)
  const [category, setCategory] = useState<Category>('church')

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {/*
        사람 눈에는 보이지 않는 칸. 자동 프로그램은 폼의 모든 칸을 채우는 습성이 있어서,
        여기에 무언가 들어오면 사람이 쓴 것이 아니라고 본다. 사람에게 문제를 내지
        않고 걸러 내는 방법이다 — 어르신께 찌그러진 글자를 읽히고 싶지 않다.
      */}
      <div aria-hidden className="absolute h-0 w-0 overflow-hidden opacity-0">
        <label htmlFor="website">홈페이지</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="title" className="type-caption">
          제목
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={120}
          placeholder="어머니 수술이 잘 끝나도록"
          className="h-12 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[16px] text-text outline-none transition-colors duration-200 ease-[var(--ease-quiet)] placeholder:text-text-tertiary focus:border-accent/50"
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
          placeholder="누구를 위한 기도인가요?"
          className="h-12 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[16px] text-text outline-none transition-colors duration-200 ease-[var(--ease-quiet)] placeholder:text-text-tertiary focus:border-accent/50"
        />
        <p className="type-caption">
          본인을 위한 기도면 비워 두세요. 다른 분의 이름을 적을 때는 그분이 알고 계신지 한 번
          확인해 주세요.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="body" className="type-caption">
          내용
        </label>
        <textarea
          id="body"
          name="body"
          rows={7}
          required
          maxLength={4000}
          placeholder="어떤 사정인지, 무엇을 위해 기도하면 좋을지 적어 주세요."
          className="w-full resize-none rounded-[12px] border border-line bg-surface p-4 text-[16px] leading-[1.75] text-text outline-none transition-colors duration-200 ease-[var(--ease-quiet)] placeholder:text-text-tertiary focus:border-accent/50"
        />
      </div>

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

      <div className="flex flex-col gap-4 border-t border-line pt-8">
        <label className="flex items-center gap-3 py-1">
          <input
            type="checkbox"
            name="anonymous"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-[var(--c-accent)]"
          />
          <span className="text-[15px] text-text">이름을 밝히지 않고 요청합니다</span>
        </label>

        {anonymous ? (
          <p className="type-caption">
            이름 없이 접수됩니다. 아래 연락처를 남겨 주시면 리더가 확인이 필요할 때만 씁니다.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor="requesterName" className="type-caption">
              이름 (선택)
            </label>
            <input
              id="requesterName"
              name="requesterName"
              maxLength={40}
              placeholder="김은혜"
              className="h-12 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[16px] text-text outline-none transition-colors duration-200 ease-[var(--ease-quiet)] placeholder:text-text-tertiary focus:border-accent/50"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="requesterContact" className="type-caption">
            연락처 (선택)
          </label>
          <input
            id="requesterContact"
            name="requesterContact"
            maxLength={80}
            placeholder="전화번호나 이메일"
            className="h-12 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[16px] text-text outline-none transition-colors duration-200 ease-[var(--ease-quiet)] placeholder:text-text-tertiary focus:border-accent/50"
          />
          <p className="type-caption">
            기도제목에는 보이지 않습니다. 리더가 내용을 확인할 때만 씁니다.
          </p>
        </div>
      </div>

      <label className="flex items-center gap-3 py-1">
        <input
          type="checkbox"
          name="urgency"
          className="h-5 w-5 shrink-0 accent-[var(--c-accent)]"
        />
        <span className="text-[15px] text-text">급한 일입니다</span>
      </label>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--c-accent)]"
        />
        <span className="flex flex-col gap-1">
          <span className="text-[15px] text-text">민감정보 처리에 동의합니다 (필수)</span>
          <span className="type-caption">
            기도제목에는 종교적 신념과 건강에 관한 내용이 담길 수 있습니다. 기도 나눔
            목적으로만 처리하고 제3자에게 제공하지 않으며, 기본 보유 기간은 3년입니다.
          </span>
        </span>
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
        {pending ? '보내는 중…' : '기도 요청 보내기'}
      </button>
    </form>
  )
}
