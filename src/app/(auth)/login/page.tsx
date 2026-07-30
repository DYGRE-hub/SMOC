import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SignInForm } from '@/app/(auth)/login/SignInForm'
import { getCurrentUser } from '@/lib/auth/session'
import { hasAnyAccount } from '@/lib/auth/bootstrap'
import { APP_NAME } from '@/lib/env'

export const metadata = { title: '로그인' }
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/')
  const firstRun = !(await hasAnyAccount())

  return (
    <div className="reading-column flex min-h-dvh flex-col justify-center py-12">
      <header className="flex flex-col gap-3">
        <p className="type-caption">{APP_NAME}</p>
        <h1 className="type-display text-text">다시 오셨군요.</h1>
      </header>

      <div className="mt-10">
        <SignInForm />
      </div>

      <p className="type-caption mt-8">
        {firstRun
          ? '아직 아무도 가입하지 않았습니다. 처음 가입하는 분이 관리자가 됩니다.'
          : '아직 계정이 없으신가요?'}{' '}
        <Link href="/signup" className="text-accent underline-offset-4 hover:underline">
          회원가입
        </Link>
      </p>
    </div>
  )
}
