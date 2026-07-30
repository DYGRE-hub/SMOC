import Link from 'next/link'

import { Icon } from '@/components/ui/Icon'
import { APP_NAME } from '@/lib/env'
import type { User } from '@/lib/domain/types'

/**
 * 헤더는 최대한 물러서 있어야 한다.
 * 주요 이동은 하단 탭이 맡고, 여기에는 자주 쓰지 않는 경로만 둔다.
 */
export function AppHeader({ user }: { user: User }) {
  return (
    <header className="border-b border-line">
      <div className="reading-column flex h-14 items-center justify-between">
        <Link
          href="/"
          className="text-[17px] font-semibold tracking-[-0.01em] text-text"
          aria-label={`${APP_NAME} 홈`}
        >
          {APP_NAME}
        </Link>

        <nav className="flex items-center gap-1" aria-label="보조 메뉴">
          <HeaderLink href="/archive">응답</HeaderLink>
          {/* 관리 화면은 관리자로 지정된 사용자에게만 보인다. */}
          {user.role === 'admin' ? <HeaderLink href="/admin">관리</HeaderLink> : null}
          <Link
            href="/settings"
            aria-label="설정"
            className="flex h-11 w-11 items-center justify-center rounded-button text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text"
          >
            <Icon name="settings" size={20} />
          </Link>
        </nav>
      </div>
    </header>
  )
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex h-11 items-center rounded-button px-3 text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text"
    >
      {children}
    </Link>
  )
}
