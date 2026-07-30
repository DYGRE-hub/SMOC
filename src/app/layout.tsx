import type { Metadata, Viewport } from 'next'

import './globals.css'
import { PreferencesScript } from '@/components/ui/PreferencesScript'
import { APP_NAME, APP_TAGLINE } from '@/lib/env'

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    '흘러가는 기도제목을 남는 기록으로. 익명으로 요청하고, 함께 기도하고, 응답을 나누는 조용한 방.',
  // 기도제목은 민감정보다. 검색엔진에 노출될 일이 없어야 한다(PRD §8).
  robots: { index: false, follow: false },
  applicationName: APP_NAME,
}

export const viewport: Viewport = {
  themeColor: '#FCFCFA',
  width: 'device-width',
  initialScale: 1,
  // 노치·홈 인디케이터 영역까지 그리고, 여백은 CSS 의 safe-area 로 직접 잡는다.
  viewportFit: 'cover',
  // 확대를 막지 않는다 — 고령 사용자에게 필요한 마지막 수단이다.
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <PreferencesScript />
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only-focusable absolute left-4 top-4 z-50 rounded-button bg-accent px-4 py-3 text-white"
        >
          본문으로 건너뛰기
        </a>
        {children}
      </body>
    </html>
  )
}
