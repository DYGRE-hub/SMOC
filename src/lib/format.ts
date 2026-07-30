const KST = 'Asia/Seoul'

const dateFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KST,
  month: 'long',
  day: 'numeric',
})

const dateTimeFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KST,
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const fullDateFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KST,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso))
}

export function formatFullDate(d: Date = new Date()): string {
  return fullDateFmt.format(d)
}

/** "방금", "3시간 전", "6일 전", 그 이상은 날짜로 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return formatDate(iso)
}

/**
 * "언제까지 기도해 주세요" 마감 표시.
 * 지난 날짜는 결과 확인이 필요한 상태이므로 다르게 말한다(PRD §4.1).
 */
export function prayUntilLabel(dateStr: string, now: Date = new Date()): string {
  const target = new Date(`${dateStr}T00:00:00+09:00`)
  const today = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: KST }).format(now)}T00:00:00+09:00`)
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000)

  if (days === 0) return '오늘까지'
  if (days === 1) return '내일까지'
  if (days > 1) return `${days}일 남음`
  if (days === -1) return '어제 지났습니다'
  return `${Math.abs(days)}일 지났습니다`
}

export function isOverdue(dateStr: string, now: Date = new Date()): boolean {
  const target = new Date(`${dateStr}T00:00:00+09:00`)
  const today = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: KST }).format(now)}T00:00:00+09:00`)
  return target.getTime() < today.getTime()
}
