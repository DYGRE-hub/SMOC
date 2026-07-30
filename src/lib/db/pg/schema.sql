-- SMOC 기도의 방 — Postgres 스키마
--
-- supabase/migrations/ 의 것과 다른 점: 이 앱은 Supabase Auth 가 아니라 자체 인증을 쓴다.
-- 그래서 auth.uid() 기반 RLS 대신, 애플리케이션이 단일 DB 역할로 접속하고
-- 공개범위 판정은 쿼리에서 한다(src/lib/db/pg/repo.ts 의 visibleClause).
--
-- 적용: node scripts/db-migrate.mjs
-- 여러 번 실행해도 안전하다(IF NOT EXISTS).

create extension if not exists "pgcrypto";

create table if not exists accounts (
  id             text primary key,
  email          text not null unique,
  password_hash  text not null,
  password_salt  text not null,
  name           text not null,
  display_name   text not null,
  role           text not null default 'intercessor'
                 check (role in ('guest', 'intercessor', 'leader', 'admin')),
  church_id      text not null,
  group_id       text,
  created_at     timestamptz not null default now(),
  last_active_at timestamptz
);

-- 표시 ID 는 대소문자를 무시하고 유일해야 한다.
-- 비슷한 이름으로 다른 사람인 척하는 것을 막는다.
create unique index if not exists accounts_display_name_key
  on accounts (church_id, lower(display_name));

create index if not exists accounts_church_idx on accounts (church_id);

create table if not exists prayers (
  id             text primary key,
  church_id      text not null,
  group_id       text,
  title          text not null,
  body           text not null default '',
  category       text not null default 'church',
  urgency        boolean not null default false,
  visibility     text not null default 'public'
                 check (visibility in ('public', 'group', 'leaders_only')),
  author_mode    text not null default 'named'
                 check (author_mode in ('named', 'initials', 'anonymous')),

  -- 익명 요청에서는 두 컬럼 모두 NULL 이다.
  -- 실제 작성자는 prayer_author_private 에만 존재한다.
  author_id_public    text references accounts (id) on delete set null,
  author_display_name text,

  status         text not null default 'active'
                 check (status in ('active', 'answered', 'ongoing', 'paused', 'closed')),
  pray_until     date,
  source         text not null default 'app'
                 check (source in ('app', 'guest_link', 'import')),
  source_ref     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  revision_count integer not null default 0,

  -- 익명인데 공개 작성자가 남아 있으면 설계가 깨진 것이다. DB가 직접 막는다.
  constraint anonymous_has_no_public_author
    check (author_mode <> 'anonymous'
           or (author_id_public is null and author_display_name is null))
);

create index if not exists prayers_church_idx  on prayers (church_id) where deleted_at is null;
create index if not exists prayers_status_idx  on prayers (status)    where deleted_at is null;
create index if not exists prayers_updated_idx on prayers (updated_at desc);
create index if not exists prayers_source_idx  on prayers (source_ref);

-- 익명 요청의 실제 작성자.
-- 애플리케이션에 조회 경로를 만들지 않는다(PRD §3). 읽는 코드가 없어야 의미가 있다.
create table if not exists prayer_author_private (
  prayer_id           text primary key references prayers (id) on delete cascade,
  author_id_encrypted text not null,
  created_at          timestamptz not null default now()
);

create table if not exists prayer_updates (
  id                  text primary key,
  prayer_id           text not null references prayers (id) on delete cascade,
  type                text not null check (type in ('comment', 'status_change', 'answer', 'edit')),
  body                text not null,
  author_id           text references accounts (id) on delete set null,
  -- 익명 규칙이 이미 적용된 표시용 이름
  author_display_name text,
  created_at          timestamptz not null default now()
);

create index if not exists prayer_updates_prayer_idx on prayer_updates (prayer_id, created_at);

