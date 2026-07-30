-- SMOC 기도의 방 — 행 수준 보안 (PRD §7, §8)
--
-- 애플리케이션 버그가 곧바로 유출로 이어지지 않도록 하는 두 번째 방어선이다.
-- 원칙:
--   1. 모든 테이블은 기본 거부. 정책으로 열어준 것만 통과한다.
--   2. church_id 는 예외 없이 강제한다. 교회 간 데이터는 절대 섞이지 않는다.
--   3. prayer_author_private 에는 SELECT 정책을 만들지 않는다.
--      정책이 없으면 어떤 역할로도 읽히지 않는다 — 이것이 익명성의 기술적 근거다.

-- ─────────────────────────────────────────────────────────────
-- 헬퍼
-- users 테이블 자체에도 RLS 가 걸리므로, 정책 안에서 users 를 다시 조회하면
-- 무한 재귀가 난다. SECURITY DEFINER 로 RLS 를 우회해 조회한다.
-- ─────────────────────────────────────────────────────────────

create or replace function auth_church_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select church_id from users where id = auth.uid()
$$;

create or replace function auth_group_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select group_id from users where id = auth.uid()
$$;

create or replace function auth_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from users where id = auth.uid()
$$;

create or replace function auth_is_leader()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from users where id = auth.uid()) in ('leader', 'admin'), false)
$$;

create or replace function auth_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from users where id = auth.uid()) = 'admin', false)
$$;

/**
 * 한 기도제목이 지금 로그인한 사람에게 보이는가.
 * PRD §3 권한표를 그대로 옮긴 술어이며, prayers 뿐 아니라
 * 업데이트·참여·리비전 정책이 모두 이 함수를 재사용한다.
 */
create or replace function can_view_prayer(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from prayers p
    where p.id = p_id
      and p.deleted_at is null
      and p.church_id = auth_church_id()
      and (
        auth_is_leader()
        or p.visibility = 'public'
        or (p.visibility = 'group' and p.group_id is not null and p.group_id = auth_group_id())
      )
  )
$$;

-- ─────────────────────────────────────────────────────────────
-- churches / groups — 소속 교회만
-- ─────────────────────────────────────────────────────────────

alter table churches enable row level security;
alter table groups   enable row level security;

create policy churches_select on churches
  for select to authenticated
  using (id = auth_church_id());

create policy groups_select on groups
  for select to authenticated
  using (church_id = auth_church_id());

create policy groups_write on groups
  for all to authenticated
  using (church_id = auth_church_id() and auth_is_leader())
  with check (church_id = auth_church_id() and auth_is_leader());

-- ─────────────────────────────────────────────────────────────
-- users — 같은 교회 사람만 보이고, 프로필은 본인만 고친다.
-- 역할(role) 변경은 관리자만 가능하도록 트리거로 한 번 더 막는다.
-- ─────────────────────────────────────────────────────────────

alter table users enable row level security;

create policy users_select on users
  for select to authenticated
  using (church_id = auth_church_id());

create policy users_update_self on users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy users_admin_all on users
  for all to authenticated
  using (auth_is_admin() and church_id = auth_church_id())
  with check (auth_is_admin() and church_id = auth_church_id());

create or replace function guard_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not auth_is_admin() then
    raise exception '역할 변경은 관리자만 할 수 있습니다.';
  end if;
  return new;
end;
$$;

create trigger users_guard_role
  before update on users
  for each row
  execute function guard_role_change();

-- ─────────────────────────────────────────────────────────────
-- prayers
-- ─────────────────────────────────────────────────────────────

alter table prayers enable row level security;

create policy prayers_select on prayers
  for select to authenticated
  using (
    deleted_at is null
    and church_id = auth_church_id()
    and (
      auth_is_leader()
      or visibility = 'public'
      or (visibility = 'group' and group_id is not null and group_id = auth_group_id())
    )
  );

-- 작성: 자기 교회에만, 그리고 남의 이름을 빌릴 수 없다.
create policy prayers_insert on prayers
  for insert to authenticated
  with check (
    church_id = auth_church_id()
    and (
      (author_mode = 'anonymous' and author_id_public is null)
      or author_id_public = auth.uid()
    )
  );

-- 수정·상태변경: 리더 이상 또는 본인 건만 (PRD §3 권한표)
create policy prayers_update on prayers
  for update to authenticated
  using (
    church_id = auth_church_id()
    and (auth_is_leader() or author_id_public = auth.uid())
  )
  with check (church_id = auth_church_id());

-- 하드 삭제 경로는 열지 않는다. 삭제는 deleted_at 을 채우는 UPDATE 로만 한다.

