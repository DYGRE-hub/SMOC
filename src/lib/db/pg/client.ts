import 'server-only'

import postgres from 'postgres'

/**
 * Postgres 연결.
 *
 * Vercel 의 서버리스 함수는 요청마다 새로 깨어날 수 있으므로 연결 수를 작게 잡고,
 * 커넥션 풀러(Neon pooler, Supabase 6543 포트)를 쓰는 것을 전제로 한다.
 * 모듈 수준에 하나만 두어 같은 인스턴스가 재사용되게 한다.
 */

const globalRef = globalThis as unknown as { __smocSql?: postgres.Sql }

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

export function sql(): postgres.Sql {
  if (globalRef.__smocSql) return globalRef.__smocSql

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL 이 설정되지 않았습니다. Postgres 를 쓰려면 환경변수를 채워 주세요.',
    )
  }

  const isLocal = url.includes('localhost') || url.includes('127.0.0.1')

  /**
   * Supabase 의 트랜잭션 풀러(6543)와 Neon 의 풀러는 커넥션을 쿼리 단위로 돌려쓴다.
   * 그래서 세션에 매여 있는 prepared statement 를 쓸 수 없다 —
   * 켜 둔 채로 두면 "prepared statement already exists" 로 터진다.
   */
  const isTransactionPooler = url.includes(':6543') || url.includes('pooler.supabase.com')

  globalRef.__smocSql = postgres(url, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: !isTransactionPooler,
    // 관리형 Postgres 는 TLS 를 요구한다.
    ssl: isLocal ? false : 'require',
    // 날짜(date) 컬럼은 달력 날짜다. Date 객체로 바꾸면 타임존 때문에 하루가 밀린다.
    types: {
      date: {
        to: 1082,
        from: [1082],
        serialize: (v: string) => v,
        parse: (v: string) => v,
      },
    },
  })

  return globalRef.__smocSql
}
