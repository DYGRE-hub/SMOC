import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ReviewForm } from '@/app/(app)/requests/[id]/ReviewForm'
import { Icon } from '@/components/ui/Icon'
import { getCurrentUser } from '@/lib/auth/session'
import { getRepository } from '@/lib/db'
import { formatDateTime } from '@/lib/format'
import { isLeader, REQUEST_STATUS_LABEL } from '@/lib/domain/types'

export const metadata = { title: '기도 요청 확인' }
export const dynamic = 'force-dynamic'

export default async function RequestReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const viewer = await getCurrentUser()
  if (!viewer) redirect('/login')
  if (!isLeader(viewer.role)) redirect('/')

  const { id } = await params
  const repo = await getRepository()
  const request = await repo.getRequest(viewer, id)
  if (!request) notFound()

  const handled = request.status !== 'pending'

  return (
    <div className="reading-column enter-rise py-6">
      <Link
        prefetch={false}
        href="/requests"
        className="inline-flex h-11 items-center gap-1.5 text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text active:opacity-70"
      >
        <Icon name="arrow-left" size={17} />
        기도 요청
      </Link>

      {/* 보낸 분의 글은 손대기 전 모습 그대로 위에 둔다. */}
      <section className="mt-4 rounded-[12px] border border-line bg-surface p-5">
        <p className="type-caption">받은 그대로</p>
        <h1 className="type-title mt-2 text-text">{request.title}</h1>
        <p className="type-body mt-3 whitespace-pre-line text-text">{request.body}</p>

        <dl className="mt-5 flex flex-col gap-1.5 border-t border-line pt-4">
          <Row label="보낸 분">
            {request.anonymous ? '이름을 밝히지 않음' : (request.requesterName ?? '이름 없음')}
          </Row>
          {request.requesterContact ? (
            <Row label="연락처">{request.requesterContact}</Row>
          ) : null}
          {request.subject ? <Row label="기도 대상자">{request.subject}</Row> : null}
          <Row label="받은 때">
            <time dateTime={request.createdAt}>{formatDateTime(request.createdAt)}</time>
          </Row>
          {request.urgency ? <Row label="표시">급한 일이라고 하셨습니다</Row> : null}
        </dl>
      </section>

      {handled ? (
        <section className="mt-8 flex flex-col gap-3">
          <p className="type-body text-text">
            이 요청은 이미 <strong>{REQUEST_STATUS_LABEL[request.status]}</strong> 처리되었습니다.
          </p>
          {request.note ? <p className="type-caption">남긴 메모 — {request.note}</p> : null}
          {request.publishedPrayerId ? (
            <Link
              prefetch={false}
              href={`/prayers/${request.publishedPrayerId}`}
              className="inline-flex h-12 w-fit items-center rounded-button border border-line px-4 text-[15px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text active:opacity-70"
            >
              올라간 기도제목 보기
            </Link>
          ) : null}
        </section>
      ) : (
        <div className="mt-10">
          <h2 className="type-caption mb-4">손봐서 올리기</h2>
          <ReviewForm request={request} />
        </div>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="type-caption flex gap-3">
      <dt className="w-20 shrink-0">{label}</dt>
      <dd className="text-text-secondary">{children}</dd>
    </div>
  )
}
