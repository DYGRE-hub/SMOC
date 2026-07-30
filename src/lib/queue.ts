import type { PrayerWithEngagement } from '@/lib/domain/types'
import { dateKey, daysUntil } from '@/lib/timezone'

/**
 * PRD §4.3 — 오늘의 기도 큐 랭킹.
 *
 * 가중치를 두는 축은 네 가지다.
 *   1. 최근 기도받은 횟수가 적은 제목  → 방치된 요청이 저절로 앞으로 나온다
 *   2. 긴급 표시된 제목
 *   3. 마감일이 임박한 제목
 *
 * 같은 사용자가 같은 날 새로고침해도 순서가 흔들리지 않아야 하므로,
 * 동점 처리에 (userId + 날짜 + prayerId) 해시를 쓴다. 무작위지만 하루 동안은 고정이다.
 */

const QUEUE_MIN = 5
const QUEUE_MAX = 7

export interface QueueOptions {
  /**
   * 오늘 이미 기도한 제목을 뒤로 밀지 않는다.
   *
   * 트래커의 체크 목록에 쓴다. 체크할 때마다 순서가 재정렬되면 항목이
   * 눈앞에서 튀어 다녀 어디까지 했는지 놓치게 된다. 미션 목록은 하루 동안
   * 제자리에 있어야 한다.
   */
  ignoreViewerPrayed?: boolean
}

export function scorePrayer(
  item: PrayerWithEngagement,
  now: Date = new Date(),
  options: QueueOptions = {},
): number {
  const { prayer, engagement } = item
  let score = 0

  // 1. 소외 보정 — 최근 7일간 받은 기도가 적을수록 크게 가산한다.
  score += Math.max(0, 12 - engagement.recentCount) * 4

  // 2. 긴급
  if (prayer.urgency) score += 40

  // 3. 마감 임박 — 남은 날짜가 적을수록 급하게. 지난 것은 결과 확인이 필요하니 약하게 유지.
  if (prayer.prayUntil) {
    const daysLeft = daysUntil(prayer.prayUntil, now)
    if (daysLeft >= 0 && daysLeft <= 7) score += (8 - daysLeft) * 6
    else if (daysLeft < 0 && daysLeft >= -3) score += 10
  }

  // 오늘 이미 기도한 제목은 뒤로 밀되 완전히 배제하지는 않는다.
  if (engagement.viewerPrayedToday && !options.ignoreViewerPrayed) score -= 60

  // 오래 묵은 제목이 영원히 묻히지 않도록 아주 약한 나이 가산
  const ageDays = daysBetween(new Date(prayer.createdAt), now)
  score += Math.min(ageDays, 30) * 0.3

  return score
}

export function buildTodayQueue(
  items: PrayerWithEngagement[],
  viewerId: string,
  size = QUEUE_MAX,
  now: Date = new Date(),
  options: QueueOptions = {},
): PrayerWithEngagement[] {
  const seed = `${viewerId}:${dateKey(now)}`
  const limit = clamp(size, QUEUE_MIN, QUEUE_MAX)

  return [...items]
    .map((item) => ({
      item,
      score: scorePrayer(item, now, options),
      jitter: hash(`${seed}:${item.prayer.id}`) % 1000,
    }))
    .sort((a, b) => b.score - a.score || a.jitter - b.jitter)
    .slice(0, limit)
    .map((entry) => entry.item)
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

/** FNV-1a. 암호학적 용도가 아니라 하루 고정 동점 처리에만 쓴다. */
function hash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
