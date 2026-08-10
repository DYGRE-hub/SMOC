import { RequestForm } from '@/app/request/RequestForm'
import { APP_NAME } from '@/lib/env'

export const metadata = { title: '기도 요청' }
export const dynamic = 'force-dynamic'

/**
 * 로그인 없이 열리는 유일한 화면.
 *
 * 중보기도팀 밖의 교인도 기도를 부탁할 수 있어야 한다는 것이 이 화면의 이유다.
 * 대신 여기서 보낸 글은 어디에도 바로 보이지 않는다 — 리더가 읽고 손봐서
 * 목록으로 옮겨야 비로소 기도제목이 된다. 그 사실을 화면에서도 분명히 말한다.
 */
export default function RequestPage() {
  return (
    <main id="main" className="reading-column enter-rise py-14">
      <header className="flex flex-col gap-4">
        <p className="type-caption">{APP_NAME}</p>
        <h1 className="type-display text-text">기도를 부탁드립니다</h1>
        <p className="type-body text-text-secondary">
          수요 중보기도 모임에서 함께 기도합니다. 가입하지 않으셔도 됩니다.
        </p>
        <p className="type-caption">
          보내신 내용은 바로 공개되지 않습니다. 중보기도팀 리더가 확인한 뒤 기도제목으로
          올라갑니다.
        </p>
      </header>

      <div className="mt-12">
        <RequestForm />
      </div>

      <p className="type-caption mt-12 border-t border-line pt-6">
        급하게 도움이 필요한 상황이라면 이 요청을 기다리지 마시고 교회로 바로 연락해
        주세요.
      </p>
    </main>
  )
}
