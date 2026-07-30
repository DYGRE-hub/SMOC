# 배포하기

Supabase(Postgres) + Vercel 로 올린다. 둘 다 24시간 돌아가므로 이 컴퓨터를 꺼도 된다.
처음 한 번은 30분쯤 걸리고, 그 뒤로는 `git push` 만 하면 배포된다.

---

## 1. Supabase 연결 문자열 가져오기

이미 쓰고 계신 Supabase 프로젝트를 그대로 쓴다.

1. [supabase.com/dashboard](https://supabase.com/dashboard) 에서 프로젝트를 연다.
2. 상단의 **Connect** 버튼을 누른다.
3. **Connection string** 탭 → **Transaction pooler** 를 고른다.
4. 나오는 URI 를 복사한다. 이런 모양이다:

```
postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

5. `[YOUR-PASSWORD]` 를 데이터베이스 비밀번호로 바꾼다.
   기억이 안 나면 **Settings → Database → Reset database password** 에서 새로 만든다.

### 왜 Transaction pooler(6543) 인가

Vercel 의 서버리스 함수는 요청마다 새로 깨어나 연결을 연다.
직접 연결(5432)을 쓰면 금세 연결 한도에 걸려 접속이 끊긴다.
트랜잭션 풀러는 커넥션을 쿼리 단위로 돌려쓰기 때문에 이런 환경에 맞는다.

다만 트랜잭션 모드에서는 prepared statement 를 쓸 수 없다. 앱과 스크립트가
연결 문자열을 보고 자동으로 꺼 주므로 따로 설정할 것은 없다
(`src/lib/db/pg/client.ts`, `scripts/pg-connect.mjs`).

## 2. 스키마 적용과 데이터 이전

연결 문자열을 `.env.local` 에 넣는다. 이 파일은 `.gitignore` 에 있어 올라가지 않는다.

```
DATABASE_URL=postgresql://postgres.xxxx:비밀번호@aws-0-리전.pooler.supabase.com:6543/postgres
SESSION_SECRET=아래에서_만든_긴_무작위_문자열
SIGNUP_PASSPHRASE=SMOC
```

`SESSION_SECRET` 은 이렇게 만든다:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

그리고 두 명령을 차례로 실행한다.

```bash
node --env-file=.env.local scripts/db-migrate.mjs        # 테이블 만들기
node --env-file=.env.local scripts/db-seed-from-json.mjs # 지금 데이터 옮기기
```

테이블 목록이 출력되면 성공이다. 여러 번 실행해도 안전하다.
비밀번호는 해시 그대로 옮겨지므로 쓰던 계정으로 그대로 로그인된다.

### Supabase 를 쓸 때 꼭 알아야 할 것

Supabase 는 `public` 스키마의 테이블을 **자동으로 REST API 로 공개**한다.
anon 키는 브라우저에 노출되도록 설계된 공개 키라, 그냥 두면 그 키만 있으면
누구나 기도제목 전체를 읽을 수 있다.

이 앱은 Supabase 의 API 를 전혀 쓰지 않고 Postgres 에 직접 접속한다.
그래서 스키마를 적용할 때 API 쪽 문을 완전히 닫는다:

- 모든 테이블에 RLS 를 켠다 — 정책이 하나도 없으면 아무 행도 나가지 않는다
- `anon`·`authenticated` 역할의 권한을 회수한다

앱이 접속하는 `postgres` 역할은 테이블 소유자라 영향받지 않는다.
적용 후 Table Editor 에서 테이블이 "Unrestricted" 로 표시되지 않으면 제대로 걸린 것이다.

**같은 프로젝트에 다른 앱이 있다면** 테이블 이름이 겹치는지 먼저 확인하시라.
이 앱은 `accounts`, `prayers`, `prayer_author_private`, `prayer_updates`,
`prayer_revisions`, `prayer_engagements`, `daily_missions`, `audit_logs`,
`imports`, `import_drafts` 를 쓴다.
겹치면 Supabase 에 프로젝트를 하나 더 만들어 그쪽을 쓰는 편이 안전하다.

## 3. GitHub 에 올리기

```bash
git init
git add -A
git commit -m "SMOC 기도의 방"
gh repo create smoc-prayer --private --source=. --push
```

**반드시 private 저장소로 만든다.** 실명과 건강 정보가 오가는 앱이다.

`.env.local`, `.data/`, `scripts/data/*.json` 은 `.gitignore` 에 있어 올라가지 않는다.
실제 기도제목 데이터는 Supabase 에만 있다.

## 4. Vercel 배포

1. [vercel.com](https://vercel.com) 에서 New Project → 방금 만든 저장소를 고른다.
2. 프레임워크는 Next.js 로 자동 인식된다. 빌드 설정은 손대지 않는다.
3. **Environment Variables** 에 아래를 넣는다. Production·Preview·Development 모두 체크한다.

| 이름 | 값 |
|---|---|
| `DATABASE_URL` | 1단계의 Transaction pooler 문자열 (비밀번호 채운 것) |
| `SESSION_SECRET` | `.env.local` 에 넣은 것과 **같은 값** |
| `SIGNUP_PASSPHRASE` | `SMOC` |
| `CRON_SECRET` | 또 다른 무작위 문자열 (주간 메일용, 선택) |

`SESSION_SECRET` 은 한 번 정하면 바꾸지 않는다. 바꾸면 모든 사람이 로그아웃된다.

4. Deploy 를 누른다. 2~3분이면 끝난다.

데이터는 이미 2단계에서 Supabase 로 옮겨 두었으므로 **Vercel 로 따로 옮길 것은 없다.**
Vercel 에는 코드만 올라가고, 데이터는 Supabase 에 있으며, 환경변수가 둘을 잇는다.

## 5. 첫 로그인

배포된 주소로 들어가 2단계에서 옮긴 계정으로 로그인한다.
계정을 옮기지 않았다면 `/signup` 에서 가입하면 되고,
**첫 번째로 가입하는 사람이 자동으로 관리자가 된다.**

## 6. 교인들 초대

단톡방에 이렇게 한 번 올리면 된다.

> SMOC 기도의 방을 열었습니다.
> https://여기에-주소
> 가입 문구는 **SMOC** 입니다.
> 이름과 표시 ID를 정하시면 바로 쓰실 수 있어요.

가입 문구를 모르면 가입할 수 없다. 유출이 의심되면 Vercel 에서
`SIGNUP_PASSPHRASE` 만 바꾸고 재배포하면 된다 (기존 회원은 영향 없다).

## 7. 새 기도제목 리스트 넣기

매주 PDF 를 받으면 `scripts/data/` 에 JSON 으로 옮긴 뒤
(형식은 `scripts/data/example.json` 참고):

```bash
node --env-file=.env.local scripts/import-list.mjs scripts/data/2026-07-22.json --close-previous
```

| 옵션 | 언제 |
|---|---|
| (없음) | 그냥 추가만 한다 |
| `--close-previous` | 지난 주 리스트를 '종료'로 내린다. **매주 새 리스트를 올릴 때 이걸 쓴다.** 목록과 오늘의 기도에서 빠지지만 기록과 나눔은 남고, 이미 '응답됨'인 건은 건드리지 않는다 |
| `--replace` | 같은 주 리스트를 고쳐서 다시 넣을 때. 그 주 항목을 지우고 새로 넣으므로 **거기 달린 나눔과 기도 기록도 함께 지워진다** |

`.env.local` 에 운영 `DATABASE_URL` 이 들어 있으므로 이 명령은 운영 데이터를 바꾼다.
`--env-file` 을 빼면 로컬 파일 저장소에 쓴다.

---

## 운영 중 챙길 것

**백업** — Supabase 무료 플랜은 자동 백업 보관 기간이 짧다.
중요한 시점에는 직접 떠 두는 편이 안전하다.

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%F).sql
```

**연결 한도** — 앱은 인스턴스당 최대 3개만 열도록 잡아 두었다
(`src/lib/db/pg/client.ts`). 교인 수백 명 규모까지는 여유가 있다.

**프로젝트 일시정지** — Supabase 무료 플랜은 일정 기간 요청이 전혀 없으면
프로젝트를 재운다. 매주 쓰는 앱이라면 문제되지 않지만, 한동안 비워 둘 예정이면
대시보드에서 깨워야 한다.

**보유 기간** — PRD 상 기본 3년, 종료된 제목은 1년 후 본문 파기다.
아직 자동화되어 있지 않다. 필요해지는 시점에 만들면 된다.

**주간 다이제스트 메일** — `vercel.json` 에 토요일 밤 크론이 걸려 있다.
`RESEND_API_KEY` 가 없으면 실제로 보내지 않고 내용만 만들어 본다.
보내려면 [Resend](https://resend.com) 에서 키를 받아 환경변수에 넣는다.

**도메인** — Vercel 프로젝트 설정에서 교회 도메인을 붙일 수 있다.
`robots` 는 이미 색인 금지로 되어 있어 검색에 뜨지 않는다.

---

## 로컬에서 개발할 때

`DATABASE_URL` 이 비어 있으면 파일 저장소(`.data/`)를 쓰므로 DB 없이도 뜬다.

`.env.local` 에 운영 Supabase 를 넣어 두면 로컬에서도 운영 데이터를 보게 된다.
편리하지만, 시험 삼아 올린 글이 교인들에게도 보인다는 뜻이다.
연습용이 필요하면 Supabase 에 프로젝트를 하나 더 만들어 그쪽을 가리키게 한다.
