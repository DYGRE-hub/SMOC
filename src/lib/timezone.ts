/**
 * 이 앱의 기준 시간대.
 *
 * 산타모니카 온누리 교회를 위한 앱이므로 미국 서부를 기준으로 한다.
 * "오늘 기도했는지"의 하루 경계, 마감일까지 남은 날짜, 화면에 찍히는 날짜가
 * 전부 이 값을 따른다.
 *
 * 다른 지역 교회로 옮길 때는 이 상수 하나만 바꾸면 된다.
 */
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE ?? 'America/Los_Angeles'

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * 기준 시간대의 달력 날짜 'YYYY-MM-DD'.
 *
 * 하루 1회 제한과 트래커의 하루 경계가 이 값으로 정해진다.
 * 고정 오프셋(+09:00 같은 것)을 쓰지 않는 이유는 서머타임 때문이다 —
 * 미국 서부는 3월과 11월에 오프셋이 바뀌므로 Intl 에 맡겨야 한다.
 */
export function dateKey(d: Date = new Date()): string {
  return dateKeyFormatter.format(d)
}

/** 'YYYY-MM-DD' 두 개 사이의 날짜 수. 시각은 보지 않고 달력 날짜만 센다. */
export function daysBetweenKeys(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

/** 오늘로부터 해당 날짜까지 남은 날. 지났으면 음수. */
export function daysUntil(dateStr: string, now: Date = new Date()): number {
  return daysBetweenKeys(dateKey(now), dateStr)
}

/** n일 전(또는 후)의 날짜 키. */
export function shiftKey(days: number, from: Date = new Date()): string {
  return dateKey(new Date(from.getTime() + days * 86_400_000))
}
