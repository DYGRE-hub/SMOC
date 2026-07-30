'use client'

import { useActionState, useRef } from 'react'

import { importTranscriptAction } from '@/lib/actions/admin'

const SAMPLE = `2026년 7월 28일 오후 9:14, 김은혜 : 여러분 기도 부탁드립니다
2026년 7월 28일 오후 9:14, 김은혜 : 저희 어머니가 다음 주 화요일에 무릎 수술을 받으세요. 연세가 있으셔서 마취가 걱정입니다.
2026년 7월 28일 오후 9:15, 박성실 : ㅋㅋㅋ
2026년 7월 28일 오후 9:16, 박성실 : 아멘 함께 기도할게요
2026년 7월 28일 오후 9:20, 이믿음 : 남편이 갑자기 실직했습니다. 아이들에게 어떻게 말해야 할지 모르겠어요
2026년 7월 29일 오전 7:02, 김은혜 : 긴급 기도 요청입니다. 집사님이 새벽에 사고로 중환자실에 계십니다`

export function TranscriptImport() {
  const [state, formAction, pending] = useActionState(importTranscriptAction, null)
  const ref = useRef<HTMLTextAreaElement>(null)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <textarea
        ref={ref}
        name="transcript"
        rows={10}
        required
        placeholder={`2026년 7월 28일 오후 9:14, 김은혜 : 기도 부탁드립니다\n[김은혜] [오후 9:14] 기도 부탁드립니다\n\n두 형식 모두 알아봅니다.`}
        className="w-full resize-y rounded-[12px] border border-line bg-surface p-4 font-mono text-[13px] leading-[1.7] text-text outline-none placeholder:text-text-tertiary focus:border-accent/50"
      />

      <input
        type="text"
        name="label"
        maxLength={80}
        placeholder="이름표 (선택) — 예: 7월 넷째 주 중보기도방"
        className="h-11 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[14px] text-text outline-none placeholder:text-text-tertiary focus:border-accent/50"
      />

      {state?.error ? (
        <p className="type-caption text-urgent" role="alert">
          {state.error}
        </p>
      ) : null}

      {state?.ok && state.summary ? (
        <p className="type-caption" role="status">
          메시지 {state.summary.messages}개를 읽어 {state.summary.candidates}개의 초안을
          만들었습니다. 아래 검토 대기에서 확인해 주세요.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-12 rounded-button bg-accent px-5 text-[15px] font-medium text-white transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-90 disabled:opacity-50"
        >
          {pending ? '읽는 중…' : '읽어들이기'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!ref.current) return
            ref.current.value = SAMPLE
            ref.current.focus()
          }}
          className="h-12 rounded-button border border-line px-4 text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text"
        >
          예시 넣어보기
        </button>
      </div>
    </form>
  )
}
