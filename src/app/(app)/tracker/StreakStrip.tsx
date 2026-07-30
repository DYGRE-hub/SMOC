import type { TrackerDay } from '@/lib/db/repository'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/**
 * dateKey 는 이미 KST 기준 달력 날짜다.
 * 정오 UTC 로 읽어야 타임존 때문에 하루가 밀리지 않는다.
 */
function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay()
}

/**
 * 최근 2주 기록.
 *
 * 잔디밭처럼 촘촘한 격자 대신 얇은 막대 14개만 둔다.
 * 기록이 비어 있는 날을 크게 보여주면 죄책감을 주는 장치가 되어버린다.
 */
export function StreakStrip({ history }: { history: TrackerDay[] }) {
  const max = Math.max(1, ...history.map((d) => d.count))

  return (
    <div>
      <ol className="flex items-end gap-[6px]" aria-label="최근 14일 기도 기록">
        {history.map((day, i) => {
          const ratio = day.count / max
          const height = day.count === 0 ? 3 : Math.max(6, Math.round(ratio * 40))
          const isToday = i === history.length - 1
          return (
            <li key={day.dateKey} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                title={`${day.dateKey} · ${day.count}회`}
                className={[
                  'w-full rounded-[2px]',
                  day.count === 0
                    ? 'bg-line'
                    : day.complete
                      ? 'bg-accent'
                      : 'bg-accent/45',
                ].join(' ')}
                style={{ height: `${height}px` }}
              />
              <span
                className={`text-[10px] leading-none ${isToday ? 'text-text-secondary' : 'text-text-tertiary'}`}
              >
                {WEEKDAY[weekdayOf(day.dateKey)]}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="type-caption mt-3">
        진한 막대는 그날의 미션을 다 채운 날입니다.
      </p>
    </div>
  )
}
