import 'server-only'

import { state } from '@/lib/db/local-store'

/** 아직 아무도 가입하지 않았는지. 첫 가입자는 관리자가 된다. */
export async function hasAnyAccount(): Promise<boolean> {
  return state().accounts.length > 0
}
