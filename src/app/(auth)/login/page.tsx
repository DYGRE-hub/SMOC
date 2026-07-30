import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SignInForm } from '@/app/(auth)/login/SignInForm'
import { getCurrentUser } from '@/lib/auth/session'
import { APP_NAME } from '@/lib/env'

export const metadata = { title: '로그인' }
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/')

  return (
    <div className="reading-column flex min-h-dvh flex-col justify-center py-12">
      <header className="flex flex-col gap-3">
        <p className="type-caption">{APP_NAME}</p>
        <h1 className="type-display text-text">기도의 방에 오신 걸 환영합니다.</h1>
      </header>

      <div className="mt-10">
        <SignInForm />
      </div>

      <p className="type-caption mt-8">
        처음 오셨다면 회원가입 후 로그인해 주십시오.{' '}
        <Link href="/signup" className="text-accent underline-offset-4 hover:underline">
          회원가입
        </Link>
      </p>
    </div>
  )
}
