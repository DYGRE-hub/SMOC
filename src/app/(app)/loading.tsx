/**
 * 탭을 누른 순간 바로 나오는 뼈대.
 *
 * 모든 화면이 Supabase 를 거치므로, 휴대폰에서는 탭을 눌러도 한 박자 뒤에야
 * 그림이 바뀐다. 그 사이 이전 화면이 그대로 멈춰 있으면 눌린 건지 아닌지
 * 알 수 없어 사람들은 한 번 더 누른다.
 *
 * 스피너 대신 실제 레이아웃과 같은 자리에 회색 줄을 둔다.
 * 내용이 도착하면 줄이 글자로 바뀌는 것처럼 보여 화면이 튀지 않는다.
 */
export default function Loading() {
  return (
    <div className="reading-column py-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">불러오는 중</span>

      <div className="flex flex-col gap-3">
        <Bar className="h-3 w-24" />
        <Bar className="h-8 w-56" />
      </div>

      <ul className="mt-10 flex flex-col gap-8">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex items-start gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <Bar className="h-4 w-[70%]" />
              <Bar className="h-3 w-full" />
              <Bar className="h-3 w-[85%]" />
              <Bar className="mt-1 h-3 w-28" />
            </div>
            <Bar className="h-11 w-[104px] rounded-button" />
          </li>
        ))}
      </ul>
    </div>
  )
}

function Bar({ className = '' }: { className?: string }) {
  // 깜빡이는 애니메이션은 쓰지 않는다. 조용한 방이라는 컨셉과 맞지 않고,
  // 느린 회선에서 오래 깜빡이면 그것대로 거슬린다.
  return <div className={`shrink-0 rounded-[4px] bg-line ${className}`} aria-hidden />
}
