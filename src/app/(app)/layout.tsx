import { redirect } from 'next/navigation'

import { AppHeader } from '@/components/AppHeader'
import { TabBar } from '@/components/TabBar'
import { getCurrentUser } from '@/lib/auth/session'
import { getRepository } from '@/lib/db'
import { isLeader } from '@/lib/domain/types'

/**
 * 로그인한 사람만 들어오는 구역.
 * 기도제목은 민감정보이므로, 인증 확인을 각 페이지에 맡기지 않고
 * 레이아웃에서 한 번에 막는다. 페이지 하나를 새로 만들다 빠뜨릴 여지를 없앤다.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // 리더에게만 세어 준다. 나머지 사람에게는 질의조차 하지 않는다 —
  // 모든 화면이 지나는 자리라 한 번의 왕복도 가볍지 않다.
  const pendingRequests = isLeader(user.role)
    ? await (await getRepository()).countPendingRequests(user)
    : 0

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader user={user} pendingRequests={pendingRequests} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <TabBar />
    </div>
  )
}
