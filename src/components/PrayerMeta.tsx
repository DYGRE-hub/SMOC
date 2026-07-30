import { Icon } from '@/components/ui/Icon'
import { prayUntilLabel, isOverdue } from '@/lib/format'
import {
  CATEGORY_LABEL,
  displayAuthor,
  STATUS_LABEL,
  type Prayer,
} from '@/lib/domain/types'

/**
 * PRD §9.2 — 화면당 강조 요소는 하나로 제한한다.
 * 그래서 메타 정보는 전부 caption 톤으로 눕히고, 색은 긴급/응답에만 쓴다.
 */

export function AuthorLabel({ prayer }: { prayer: Prayer }) {
  const name = displayAuthor(prayer.authorMode, prayer.authorDisplayName)
  const anonymous = prayer.authorMode === 'anonymous'
  return (
    <span className={anonymous ? 'text-text-tertiary' : undefined}>{name}</span>
  )
}

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

/** 목록·카드 하단에 공통으로 깔리는 한 줄. 구분자는 가운뎃점. */
export function MetaLine({
  prayer,
  extra,
}: {
  prayer: Prayer
  extra?: React.ReactNode
}) {
  const parts: React.ReactNode[] = []
  if (prayer.urgency) parts.push(<UrgentLabel key="urgent" />)
  parts.push(<AuthorLabel key="author" prayer={prayer} />)
  // 긴급 건은 카테고리도 '긴급'이라 배지와 겹친다. 한 번만 말한다.
  if (!(prayer.urgency && prayer.category === 'urgent')) {
    parts.push(<span key="cat">{CATEGORY_LABEL[prayer.category]}</span>)
  }
  if (prayer.prayUntil) parts.push(<PrayUntilLabel key="until" date={prayer.prayUntil} />)
  const status = <StatusLabel key="status" status={prayer.status} />
  if (prayer.status !== 'active') parts.push(status)
  if (prayer.visibility === 'leaders_only')
    parts.push(<VisibilityLabel key="vis" visibility={prayer.visibility} />)
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
