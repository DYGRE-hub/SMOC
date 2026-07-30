import { redirect } from 'next/navigation'

import { ComposeForm } from '@/app/(app)/new/ComposeForm'
import { getCurrentUser } from '@/lib/auth/session'

export const metadata = { title: '기도제목 올리기' }
export const dynamic = 'force-dynamic'

/**
 * PRD §4.1 — 한 화면, 세 번의 탭 안에서 끝나야 한다.
 * 필수 결정은 두 가지뿐이다. 이름을 밝힐지, 누구에게 보일지.
 */
export default async function NewPrayerPage() {
  const viewer = await getCurrentUser()
  if (!viewer) redirect('/login')

  return (
    <div className="reading-column enter-rise py-10">
      <h1 className="type-title text-text">기도제목 올리기</h1>
      <p className="type-caption mt-2">
        지금 표시 ID는 &lsquo;{viewer.displayName}&rsquo;입니다. 이름을 밝히고 싶지 않다면 아래에서
        익명을 고르세요.
      </p>

      <div className="mt-8">
        <ComposeForm canChooseGroup={viewer.groupId !== null} />
      </div>
    </div>
  )
}