-- ─────────────────────────────────────────────────────────────
-- prayer_author_private
--
-- RLS 는 켜지만 SELECT 정책을 만들지 않는다. 정책이 없으면 익명 키로는
-- 단 한 행도 반환되지 않는다. 리더도, 관리자도 마찬가지다.
-- 복호화는 아래 break-glass 함수로만 가능하고 반드시 감사 로그를 남긴다.
-- ─────────────────────────────────────────────────────────────

alter table prayer_author_private enable row level security;

-- INSERT 조차 직접 열지 않는다. 아래 SECURITY DEFINER 함수만 쓴다.

/**
 * 익명 요청의 실제 작성자를 암호화해 분리 저장한다.
 * 키는 Supabase Vault 에 'golbang_author_key' 이름으로 보관한다.
 */
create or replace function record_anonymous_author(p_prayer_id uuid, p_author_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_key text;
begin
  if not exists (select 1 from prayers where id = p_prayer_id and church_id = auth_church_id()) then
    raise exception '권한이 없습니다.';
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'golbang_author_key';

  if v_key is null then
    raise exception '익명 작성자 암호화 키가 설정되지 않았습니다.';
  end if;

  insert into prayer_author_private (prayer_id, author_id_encrypted)
  values (p_prayer_id, pgp_sym_encrypt(p_author_id::text, v_key))
  on conflict (prayer_id) do nothing;
end;
$$;

revoke all on function record_anonymous_author(uuid, uuid) from public;
grant execute on function record_anonymous_author(uuid, uuid) to authenticated;

/**
 * break-glass — 법적 요구나 자해·타해 위험 신고가 있을 때만 쓴다(PRD §3).
 * 관리자 2인 승인을 전제로 하며, 호출 사실 자체가 감사 로그에 남는다.
 * 두 번째 승인자 확인은 애플리케이션이 아니라 운영 절차로 검증한다.
 */
create or replace function reveal_anonymous_author(p_prayer_id uuid, p_reason text, p_second_approver uuid)
returns uuid
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_key text;
  v_author uuid;
begin
  if not auth_is_admin() then
    raise exception '관리자만 호출할 수 있습니다.';
  end if;
  if p_second_approver is null or p_second_approver = auth.uid() then
    raise exception '서로 다른 관리자 2인의 승인이 필요합니다.';
  end if;
  if not exists (select 1 from users where id = p_second_approver and role = 'admin') then
    raise exception '두 번째 승인자가 관리자가 아닙니다.';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception '사유를 반드시 남겨야 합니다.';
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'golbang_author_key';

  select pgp_sym_decrypt(author_id_encrypted, v_key)::uuid into v_author
  from prayer_author_private
  where prayer_id = p_prayer_id;

  insert into audit_logs (actor_id, action, target_type, target_id, meta)
  values (
    auth.uid(),
    'break_glass_reveal_author',
    'prayer',
    p_prayer_id::text,
    jsonb_build_object('reason', p_reason, 'second_approver', p_second_approver)
  );

  return v_author;
end;
$$;

revoke all on function reveal_anonymous_author(uuid, text, uuid) from public;
revoke execute on function reveal_anonymous_author(uuid, text, uuid) from authenticated;
-- 실행 권한은 운영자가 명시적으로 부여한다. 기본은 아무도 부를 수 없다.

-- ─────────────────────────────────────────────────────────────
-- prayer_updates — 부모 기도제목이 보일 때만 보인다.
-- ─────────────────────────────────────────────────────────────

alter table prayer_updates enable row level security;

create policy prayer_updates_select on prayer_updates
  for select to authenticated
  using (can_view_prayer(prayer_id));

create policy prayer_updates_insert on prayer_updates
  for insert to authenticated
  with check (can_view_prayer(prayer_id) and (author_id = auth.uid() or author_id is null));

-- 타임라인은 누적되는 기록이다. 수정·삭제 경로를 열지 않는다.

-- ─────────────────────────────────────────────────────────────
-- prayer_revisions — 변경 내역은 리더만 열람(PRD §4.2)
-- ─────────────────────────────────────────────────────────────

alter table prayer_revisions enable row level security;

create policy prayer_revisions_select on prayer_revisions
  for select to authenticated
  using (auth_is_leader() and can_view_prayer(prayer_id));

create policy prayer_revisions_insert on prayer_revisions
  for insert to authenticated
  with check (can_view_prayer(prayer_id));

-- ─────────────────────────────────────────────────────────────
-- prayer_engagements
--
-- 요청자에게는 누가 기도했는지가 아니라 몇 명인지만 전달된다(PRD §4.3).
-- 그 규칙은 화면이 아니라 여기서 지켜져야 하므로, 남의 참여 행은
-- 집계에 필요한 만큼만 읽히고 본인 행만 쓸 수 있게 한다.
-- ─────────────────────────────────────────────────────────────

alter table prayer_engagements enable row level security;

create policy prayer_engagements_select on prayer_engagements
  for select to authenticated
  using (can_view_prayer(prayer_id));

create policy prayer_engagements_insert on prayer_engagements
  for insert to authenticated
  with check (user_id = auth.uid() and can_view_prayer(prayer_id));

create policy prayer_engagements_delete on prayer_engagements
  for delete to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- audit_logs — 누구나 남기고, 관리자만 읽는다. 수정·삭제는 불가.
-- ─────────────────────────────────────────────────────────────

alter table audit_logs enable row level security;

create policy audit_logs_insert on audit_logs
  for insert to authenticated
  with check (actor_id = auth.uid() or actor_id is null);

create policy audit_logs_select on audit_logs
  for select to authenticated
  using (auth_is_admin());

-- ─────────────────────────────────────────────────────────────
-- prayer_invites — 리더가 만들고, 검증은 SECURITY DEFINER 함수로만 한다.
-- 익명 키로 초대 테이블을 직접 읽게 두면 토큰이 새어 나간다.
-- ─────────────────────────────────────────────────────────────

alter table prayer_invites enable row level security;

create policy prayer_invites_leader on prayer_invites
  for all to authenticated
  using (church_id = auth_church_id() and auth_is_leader())
  with check (church_id = auth_church_id() and auth_is_leader());

/**
 * 게스트가 초대 링크로 올린 기도제목.
 * 로그인하지 않은 방문자(anon)가 유일하게 쓸 수 있는 경로이며,
 * 유효한 토큰이 없으면 아무것도 하지 못한다. 결과는 항상 승인 대기다.
 */
create or replace function submit_guest_prayer(
  p_token      text,
  p_title      text,
  p_body       text,
  p_category   text,
  p_visibility prayer_visibility,
  p_author_mode prayer_author_mode,
  p_pray_until date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite prayer_invites;
  v_id uuid;
begin
  select * into v_invite
  from prayer_invites
  where token = p_token and expires_at > now() and used_at is null;

  if v_invite is null then
    raise exception '초대 링크가 만료되었거나 이미 사용되었습니다.';
  end if;

  if coalesce(trim(p_body), '') = '' then
    raise exception '기도제목을 입력해 주세요.';
  end if;

  insert into prayers (
    church_id, group_id, title, body, category,
    visibility, author_mode, status, pray_until, source
  )
  values (
    v_invite.church_id,
    case when p_visibility = 'group' then v_invite.group_id else null end,
    p_title, p_body, p_category,
    p_visibility, p_author_mode,
    -- 게스트 건은 리더 승인 전까지 보류 상태로 둔다(PRD §3 권한표).
    'paused',
    p_pray_until,
    'guest_link'
  )
  returning id into v_id;

  update prayer_invites set used_at = now() where token = p_token;

  insert into audit_logs (actor_id, action, target_type, target_id, meta)
  values (null, 'guest_create_prayer', 'prayer', v_id::text,
          jsonb_build_object('invite', p_token));

  return v_id;
end;
$$;

revoke all on function submit_guest_prayer(text, text, text, text, prayer_visibility, prayer_author_mode, date) from public;
grant execute on function submit_guest_prayer(text, text, text, text, prayer_visibility, prayer_author_mode, date) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- imports / import_drafts — 리더 이상만 (PRD §3 권한표)
-- ─────────────────────────────────────────────────────────────

alter table imports       enable row level security;
alter table import_drafts enable row level security;

create policy imports_leader on imports
  for all to authenticated
  using (church_id = auth_church_id() and auth_is_leader())
  with check (church_id = auth_church_id() and auth_is_leader());

create policy import_drafts_leader on import_drafts
  for all to authenticated
  using (
    auth_is_leader()
    and exists (
      select 1 from imports i
      where i.id = import_drafts.import_id and i.church_id = auth_church_id()
    )
  )
  with check (
    auth_is_leader()
    and exists (
      select 1 from imports i
      where i.id = import_drafts.import_id and i.church_id = auth_church_id()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 보존 기간 (PRD §8)
-- 종료된 제목은 1년 후 본문을 파기하고 통계만 남긴다.
-- soft delete 된 건은 30일 후 하드 삭제한다.
-- pg_cron 이 있으면 스케줄에 걸고, 없으면 서버 크론에서 이 함수를 호출한다.
-- ─────────────────────────────────────────────────────────────

create or replace function enforce_retention()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from prayers
  where deleted_at is not null and deleted_at < now() - interval '30 days';

  update prayers
  set body = '(보존 기간이 지나 본문이 파기되었습니다)',
      title = '(파기됨)'
  where status = 'closed'
    and updated_at < now() - interval '1 year'
    and body <> '(보존 기간이 지나 본문이 파기되었습니다)';
end;
$$;
