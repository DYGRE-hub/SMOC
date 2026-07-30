import postgres from 'postgres'

/**
 * 스크립트용 Postgres 연결. 앱의 src/lib/db/pg/client.ts 와 같은 규칙을 쓴다.
 *
 * 풀러(Supabase 6543, Neon pooler)는 커넥션을 쿼리 단위로 돌려쓰기 때문에
 * prepared statement 를 쓸 수 없다. 켜 둔 채로 두면 실행 중에 터진다.
 */
export function connect(url) {
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1')
  const isPooler = url.includes(':6543') || url.includes('pooler.supabase.com')

  return postgres(url, {
    max: 1,
    prepare: !isPooler,
    ssl: isLocal ? false : 'require',
    connect_timeout: 30,
  })
}
