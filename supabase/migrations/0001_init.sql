-- SMOC 기도의 방 — 초기 스키마 (PRD §7)
--
-- PRD 의 데이터 모델을 그대로 옮기되, 두 가지를 더했다.
--   1. prayers.author_display_name — 목록마다 users 를 조인하지 않기 위한 비정규화.
--      익명 요청에서는 항상 NULL 이므로 이 컬럼이 익명성을 해치지 않는다.
--   2. prayers.deleted_at — soft delete (30일 복구, PRD §4.2)
--
-- 실행: supabase db push  또는  psql -f 0001_init.sql

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- 조직
-- ─────────────────────────────────────────────────────────────

create table churches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table groups (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references churches(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create index groups_church_idx on groups(church_id);

-- ─────────────────────────────────────────────────────────────
-- 사용자
-- id 는 auth.users.id 와 동일하다. 카카오 로그인은 OIDC 커스텀 프로바이더로
-- Supabase Auth 에 연결되고, 여기에는 프로필과 권한만 둔다.
-- ─────────────────────────────────────────────────────────────

create type user_role as enum ('guest', 'intercessor', 'leader', 'admin');

create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  kakao_id      text unique,
  email         text,
  display_name  text not null,
  role          user_role not null default 'intercessor',
  church_id     uuid not null references churches(id) on delete cascade,
  group_id      uuid references groups(id) on delete set null,
  notify_prefs  jsonb not null default '{
    "digest": "daily",
    "weekly_summary": true,
    "urgent_realtime": true,
    "quiet_hours": {"from": "22:00", "to": "07:00"},
    "channels": {"kakao": true, "push": true, "email": true}
  }'::jsonb,
  created_at    timestamptz not null default now(),
  last_active_at timestamptz
);

create index users_church_idx on users(church_id);
create index users_group_idx on users(group_id);

-- ─────────────────────────────────────────────────────────────
-- 기도제목
-- ─────────────────────────────────────────────────────────────

create type prayer_visibility  as enum ('public', 'group', 'leaders_only');
create type prayer_author_mode as enum ('named', 'initials', 'anonymous');
create type prayer_status      as enum ('active', 'answered', 'ongoing', 'paused', 'closed');
create type prayer_source      as enum ('app', 'guest_link', 'import');
create type prayer_update_type as enum ('comment', 'status_change', 'answer', 'edit');
create type engagement_kind    as enum ('prayed', 'committed');

create table prayers (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null references churches(id) on delete cascade,
  group_id        uuid references groups(id) on delete set null,
  title           text not null,
  body            text not null,
  category        text not null default 'church',
  urgency         boolean not null default false,
  visibility      prayer_visibility not null default 'public',
  author_mode     prayer_author_mode not null default 'named',

  -- 익명 요청에서는 두 컬럼 모두 NULL 이다.
  -- 실제 작성자는 prayer_author_private 에만 존재한다.
  author_id_public      uuid references users(id) on delete set null,
  author_display_name   text,

  status          prayer_status not null default 'active',
  pray_until      date,
  source          prayer_source not null default 'app',
  source_ref      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  revision_count  integer not null default 0,

  -- 익명인데 공개 작성자가 남아 있으면 설계가 깨진 것이다. DB가 직접 막는다.
  constraint anonymous_has_no_public_author
    check (author_mode <> 'anonymous' or (author_id_public is null and author_display_name is null))
);

create index prayers_church_idx      on prayers(church_id) where deleted_at is null;
create index prayers_group_idx       on prayers(group_id)  where deleted_at is null;
create index prayers_status_idx      on prayers(status)    where deleted_at is null;
create index prayers_updated_idx     on prayers(updated_at desc);
create index prayers_pray_until_idx  on prayers(pray_until) where pray_until is not null;

