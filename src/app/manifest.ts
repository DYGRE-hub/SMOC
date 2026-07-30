import type { MetadataRoute } from 'next'

import { APP_NAME, APP_TAGLINE } from '@/lib/env'

/**
 * 홈 화면에 추가해 쓰기 위한 최소 설정.
 *
 * 매일 여는 앱이라 브라우저 주소창을 거치지 않고 바로 들어갈 수 있어야 한다.
 * standalone 으로 띄우면 주소창이 사라져 화면도 그만큼 넓어진다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — ${APP_TAGLINE}`,
    short_name: APP_NAME,
    description: '흘러가는 기도제목을 남는 기록으로.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FCFCFA',
    theme_color: '#FCFCFA',
    lang: 'ko',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
