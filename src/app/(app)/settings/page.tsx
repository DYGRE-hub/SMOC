import { redirect } from 'next/navigation'

import { DisplayNameForm } from '@/app/(app)/settings/DisplayNameForm'
import { AppearanceSettings } from '@/app/(app)/settings/AppearanceSettings'
import { signOutAction } from '@/lib/actions/auth'
import { getCurrentUser } from '@/lib/auth/session'
import { ROLE_LABEL } from '@/lib/domain/types'

export const metadata = { title: '설정' }
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="reading-column enter-rise py-10">
      <h1 className="type-title text-text">설정</h1>

      <Section title="표시 ID">
        <DisplayNameForm current={user.displayName} />
      </Section>

      <Section title="계정">
        <dl className="flex flex-col gap-3">
          <Row label="이름" value={user.name} />
          <Row label="이메일" value={user.email ?? '—'} />
          <Row label="역할" value={ROLE_LABEL[user.role]} />
        </dl>
        <p className="type-caption mt-4">
          이름과 이메일은 다른 멤버에게 보이지 않습니다. 기도제목에 표시되는 이름은 위의 표시
          ID입니다.
        </p>
      </Section>

      <Section title="화면">
        <AppearanceSettings />
      </Section>

      <Section title="개인정보">
        <p className="type-body text-[15px] text-text-secondary">
          익명으로 올린 요청의 작성자 정보는 분리 보관되며, 리더와 관리자도 조회할 수 없습니다.
          법적 요구나 자해·타해 위험 신고가 있을 때만 관리자 2인 승인과 감사 기록을 남기고
          예외적으로 확인합니다.
        </p>
      </Section>

      <div className="mt-12 border-t border-line pt-8">
        <form action={signOutAction}>
          <button
            type="submit"
            className="h-12 rounded-button border border-line px-5 text-[15px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text"
          >
            로그아웃
          </button>
        </form>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-line pt-8">
      <h2 className="type-caption mb-4">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="type-caption">{label}</dt>
      <dd className="text-[15px] text-text">{value}</dd>
    </div>
  )
}
