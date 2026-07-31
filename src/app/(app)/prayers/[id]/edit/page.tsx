import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { EditPrayerForm } from '@/app/(app)/prayers/[id]/edit/EditPrayerForm'
import { Icon } from '@/components/ui/Icon'
import { getCurrentUser } from '@/lib/auth/session'
import { getRepository } from '@/lib/db'
import { AUTHOR_MODE_LABEL, isLeader } from '@/lib/domain/types'

export const metadata = { title: '기도제목 수정' }
export const dynamic = 'force-dynamic'

/**
 * 기도제목 수정 화면.
 *
 * 상세 안에서 인라인으로 고치게 하지 않고 화면을 따로 둔 이유는 고칠 것이 많아서다.
 * 제목·내용·대상자·카테고리·공개범위·마감일을 한 자리에서 보고 바꾸는 편이 낫다.
 */
export default async function EditPrayerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const viewer = await getCurrentUser()
  if (!viewer) redirect('/login')

  const { id } = await params
  const repo = await getRepository()
  const detail = await repo.getPrayer(viewer, id)
  if (!detail) notFound()

  const { prayer } = detail
  const canEdit = isLeader(viewer.role) || prayer.authorIdPublic === viewer.id
  // 권한이 없으면 상세로 돌려보낸다. 서버 액션에서 한 번 더 막지만,
  // 고칠 수 없는 화면을 보여주는 것 자체가 불친절하다.
  if (!canEdit) redirect(`/prayers/${id}`)

  return (
    <div className="reading-column enter-rise py-6">
      <Link
        href={`/prayers/${id}`}
        className="inline-flex h-11 items-center gap-1.5 text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text active:opacity-70"
      >
        <Icon name="arrow-left" size={17} />
        돌아가기
      </Link>

      <h1 className="type-title mt-4 text-text">기도제목 수정</h1>
      <p className="type-caption mt-2">
        {AUTHOR_MODE_LABEL[prayer.authorMode]}으로 올린 글입니다. 이름 표기는 바꿀 수 없습니다.
        {prayer.revisionCount > 0 ? ` · 지금까지 ${prayer.revisionCount}회 수정됨` : ''}
      </p>

      <div className="mt-8">
        <EditPrayerForm prayer={prayer} canChooseGroup={viewer.groupId !== null} />
      </div>
    </div>
  )
}
