import { Icon } from '@/components/ui/Icon'
import { prayUntilLabel, isOverdue } from '@/lib/format'
import {
  authorLabel,
  CATEGORY_LABEL,
  isUrgentNow,
  STATUS_LABEL,
  type Prayer,
} from '@/lib/domain/types'

/**
 * PRD §9.2 — 화면당 강조 요소는 하나로 제한한다.
 * 그래서 메타 정보는 전부 caption 톤으로 눕히고, 색은 긴급/응답에만 쓴다.
 */

export function StatusLabel({ status }: { status: Prayer['status'] }) {
  if (status === 'answered') {
    return (
      <span className="inline-flex items-center gap-1 text-answered">
        <Icon name="check" size={14} />
        {STATUS_LABEL.answered}
      </span>
    )
  }
  if (status === 'active') return null
  return <span>{STATUS_LABEL[status]}</span>
}

export function UrgentLabel() {
  return (
    <span className="inline-flex items-center gap-1 text-urgent">
      <Icon name="alert" size={14} />
      긴급
    </span>
  )
}

export function VisibilityLabel({ visibility }: { visibility: Prayer['visibility'] }) {
  if (visibility !== 'leaders_only') return null
  return (
    <span className="inline-flex items-center gap-1">
      <Icon name="lock" size={14} />
      리더 전용
    </span>
  )
}

export function PrayUntilLabel({ date }: { date: string }) {
  const overdue = isOverdue(date)
  return (
    <span className={`inline-flex items-center gap-1 ${overdue ? 'text-urgent' : ''}`}>
      <Icon name="clock" size={14} />
      {prayUntilLabel(date)}
    </span>
  )
}

/**
 * 목록·카드 하단에 공통으로 깔리는 한 줄. 구분자는 가운뎃점.
 *
 * 순서는 "누구를 위한 기도인가"가 먼저다. 대신 올려주는 경우가 많아서,
 * 읽는 사람에게는 올린 사람보다 대상자가 먼저 필요하다.
 */
export function MetaLine({
  prayer,
  extra,
}: {
  prayer: Prayer
  extra?: React.ReactNode
}) {
  const parts: React.ReactNode[] = []

  // 응답된 건에는 긴급을 붙이지 않는다. 답이 온 소식과 급하다는 표시가
  // 한 줄에 나란히 있으면 어느 쪽을 믿어야 할지 알 수 없다.
  const urgent = isUrgentNow(prayer)
  if (urgent) parts.push(<UrgentLabel key="urgent" />)

  if (prayer.subject) {
    parts.push(
      <span key="subject" className="text-text-secondary">
        {prayer.subject}
      </span>,
    )
  }

  // 올린 사람은 있을 때만. 리스트에서 가져온 건에는 올린 사람이 없다.
  const author = authorLabel(prayer)
  if (author) {
    parts.push(
      <span key="author" className={prayer.authorMode === 'anonymous' ? 'text-text-tertiary' : undefined}>
        {prayer.subject ? `${author} 올림` : author}
      </span>,
    )
  }

  // 긴급으로 올리면 카테고리도 '긴급'이 된다. 배지와 겹치니 한 번만 말하고,
  // 응답되어 배지가 내려간 뒤에도 카테고리만 남겨 두지 않는다 — 이미 답이 온
  // 기도에 '긴급'이라고 적혀 있으면 읽는 사람이 두 번 헷갈린다.
  if (!(prayer.urgency && prayer.category === 'urgent')) {
    parts.push(<span key="cat">{CATEGORY_LABEL[prayer.category]}</span>)
  }

  if (prayer.prayUntil) parts.push(<PrayUntilLabel key="until" date={prayer.prayUntil} />)
  if (prayer.status !== 'active') {
    parts.push(<StatusLabel key="status" status={prayer.status} />)
  }
  if (prayer.visibility === 'leaders_only') {
    parts.push(<VisibilityLabel key="vis" visibility={prayer.visibility} />)
  }
  if (extra) parts.push(<span key="extra">{extra}</span>)

  return (
    <p className="type-caption flex flex-wrap items-center gap-x-2 gap-y-1">
      {parts.map((part, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 ? <span aria-hidden className="text-text-tertiary/60">·</span> : null}
          {part}
        </span>
      ))}
    </p>
  )
}
