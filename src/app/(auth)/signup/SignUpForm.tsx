'use client'

import { useActionState, useState } from 'react'

import { Field } from '@/components/ui/Field'
import { signUpAction } from '@/lib/actions/auth'

/**
 * 모든 입력을 제어 컴포넌트로 둔다.
 *
 * React 19 는 서버 액션이 끝나면 폼을 초기화한다. 그대로 두면 가입에 한 번
 * 실패했을 때 이메일과 비밀번호가 통째로 날아가서, 문구 하나 틀린 사람이
 * 처음부터 다시 쳐야 한다. 값을 상태로 붙들어 그 일을 막는다.
 */
export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, null)

  const [passphrase, setPassphrase] = useState('')
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [touchedHandle, setTouchedHandle] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [covenant, setCovenant] = useState(false)
  const [sensitive, setSensitive] = useState(false)

  // 표시 ID를 아직 건드리지 않았다면 이름을 따라간다.
  // 대부분은 실명 그대로 쓰고, 원하는 사람만 바꾸면 되도록.
  const handleValue = touchedHandle ? displayName : name

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Field
        label="가입 문구"
        name="passphrase"
        required
        autoComplete="off"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        placeholder="리더가 알려준 문구"
        hint="공동체가 공유하는 문구입니다. 모르시면 리더에게 문의해 주세요."
      />

      <Field
        label="이름"
        name="name"
        autoComplete="name"
        required
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="김은혜"
        hint="리더가 멤버를 확인할 때만 쓰입니다."
      />

      <Field
        label="표시 ID"
        name="displayName"
        required
        minLength={2}
        maxLength={20}
        value={handleValue}
        onChange={(e) => {
          setTouchedHandle(true)
          setDisplayName(e.target.value)
        }}
        placeholder="은혜"
        hint="기도제목에 보이는 이름입니다. 설정에서 언제든 바꿀 수 있습니다."
      />

      <Field
        label="이메일"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />

      <Field
        label="비밀번호"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint="8자 이상."
      />

      <div className="flex flex-col gap-4 border-t border-line pt-6">
        <Consent
          name="covenant"
          checked={covenant}
          onChange={setCovenant}
          title="이 방에서 본 것은 이 방에 둡니다 (필수)"
          detail="화면을 캡처해 옮기지 않고, 여기서 알게 된 일을 밖에서 이야기하지 않겠습니다."
        />
        <Consent
          name="sensitiveConsent"
          checked={sensitive}
          onChange={setSensitive}
          title="민감정보 처리에 동의합니다 (필수)"
          detail="기도제목에는 종교적 신념과 건강에 관한 내용이 담길 수 있습니다. 기도 나눔 목적으로만 처리하고 제3자에게 제공하지 않으며, 기본 보유 기간은 3년입니다."
        />
      </div>

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
        {pending ? '만드는 중…' : '시작하기'}
      </button>
    </form>
  )
}

function Consent({
  name,
  checked,
  onChange,
  title,
  detail,
}: {
  name: string
  checked: boolean
  onChange: (v: boolean) => void
  title: string
  detail: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={name}
        required
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-[var(--c-accent)]"
      />
      <span className="flex flex-col gap-1">
        <span className="text-[15px] leading-[1.5] text-text">{title}</span>
        <span className="type-caption">{detail}</span>
      </span>
    </label>
  )
}
