'use client'

import { useActionState, useState } from 'react'

import { Field } from '@/components/ui/Field'
import { signInAction } from '@/lib/actions/auth'

/**
 * 입력을 제어 컴포넌트로 둔다 — React 19 는 서버 액션 뒤 폼을 초기화하므로,
 * 비밀번호를 한 번 틀리면 이메일까지 지워져 다시 쳐야 한다.
 */
export function SignInForm() {
  const [state, formAction, pending] = useActionState(signInAction, null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field
        label="이메일"
        name="email"
        type="email"
        autoComplete="email"
        required
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />
      <Field
        label="비밀번호"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {state?.error ? (
        <p className="type-caption text-urgent" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex h-[52px] items-center justify-center rounded-button bg-accent text-[16px] font-medium text-white transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-90 disabled:opacity-50"
      >
        {pending ? '들어가는 중…' : '로그인'}
      </button>
    </form>
  )
}
