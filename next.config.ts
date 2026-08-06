import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 상위 디렉터리의 다른 lockfile 을 워크스페이스 루트로 오인하지 않도록 고정한다.
  turbopack: { root: import.meta.dirname },
  // PRD §10 — 홈 초기 JS 번들 120KB(gzip) 이하. 번들이 늘어나면 `next build` 출력에서 확인한다.
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js'],
    serverActions: {
      // 나눔에 붙는 사진이 서버 액션에 실려 온다. 기본 1MB 로는 사진 한 장이 걸린다.
      // 브라우저에서 긴 변 1600px 로 줄여 보내므로 보통 한 장에 수백 KB다.
      bodySizeLimit: '4mb',
    },
  },
}

export default nextConfig
