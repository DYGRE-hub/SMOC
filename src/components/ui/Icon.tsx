/**
 * PRD §9.2 — 아이콘은 1.5px 스트로크 라인으로 통일한다.
 * 외부 아이콘 패키지를 쓰지 않는 이유는 번들 예산(120KB) 때문이다.
 */

export type IconName =
  | 'check'
  | 'hands'
  | 'list'
  | 'search'
  | 'clock'
  | 'lock'
  | 'alert'
  | 'arrow-left'
  | 'arrow-right'
  | 'plus'
  | 'settings'
  | 'download'
  | 'comment'
  | 'arrow-up'
  | 'image'
  | 'x'

const PATHS: Record<IconName, React.ReactNode> = {
  check: <polyline points="4 12.5 9 17.5 20 6.5" />,
  hands: (
    <>
      <path d="M12 20c-3.5 0-6.5-2.6-6.5-6.2V7.6a1.6 1.6 0 0 1 3.2 0v3.1" />
      <path d="M12 20c3.5 0 6.5-2.6 6.5-6.2V7.6a1.6 1.6 0 0 0-3.2 0v3.1" />
      <path d="M8.7 10.7V5.6a1.6 1.6 0 0 1 3.3 0v5" />
      <path d="M15.3 10.7V5.6a1.6 1.6 0 0 0-3.3 0" />
    </>
  ),
  list: (
    <>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <line x1="16" y1="16" x2="20.5" y2="20.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <polyline points="12 7 12 12 15.5 14" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <line x1="12" y1="7.5" x2="12" y2="13" />
      <line x1="12" y1="16.2" x2="12" y2="16.3" />
    </>
  ),
  'arrow-left': (
    <>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="11 6 5 12 11 18" />
    </>
  ),
  'arrow-right': (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  // 톱니바퀴는 1.5px 스트로크로 그리면 뭉개지고, 원+빛살 형태는 해처럼 읽힌다.
  // 슬라이더 형태가 이 크기에서 가장 오해 없이 '설정'으로 읽힌다.
  settings: (
    <>
      <line x1="4" y1="8" x2="20" y2="8" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="14.5" cy="8" r="2.2" />
      <circle cx="9.5" cy="16" r="2.2" />
    </>
  ),
  'arrow-up': (
    <>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="6 11 12 5 18 11" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4.5 17.5 9.6 12.9a1.6 1.6 0 0 1 2.2 0L16 17" />
      <path d="m14 15.2 1.9-1.7a1.6 1.6 0 0 1 2.2 0l1.4 1.3" />
    </>
  ),
  x: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  comment: (
    <>
      <path d="M20.5 12.2c0 3.9-3.8 7-8.5 7-1 0-2-.15-2.9-.42L4 20.5l1.5-3.4A6.6 6.6 0 0 1 3.5 12.2c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z" />
    </>
  ),
  download: (
    <>
      <line x1="12" y1="4" x2="12" y2="15" />
      <polyline points="7.5 10.5 12 15 16.5 10.5" />
      <path d="M4.5 18.5v1a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-1" />
    </>
  ),
}

interface IconProps {
  name: IconName
  size?: number
  className?: string
  /** 의미를 갖는 아이콘이면 라벨을 준다. 없으면 장식으로 간주해 숨긴다. */
  label?: string
}

export function Icon({ name, size = 20, className, label }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
