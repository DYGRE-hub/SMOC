'use client'

import { useActionState, useState } from 'react'

import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { createPrayerAction } from '@/lib/actions/prayers'
import { CATEGORIES, CATEGORY_LABEL, type Category } from '@/lib/domain/types'

/**
 * 필수 결정은 두 가지뿐이다 — 이름을 밝힐지, 누구에게 보일지(PRD §4.1).
 * 나머지는 전부 선택이고, 카테고리를 고르지 않으면 제목과 본문에서 추정한다.
 */
export function ComposeForm({ canChooseGroup }: { canChooseGroup: boolean }) {
  const [state, formAction, pending] = useActionState(createPrayerAction, null)
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<Category | null>(null)

  const suggestion = suggestCategory(`${title}\n${body}`)
  const effective = category ?? suggestion

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <label htmlFor="title" className="type-caption">
          제목
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={120}
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="누구를 위한 기도인가요?"
          className="h-12 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[16px] text-text outline-none transition-colors duration-200 ease-[var(--ease-quiet)] placeholder:text-text-tertiary focus:border-accent/50"
        />
        {/* 남의 이름을 올리는 자리라 한 번은 짚고 넘어간다. 기술로 막을 수 없는 부분이다. */}
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
          rows={8}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="어떤 사정인지, 무엇을 위해 기도하면 좋을지 적어 주세요."
          className="w-full resize-none rounded-[12px] border border-line bg-surface p-4 text-[16px] leading-[1.75] text-text outline-none transition-colors duration-200 ease-[var(--ease-quiet)] placeholder:text-text-tertiary focus:border-accent/50"
        />
      </div>

      <SegmentedControl
        name="authorMode"
        legend="내 이름"
        defaultValue="named"
        options={[
          { value: 'named', label: '이름 밝히기', hint: '올린 사람으로 표시 ID가 함께 보입니다.' },
          {
            value: 'anonymous',
            label: '익명',
            hint: '올린 사람이 누구인지 남지 않습니다. 리더와 관리자도 조회할 수 없습니다.',
          },
        ]}
      />

      <SegmentedControl
        name="visibility"
        legend="공개 범위"
        defaultValue="public"
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
        <p className="type-caption">
          카테고리
          {!category && (title + body).trim().length > 4 ? (
            <span className="text-accent"> · {CATEGORY_LABEL[suggestion]}(으)로 제안됨</span>
          ) : null}
        </p>
        <input type="hidden" name="category" value={effective} />
        <div className="no-scrollbar -mx-5 overflow-x-auto px-5">
          <div className="flex w-max gap-2 pb-1">
            {CATEGORIES.filter((c) => c !== 'urgent').map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(category === c ? null : c)}
                aria-pressed={effective === c}
                className={[
                  'h-11 shrink-0 rounded-[10px] border px-3 text-[13px] whitespace-nowrap',
                  'transition-colors duration-200 ease-[var(--ease-quiet)]',
                  effective === c
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
        <p className="type-caption">
          수술일, 시험일 같은 날짜를 적어두면 그날 리마인더가 가고, 이후 결과를 여쭙는 알림이
          갑니다.
        </p>
      </div>

      <label className="flex items-center gap-3 py-1">
        <input
          type="checkbox"
          name="urgency"
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
        {pending ? '올리는 중…' : '기도 부탁하기'}
      </button>
    </form>
  )
}

/**
 * 아주 단순한 키워드 기반 추정.
 * AI 는 제안만 하고 결정은 사람이 한다(PRD §6) — 여기서도 언제든 덮어쓸 수 있다.
 */
function suggestCategory(text: string): Category {
  const lower = text.toLowerCase()
  const rules: [Category, RegExp][] = [
    ['healing', /수술|병원|아프|치유|암|입원|검사|건강|통증/],
    ['children', /아이|자녀|아들|딸|수능|시험|학교|입시|유치원/],
    ['family', /남편|아내|부모|가정|시댁|친정|가족|이혼/],
    ['finance', /재정|빚|대출|생활비|실직|월세|돈/],
    ['work', /직장|이직|면접|취업|사업|승진|회사/],
    ['salvation', /구원|전도|믿음|예수|복음|영접/],
    ['mission', /선교|파송|현지|단기선교/],
    ['thanks', /감사|응답|기쁨|축하/],
    ['church', /교회|사역|예배|목장|셀|새가족/],
  ]
  for (const [category, pattern] of rules) {
    if (pattern.test(lower)) return category
  }
  return 'church'
}