-- 익명 요청의 실제 작성자.
-- 애플리케이션 조회 경로가 없고, RLS 에도 SELECT 정책을 만들지 않는다(PRD §3).
-- 법적 요구나 자해·타해 위험 신고 시에만 관리자 2인 승인 + 감사 로그를 남기고
-- break-glass 절차로 복호화한다.
create table prayer_author_private (
  prayer_id           uuid primary key references prayers(id) on delete cascade,
  author_id_encrypted bytea not null,
  ip_hash             text,
  created_at          timestamptz not null default now()
);

create table prayer_updates (
  id                  uuid primary key default gen_random_uuid(),
  prayer_id           uuid not null references prayers(id) on delete cascade,
  type                prayer_update_type not null,
  body                text not null,
  author_id           uuid references users(id) on delete set null,
  -- 익명 규칙이 이미 적용된 표시용 이름. 원문과 동일한 규칙을 따른다.
  author_display_name text,
  created_at          timestamptz not null default now()
);

create index prayer_updates_prayer_idx on prayer_updates(prayer_id, created_at);

create table prayer_revisions (
  id          uuid primary key default gen_random_uuid(),
  prayer_id   uuid not null references prayers(id) on delete cascade,
  prev_body   text not null,
  editor_id   uuid references users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index prayer_revisions_prayer_idx on prayer_revisions(prayer_id, created_at desc);

create table prayer_engagements (
  id          uuid primary key default gen_random_uuid(),
  prayer_id   uuid not null references prayers(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  kind        engagement_kind not null,
  -- Asia/Seoul 기준 날짜. 하루 1회 제한을 DB가 강제한다(PRD §4.3).
  date_key    date not null,
  created_at  timestamptz not null default now(),
  unique (prayer_id, user_id, kind, date_key)
);

create index prayer_engagements_prayer_idx on prayer_engagements(prayer_id);
create index prayer_engagements_user_idx   on prayer_engagements(user_id, kind);
create index prayer_engagements_recent_idx on prayer_engagements(prayer_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 감사 로그 (PRD §4.2, §8)
-- 생성·수정·상태변경·민감 등급 열람을 남긴다.
-- ─────────────────────────────────────────────────────────────

create table audit_logs (
  id          bigserial primary key,
  actor_id    uuid references users(id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_logs_target_idx on audit_logs(target_type, target_id, created_at desc);
create index audit_logs_actor_idx  on audit_logs(actor_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 게스트 초대 링크 (PRD §3, §8)
-- 72시간 만료, 1회용 토큰.
-- ─────────────────────────────────────────────────────────────

create table prayer_invites (
  token       text primary key,
  church_id   uuid not null references churches(id) on delete cascade,
  group_id    uuid references groups(id) on delete set null,
  created_by  uuid references users(id) on delete set null,
  expires_at  timestamptz not null default (now() + interval '72 hours'),
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index prayer_invites_expiry_idx on prayer_invites(expires_at);

-- ─────────────────────────────────────────────────────────────
-- 대화록 업로드 (2단계에서 사용, PRD §5)
-- ─────────────────────────────────────────────────────────────

create table imports (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null references churches(id) on delete cascade,
  uploader_id     uuid references users(id) on delete set null,
  filename        text not null,
  message_count   integer not null default 0,
  -- 재업로드 시 중복 방지를 위한 마지막 처리 시점
  last_message_at timestamptz,
  status          text not null default 'pending',
  created_at      timestamptz not null default now()
);

create table import_drafts (
  id          uuid primary key default gen_random_uuid(),
  import_id   uuid not null references imports(id) on delete cascade,
  raw_excerpt text not null,
  ai_draft    jsonb not null,
  -- 자동 게시 금지 — 항상 검토 대기로 들어온다(PRD §5).
  decision    text not null default 'pending',
  prayer_id   uuid references prayers(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index import_drafts_import_idx on import_drafts(import_id, decision);

-- ─────────────────────────────────────────────────────────────
-- updated_at 자동 갱신
-- ─────────────────────────────────────────────────────────────

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger prayers_touch_updated_at
  before update on prayers
  for each row
  when (old.* is distinct from new.*)
  execute function touch_updated_at();