create table if not exists prayer_revisions (
  id         text primary key,
  prayer_id  text not null references prayers (id) on delete cascade,
  prev_body  text not null,
  editor_id  text references accounts (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists prayer_engagements (
  prayer_id  text not null references prayers (id) on delete cascade,
  user_id    text not null references accounts (id) on delete cascade,
  kind       text not null check (kind in ('prayed')),
  -- Asia/Seoul 기준 날짜. 하루 1회 제한을 DB가 강제한다(PRD §4.3).
  date_key   date not null,
  created_at timestamptz not null default now(),
  primary key (prayer_id, user_id, kind, date_key)
);

create index if not exists prayer_engagements_user_idx   on prayer_engagements (user_id);
create index if not exists prayer_engagements_recent_idx on prayer_engagements (prayer_id, created_at desc);

-- 하루치 고정된 기도 미션.
-- 매번 다시 계산하면 체크할 때마다 순위가 흔들려 목록이 눈앞에서 재배열된다.
create table if not exists daily_missions (
  user_id    text not null references accounts (id) on delete cascade,
  date_key   date not null,
  prayer_ids text[] not null default '{}',
  primary key (user_id, date_key)
);

create table if not exists audit_logs (
  id          bigserial primary key,
  actor_id    text references accounts (id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_target_idx on audit_logs (target_type, target_id, created_at desc);

-- 대화록 업로드 (PRD §5)
create table if not exists imports (
  id              text primary key,
  church_id       text not null,
  uploader_id     text references accounts (id) on delete set null,
  label           text not null,
  message_count   integer not null default 0,
  last_message_at timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists import_drafts (
  id             text primary key,
  import_id      text not null references imports (id) on delete cascade,
  raw_excerpt    text not null,
  speaker        text not null default '',
  spoken_at      timestamptz,
  draft_title    text not null,
  draft_body     text not null,
  draft_category text not null default 'church',
  sensitive_hits text[] not null default '{}',
  -- 자동 게시 금지 — 항상 검토 대기로 들어온다(PRD §5).
  decision       text not null default 'pending'
                 check (decision in ('pending', 'approved', 'discarded')),
  prayer_id      text references prayers (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists import_drafts_pending_idx on import_drafts (import_id, decision);

-- updated_at 자동 갱신
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prayers_touch_updated_at on prayers;
create trigger prayers_touch_updated_at
  before update on prayers
  for each row
  when (old.* is distinct from new.*)
  execute function touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Supabase 를 쓸 때의 잠금
--
-- Supabase 는 public 스키마의 테이블을 자동으로 REST API 로 노출한다.
-- anon 키는 브라우저에 노출되도록 설계된 공개 키이므로, 그대로 두면
-- 그 키를 가진 누구나 기도제목 전체를 읽을 수 있다.
--
-- 이 앱은 Supabase 의 API 를 전혀 쓰지 않고 Postgres 에 직접 접속한다.
-- 그러니 API 쪽 문을 완전히 닫는다:
--   1) 모든 테이블에 RLS 를 켠다 (정책이 하나도 없으면 아무 행도 반환되지 않는다)
--   2) anon·authenticated 역할의 권한을 회수한다
--
-- 앱이 접속하는 postgres 역할은 테이블 소유자라 RLS 를 우회하므로 영향이 없다.
-- Supabase 가 아닌 곳(Neon 등)에서는 해당 역할이 없으므로 조용히 건너뛴다.
-- ─────────────────────────────────────────────────────────────

do $$
declare
  t text;
  tables text[] := array[
    'accounts', 'prayers', 'prayer_author_private', 'prayer_updates',
    'prayer_revisions', 'prayer_engagements', 'daily_missions',
    'audit_logs', 'imports', 'import_drafts'
  ];
  has_supabase_roles boolean;
begin
  select exists (select 1 from pg_roles where rolname = 'anon') into has_supabase_roles;

  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    if has_supabase_roles then
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;

  if has_supabase_roles then
    revoke all on all sequences in schema public from anon, authenticated;
    revoke usage on schema public from anon, authenticated;
    raise notice 'Supabase REST API 노출을 차단했습니다 (RLS 활성화 + anon/authenticated 권한 회수)';
  end if;
end $$;
