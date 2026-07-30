import 'server-only'

import {
  hashPassword,
  roleForNewAccount,
  type AccountRecord,
  type AccountStore,
} from '@/lib/db/accounts'
import { newId, persist, state } from '@/lib/db/local-store'

/** 로컬 파일 저장소 위의 계정 구현. 개발 중에만 쓴다. */
export const localAccountStore: AccountStore = {
  async findByEmail(email) {
    const normalized = email.trim().toLowerCase()
    return state().accounts.find((a) => a.email === normalized) ?? null
  },

  async findById(id) {
    return state().accounts.find((a) => a.id === id) ?? null
  },

  async displayNameTaken(displayName, exceptId) {
    const normalized = displayName.trim().toLowerCase()
    return state().accounts.some(
      (a) => a.id !== exceptId && a.displayName.trim().toLowerCase() === normalized,
    )
  },

  async count() {
    return state().accounts.length
  },

  async create(input) {
    const s = state()
    const { passwordHash, passwordSalt } = hashPassword(input.password)

    const account: AccountRecord = {
      id: newId('u'),
      email: input.email.trim().toLowerCase(),
      passwordHash,
      passwordSalt,
      name: input.name.trim(),
      displayName: input.displayName.trim(),
      role: roleForNewAccount(s.accounts.length),
      churchId: 'smoc',
      groupId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    }

    s.accounts.push(account)
    persist()
    return account
  },

  async update(id, patch) {
    const account = state().accounts.find((a) => a.id === id)
    if (!account) return
    Object.assign(account, patch)
    persist()
  },

  async touch(id) {
    const account = state().accounts.find((a) => a.id === id)
    if (!account) return
    // 접속 시각만으로 매번 파일을 쓰지는 않는다. 다음 쓰기에 묻어간다.
    account.lastActiveAt = new Date().toISOString()
  },
}
