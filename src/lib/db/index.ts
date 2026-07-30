import 'server-only'

import { isPostgresConfigured } from '@/lib/db/pg/client'
import type { AccountStore } from '@/lib/db/accounts'
import type { Repository } from '@/lib/db/repository'

/**
 * DATABASE_URL 이 있으면 Postgres, 없으면 로컬 파일 저장소.
 *
 * 배포 환경에는 반드시 DATABASE_URL 이 있어야 한다. 파일 저장소는 서버리스에서
 * 매 인스턴스마다 초기화되므로 계정이 사라진다.
 * 개발 중에는 DB 없이도 앱을 띄울 수 있도록 파일 저장소를 남겨 둔다.
 */

export async function getRepository(): Promise<Repository> {
  if (isPostgresConfigured()) {
    const { pgRepository } = await import('@/lib/db/pg/repo')
    return pgRepository
  }
  const { localRepository } = await import('@/lib/db/local-repo')
  return localRepository
}

export async function getAccountStore(): Promise<AccountStore> {
  if (isPostgresConfigured()) {
    const { pgAccountStore } = await import('@/lib/db/pg/accounts')
    return pgAccountStore
  }
  const { localAccountStore } = await import('@/lib/db/local-accounts')
  return localAccountStore
}
