'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Icon, type IconName } from '@/components/ui/Icon'

const TABS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: '/', label: '오늘', icon: 'hands', match: (p) => p === '/' },
  {
    href: '/prayers',
    label: '목록',
    icon: 'list',
    match: (p) => p.startsWith('/prayers'),
  },
  { href: '/new', label: '올리기', icon: 'plus', match: (p) => p.startsWith('/new') },
  {
    href: '/tracker',
    label: '트래커',
    icon: 'check',
    match: (p) => p.startsWith('/tracker'),
  },
]

/**
 * 하단 탭.
 *
 * 소셜 미디어처럼 뱃지를 붙이거나 색을 쓰지 않는다. 활성 탭만 본문 색으로
 * 올라오고 나머지는 물러나 있다 — 화면당 강조 요소는 하나(PRD §9.2).
 */
export function TabBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="주요 화면"
      className="sticky bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur-sm"
    >
      <ul className="reading-column flex items-stretch justify-between">
        {TABS.map((tab) => {
          const active = tab.match(pathname)
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex h-16 flex-col items-center justify-center gap-1',
                  'transition-colors duration-200 ease-[var(--ease-quiet)]',
                  active ? 'text-text' : 'text-text-tertiary hover:text-text-secondary',
                ].join(' ')}
              >
                <Icon name={tab.icon} size={20} />
                <span className="text-[11px] leading-none tracking-[-0.01em]">{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
