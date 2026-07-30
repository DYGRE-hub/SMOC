import { setRoleAction } from '@/lib/actions/admin'
import { ROLES, ROLE_LABEL, type User } from '@/lib/domain/types'

/**
 * 멤버 관리 — 관리자만 본다.
 * 실명은 여기서만 노출된다. 다른 화면은 전부 표시 ID를 쓴다.
 */
export function MemberList({
  members,
  currentUserId,
}: {
  members: User[]
  currentUserId: string
}) {
  return (
    <ul className="border-t border-line">
      {members.map((member) => {
        const isSelf = member.id === currentUserId
        return (
          <li
            key={member.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-4"
          >
            <div className="min-w-0">
              <p className="text-[15px] text-text">
                {member.displayName}
                {isSelf ? <span className="type-caption"> · 나</span> : null}
              </p>
              <p className="type-caption truncate">
                {member.name} · {member.email ?? '이메일 없음'}
              </p>
            </div>

            <form action={setRoleAction} className="flex items-center gap-2">
              <input type="hidden" name="userId" value={member.id} />
              <label htmlFor={`role-${member.id}`} className="sr-only">
                {member.displayName}의 역할
              </label>
              <select
                id={`role-${member.id}`}
                name="role"
                defaultValue={member.role}
                disabled={isSelf}
                className="h-11 rounded-[10px] border border-line bg-surface px-2.5 text-[14px] text-text outline-none disabled:opacity-50"
              >
                {ROLES.filter((r) => r !== 'guest').map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isSelf}
                className="h-11 rounded-[10px] border border-line px-3 text-[13px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text disabled:opacity-40"
              >
                변경
              </button>
            </form>
          </li>
        )
      })}
    </ul>
  )
}
