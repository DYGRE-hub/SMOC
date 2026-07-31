import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SignUpForm } from '@/app/(auth)/signup/SignUpForm'
import { getCurrentUser } from '@/lib/auth/session'
import { APP_NAME } from '@/lib/env'

export const metadata = { title: '회원가입' }
export const dynamic = 'force-dynamic'

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect('/')

  return (
    <div className="reading-column flex min-h-dvh flex-col py-12">
      <header className="flex flex-col gap-4">
        <p className="type-caption">{APP_NAME}</p>
        <h1 className="type-display text-text">
          흘러가는 기도제목을
          <br />
          남는 기록으로.
        </h1>
        <p className="type-body text-text-secondary">
          단톡방에서 묻히던 기도제목을 한곳에 모읍니다. 익명으로 부탁할 수 있고, 응답은 함께
          기억합니다.
        </p>
      </header>

      <div className="mt-10">
        <SignUpForm />
      </div>

      <p className="type-caption mt-8">
        이미 계정이 있으신가요?{' '}
        <Link prefetch={false} href="/login" className="text-accent underline-offset-4 hover:underline">
          로그인
        </Link>
      </p>
    </div>
  )
}
