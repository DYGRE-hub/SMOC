import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  authorLabel,
  type PrayerWithEngagement,
} from '@/lib/domain/types'
import { formatDate, prayUntilLabel } from '@/lib/format'
import { APP_NAME } from '@/lib/env'

export type ExportFormat = 'bulletin' | 'kakao'

export interface ExportResult {
  text: string
  included: number
  /** PRD §4.6 — 제외된 건수를 명시적으로 보여줘야 한다. */
  excludedAnonymous: number
  excludedLeadersOnly: number
}

/**
 * PRD §4.6 — 리더용 내보내기.
 * 익명 항목과 리더 전용 항목은 자동으로 빠지고, 몇 건이 빠졌는지 함께 알려준다.
 * 리더가 실수로 민감한 건을 주보에 실어버리는 일을 구조적으로 막기 위해서다.
 */
export function buildExport(
  items: PrayerWithEngagement[],
  format: ExportFormat,
  weekLabel: string,
): ExportResult {
  const excludedAnonymous = items.filter(
    ({ prayer }) => prayer.authorMode === 'anonymous',
  ).length
  const excludedLeadersOnly = items.filter(
    ({ prayer }) => prayer.visibility === 'leaders_only',
  ).length

  const eligible = items.filter(
    ({ prayer }) =>
      prayer.authorMode !== 'anonymous' && prayer.visibility !== 'leaders_only',
  )

  const text =
    format === 'bulletin'
      ? renderBulletin(eligible, weekLabel)
      : renderKakao(eligible, weekLabel)

  return {
    text,
    included: eligible.length,
    excludedAnonymous,
    excludedLeadersOnly,
  }
}

function renderBulletin(items: PrayerWithEngagement[], weekLabel: string): string {
  if (items.length === 0) return `${weekLabel} 기도제목\n\n(내보낼 항목이 없습니다)`

  const grouped = new Map<string, PrayerWithEngagement[]>()
  for (const item of items) {
    const key = CATEGORY_LABEL[item.prayer.category]
    const bucket = grouped.get(key)
    if (bucket) bucket.push(item)
    else grouped.set(key, [item])
  }

  const sections = [...grouped.entries()].map(([category, group]) => {
    const lines = group.map(({ prayer }) => {
      // 주보에는 대상자 이름이 먼저다. 없으면 올린 사람으로 대신한다.
      const who = prayer.subject ?? authorLabel(prayer) ?? ''
      const until = prayer.prayUntil ? ` (${prayUntilLabel(prayer.prayUntil)})` : ''
      const status = prayer.status === 'active' ? '' : ` [${STATUS_LABEL[prayer.status]}]`
      const name = who ? `${who} — ` : ''
      return `  · ${name}${prayer.title}${until}${status}`
    })
    return `[${category}]\n${lines.join('\n')}`
  })

  return `${weekLabel} 기도제목\n\n${sections.join('\n\n')}\n`
}

function renderKakao(items: PrayerWithEngagement[], weekLabel: string): string {
  if (items.length === 0) return `${weekLabel} 함께 기도해 주세요\n\n(내보낼 항목이 없습니다)`

  const lines = items.map(({ prayer }, i) => {
    const who = prayer.subject ?? authorLabel(prayer)
    const until = prayer.prayUntil ? `\n   ~ ${prayUntilLabel(prayer.prayUntil)}` : ''
    const meta = who ? `${who} · ${CATEGORY_LABEL[prayer.category]}` : CATEGORY_LABEL[prayer.category]
    return `${i + 1}. ${prayer.title}\n   ${meta}${until}`
  })

  return [
    `🙏 ${weekLabel} 함께 기도해 주세요`,
    '',
    lines.join('\n'),
    '',
    `전체 목록과 업데이트는 ${APP_NAME}에서 확인하실 수 있어요.`,
  ].join('\n')
}

export function weekLabel(now: Date = new Date()): string {
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return `${formatDate(monday.toISOString())} – ${formatDate(sunday.toISOString())}`
}
