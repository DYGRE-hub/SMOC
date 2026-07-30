import { redirect } from 'next/navigation'

import { ExportPanel } from '@/app/(app)/leader/export/ExportPanel'
import { getCurrentUser } from '@/lib/auth/session'
import { getRepository } from '@/lib/db'
import { buildExport, weekLabel } from '@/lib/export'
import { isLeader } from '@/lib/domain/types'

export const metadata = { title: '내보내기' }
export const dynamic = 'force-dynamic'

/**
 * PRD §4.6 — 리더가 이번 주 기도제목을 한 번에 밖으로 꺼내는 화면.
 * 1단계에서는 텍스트 두 종(주보용·카카오톡용)만 지원한다.
 */
export default async function ExportPage() {
  const viewer = await getCurrentUser()
  if (!viewer) redirect('/login')
  if (!isLeader(viewer.role)) redirect('/')

  const repo = await getRepository()
  const all = await repo.listPrayers(viewer)

  // 이번 주에 올라왔거나 업데이트된 건만 추린다.
  const weekAgo = Date.now() - 7 * 86_400_000
  const thisWeek = all.filter(
    ({ prayer }) =>
      new Date(prayer.updatedAt).getTime() >= weekAgo &&
      prayer.status !== 'closed' &&
      prayer.status !== 'paused',
  )

  const label = weekLabel()
  const bulletin = buildExport(thisWeek, 'bulletin', label)
  const kakao = buildExport(thisWeek, 'kakao', label)

  return (
    <div className="reading-column enter-rise py-10">
      <h1 className="type-title text-text">이번 주 기도제목 내보내기</h1>
      <p className="type-caption mt-2">{label}</p>

      <div className="mt-8">
        <ExportPanel bulletin={bulletin} kakao={kakao} />
      </div>
    </div>
  )
}
