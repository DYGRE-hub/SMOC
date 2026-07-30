'use client'

import { useActionState, useEffect, useState } from 'react'

import { Field } from '@/components/ui/Field'
import { updateDisplayNameAction } from '@/lib/actions/auth'

export function DisplayNameForm({ current }: { current: string }) {
  const [state, formAction, pending] = useActionState(updateDisplayNameAction, null)
  const [value, setValue] = useState(current)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!state?.ok) return
    setSaved(true)
    const timer = setTimeout(() => setSaved(false), 2400)
    return () => clearTimeout(timer)
  }, [state])

  const dirty = value.trim() !== current

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="기도제목에 보이는 이름"
        name="displayName"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        minLength={2}
        maxLength={20}
        required
        error={state?.error}
        hint="이미 올라간 기도제목에는 그때의 이름이 그대로 남습니다."
      />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !dirty}
          className="h-12 rounded-button bg-accent px-5 text-[15px] font-medium text-white transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-90 disabled:opacity-40"
        >
          {pending ? '저장 중…' : '저장'}
        </button>
        <p className="type-caption" aria-live="polite">
          {saved ? '표시 ID를 바꿨습니다.' : ''}
        </p>
      </div>
    </form>
  )
}
