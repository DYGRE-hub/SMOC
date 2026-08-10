import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/session'
import { getRepository } from '@/lib/db'
import { formatDateTime } from '@/lib/format'
import {
  CATEGORY_LABEL,
  isLeader,
  REQUEST_STATUS_LABEL,
  type PrayerRequest,
} from '@/lib/domain/types'

export const metadata = { title: '기도 요청' }
export const dynamic = 'force-dynamic'

/**
 * 밖에서 들어온 요청함. 리더 이상만 들어온다.
 *
 * 기다리는 건을 위에 모으고, 처리한 건은 아래에 기록으로 남긴다.
 * 지우지 않는 이유는 "그 요청 어떻게 됐나요" 라는 물음에 답할 수 있어야 해서다.
 */
export default async function RequestsPage() {
  const viewer = await getCurrentUser()
  if (!viewer) redirect('/login')
  // 관리 화면과 같은 규칙 — 권한이 없으면 화면 자체를 만나지 않는다.
  if (!isLeader(viewer.role)) redirect('/')

  const repo = await getRepository()
  const requests = await repo.listRequests(viewer, null)
  const pending = requests.filter((r) => r.status === 'pending')
  const handled = requests.filter((r) => r.status !== 'pending')

  return (
    <div className="reading-column enter-rise py-10">
      <h1 className="type-title text-text">기도 요청</h1>
      <p className="type-caption mt-2">
        가입하지 않은 교인이 보낸 요청입니다. 확인하고 손봐서 목록으로 올립니다.
      </p>

      <section className="mt-10">
        <h2 className="type-caption">기다리는 요청 {pending.length > 0 ? pending.length : ''}</h2>
        {pending.length > 0 ? (
          <ul className="mt-2 border-t border-line">
            {pending.map((request) => (
              <RequestRow key={request.id} request={request} />
            ))}
          </ul>
        ) : (
          <p className="type-body mt-6 text-text-secondary">
            기다리는 요청이 없습니다.
          </p>
        )}
      </section>

      {handled.length > 0 ? (
        <section className="mt-14">
          <h2 className="type-caption">처리한 요청</h2>
          <ul className="mt-2 border-t border-line">
            {handled.map((request) => (
              <RequestRow key={request.id} request={request} />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-14 border-t border-line pt-6">
        <p className="type-caption">
          교인들에게 알려 줄 주소는 <span className="text-text">/request</span> 입니다.
          로그인 없이 열리고, 여기 들어온 글은 리더가 올리기 전까지 어디에도 보이지 않습니다.
        </p>
      </div>
    </div>
  )
}

function RequestRow({ request }: { request: PrayerRequest }) {
  const waiting = request.status === 'pending'
  return (
    <li className="border-b border-line">
      <Link
        prefetch={false}
        href={`/requests/${request.id}`}
        className="flex flex-col gap-1.5 py-5 transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-70"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className={`text-[16px] ${waiting ? 'text-text' : 'text-text-secondary'}`}>
            {request.title}
          </span>
          {!waiting ? (
            <span className="type-caption shrink-0">
              {REQUEST_STATUS_LABEL[request.status]}
            </span>
          ) : null}
        </div>
        <p className="type-caption flex flex-wrap items-center gap-x-2">
          {request.urgency ? <span className="text-urgent">급함</span> : null}
          <span>{request.anonymous ? '이름 밝히지 않음' : (request.requesterName ?? '이름 없음')}</span>
          <span aria-hidden className="text-text-tertiary/60">·</span>
          <span>{CATEGORY_LABEL[request.category]}</span>
          <span aria-hidden className="text-text-tertiary/60">·</span>
          <time dateTime={request.createdAt}>{formatDateTime(request.createdAt)}</time>
        </p>
      </Link>
    </li>
  )
}
