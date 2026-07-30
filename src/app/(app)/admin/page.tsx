import Link from 'next/link'
import { redirect } from 'next/navigation'

import { TranscriptImport } from '@/app/(app)/admin/TranscriptImport'
import { DraftReview } from '@/app/(app)/admin/DraftReview'
import { MemberList } from '@/app/(app)/admin/MemberList'
import { getCurrentUser } from '@/lib/auth/session'
import { getRepository } from '@/lib/db'
import { formatDate } from '@/lib/format'

export const metadata = { title: '관리' }
export const dynamic = 'force-dynamic'

/**
 * 리더·관리자 화면.
 * 대화록을 붙여넣어 초안을 만들고, 하나씩 검수해 게시한다(PRD §5).
 */
export default async function AdminPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/')

  const repo = await getRepository()
  const [pending, imports, members] = await Promise.all([
    repo.listPendingDrafts(user.churchId),
    repo.listImports(user.churchId),
    repo.listUsers(user.churchId),
  ])

  return (
    <div className="reading-column enter-rise py-10">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="type-title text-text">관리</h1>
        <Link
          href="/leader/export"
          className="flex h-11 items-center text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text"
        >
          이번 주 내보내기
        </Link>
      </div>

      <section className="mt-8" aria-labelledby="import-heading">
        <h2 id="import-heading" className="type-caption mb-1">
          단톡방 대화 가져오기
        </h2>
        <p className="type-caption mb-4">
          카카오톡에서 &ldquo;대화 내용 내보내기&rdquo;로 얻은 텍스트를 그대로 붙여넣으세요.
          기도 요청으로 보이는 부분만 초안으로 뽑아 드립니다. 게시는 검수 후에만 이뤄집니다.
        </p>
        <TranscriptImport />

        {imports.length > 0 ? (
          <p className="type-caption mt-4">
            최근 가져오기: {imports[0]?.label} · 메시지 {imports[0]?.messageCount}개 ·{' '}
            {formatDate(imports[0]?.createdAt ?? new Date().toISOString())}
          </p>
        ) : null}
      </section>

      <section className="mt-14 border-t border-line pt-8" aria-labelledby="review-heading">
        <h2 id="review-heading" className="type-caption mb-1">
          검토 대기 {pending.length > 0 ? `(${pending.length})` : ''}
        </h2>
        <p className="type-caption mb-5">
          왼쪽이 원문, 오른쪽이 정리안입니다. 고쳐서 승인하거나 폐기하세요.
        </p>
        <DraftReview items={pending} />
      </section>

      <section className="mt-14 border-t border-line pt-8" aria-labelledby="members-heading">
        <h2 id="members-heading" className="type-caption mb-1">
          멤버 {members.length}명
        </h2>
        <p className="type-caption mb-5">
          리더는 리더 전용 기도제목을 열람할 수 있습니다. 이 관리 화면은 관리자만 들어옵니다.
        </p>
        <MemberList members={members} currentUserId={user.id} />
      </section>
    </div>
  )
}
