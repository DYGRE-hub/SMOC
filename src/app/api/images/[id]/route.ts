import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { getRepository } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * 나눔에 붙은 사진을 내준다.
 *
 * 사진을 바깥 저장소에 두고 공개 주소를 쓰지 않는 이유가 여기 있다.
 * 그 방식이면 주소를 아는 사람은 로그인 없이도 열 수 있는데, 여기 올라오는
 * 사진은 병상이나 가족의 모습일 수 있다. 그래서 매번 이 문을 지나게 하고,
 * 문 앞에서 로그인과 열람 권한을 함께 본다.
 *
 * 캐시는 private 으로 둔다. 중간 서버가 대신 들고 있다가 다른 사람에게
 * 건네주는 일이 없어야 한다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getCurrentUser()
  if (!viewer) return new NextResponse('로그인이 필요합니다.', { status: 401 })

  const { id } = await params
  const repo = await getRepository()
  const image = await repo.getUpdateImage(viewer, id)

  // 없는 사진과 볼 수 없는 사진을 구분해 주지 않는다.
  // 구분해 주면 어떤 사진이 있는지 없는지를 밖에서 헤아릴 수 있다.
  if (!image) return new NextResponse('찾을 수 없습니다.', { status: 404 })

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      'Content-Type': image.mime,
      'Content-Length': String(image.data.byteLength),
      'Cache-Control': 'private, max-age=86400, immutable',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
