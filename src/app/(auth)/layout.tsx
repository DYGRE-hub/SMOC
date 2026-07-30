/**
 * 로그인·회원가입 구역. 탭도 헤더도 없다.
 * 들어오는 길에서 시선을 나눌 이유가 없다.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="min-h-dvh">
      {children}
    </main>
  )
}
