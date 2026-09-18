-- =============================================================
-- 0008_org_spaces.sql
-- 조직도(본부 > 실 > 팀) · 공간 · 공개 범위 · 프로필 필드 · 가시성 RLS
--
-- 요구사항 정의서 v1 (docs/REQUIREMENTS.md) 단계 A.
--   - org_units: 조직 트리. 관리자가 화면에서 고친다 (10월 합병 대비)
--   - profiles.unit_id / rank(직급) / must_change_password(첫 로그인 강제 변경)
--   - pages.unit_id(공간) / visibility('본부'|'소속'|'개인') / owner_id(개인 메모)
--     하위 페이지는 부모의 공간·공개 범위를 상속한다 (트리거)
--   - 가시성: 본부 = 전원, 소속 = 같은 계열(조상/후손) 조직 + 관리자, 개인 = 본인만
-- =============================================================

-- -------------------------------------------------------------
-- org_units
-- -------------------------------------------------------------
create table org_units (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references org_units(id) on delete restrict,
  name        text not null,
  level       text not null check (level in ('본부','실','팀')),
  sort_order  int  not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index org_units_parent_idx on org_units (parent_id, sort_order);
create trigger org_units_updated_at before update on org_units
  for each row execute function set_updated_at();

-- 초기 조직도 (인사 시스템 2026-09-18 기준)
insert into org_units (id, parent_id, name, level, sort_order) values
  ('00000000-0000-4000-8000-000000000001', null, '경영관리본부', '본부', 1),
  ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', '인사관리실', '실', 10),
  ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000001', '재무관리실', '실', 20),
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000020', '재무팀',     '팀', 21),
  ('00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000020', '총무팀',     '팀', 22),
  ('00000000-0000-4000-8000-000000000023', '00000000-0000-4000-8000-000000000020', '회계팀',     '팀', 23),
  ('00000000-0000-4000-8000-000000000030', '00000000-0000-4000-8000-000000000001', '행정관리실', '실', 30),
  ('00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000030', '환경관리팀', '팀', 31);

-- -------------------------------------------------------------
-- profiles 확장
-- -------------------------------------------------------------
alter table profiles
  add column unit_id              uuid references org_units(id) on delete set null,
  add column rank                 text,                       -- 직급: 사원/주임/대리/과장/차장/부장
  add column must_change_password boolean not null default false;

comment on column profiles.job_title is '직책: 팀원/팀장/실장/본부장';
comment on column profiles.rank      is '직급: 사원/주임/대리/과장/차장/부장';

create index profiles_unit_idx on profiles (unit_id) where deactivated_at is null;

-- 일반 사용자는 본인 행에서 이름·아바타·알림 설정·네이버웍스 ID·must_change_password 만 바꿀 수 있다.
-- 권한/소속/직급/직책/비활성화는 관리자만. (기존 profiles_update_self 정책이 열어둔 구멍을 막는다)
create or replace function profiles_guard()
returns trigger
language plpgsql
as $$
begin
  if not is_admin() then
    if new.is_admin        is distinct from old.is_admin
    or new.unit_id         is distinct from old.unit_id
    or new.rank            is distinct from old.rank
    or new.job_title       is distinct from old.job_title
    or new.deactivated_at  is distinct from old.deactivated_at
    or new.email           is distinct from old.email then
      raise exception '권한, 소속, 직급, 직책, 이메일, 활성 상태는 관리자만 변경할 수 있습니다';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_bupd
  before update on profiles
  for each row
  when (auth.uid() is not null)          -- 서버(service role) 호출은 통과
  execute function profiles_guard();

-- 부트스트랩: 가장 먼저 만들어진 계정을 관리자로 (이후 관리자 화면에서 조정)
update profiles set is_admin = true
 where id = (select id from profiles order by created_at limit 1)
   and not exists (select 1 from profiles where is_admin);

-- -------------------------------------------------------------
-- pages 확장: 공간 · 공개 범위 · 개인 메모 소유자
-- -------------------------------------------------------------
alter table pages
  add column unit_id    uuid references org_units(id) on delete set null,
  add column visibility text not null default '본부'
             check (visibility in ('본부','소속','개인')),
  add column owner_id   uuid references profiles(id) on delete cascade;

-- 개인 메모는 owner 필수, 그 외는 공간 필수
alter table pages add constraint pages_space_shape check (
  (visibility = '개인' and owner_id is not null)
  or
  (visibility <> '개인' and unit_id is not null)
) not valid;

-- 기존 페이지는 본부 공용으로
update pages set unit_id = '00000000-0000-4000-8000-000000000001', visibility = '본부'
 where unit_id is null and visibility <> '개인';
alter table pages validate constraint pages_space_shape;

create index pages_unit_idx  on pages (unit_id) where archived_at is null;
create index pages_owner_idx on pages (owner_id) where visibility = '개인';

-- 하위 페이지는 부모의 공간/공개 범위/소유자를 물려받는다
create or replace function pages_inherit_space()
returns trigger
language plpgsql
as $$
declare
  p record;
begin
  if new.parent_id is not null then
    select unit_id, visibility, owner_id into p from pages where id = new.parent_id;
    if found then
      new.unit_id    := p.unit_id;
      new.visibility := p.visibility;
      new.owner_id   := p.owner_id;
    end if;
  end if;

  if new.visibility = '개인' then
    new.owner_id := coalesce(new.owner_id, new.created_by);
    new.unit_id  := null;
  else
    new.owner_id := null;
    if new.unit_id is null then
      select id into new.unit_id from org_units where parent_id is null order by sort_order limit 1;
    end if;
  end if;
  return new;
end;
$$;

create trigger pages_space_biu
  before insert or update of parent_id, unit_id, visibility on pages
  for each row execute function pages_inherit_space();

-- 루트의 공간/공개 범위가 바뀌면 후손 전체에 전파
create or replace function pages_propagate_space()
returns trigger
language plpgsql
as $$
begin
  update pages
     set unit_id = new.unit_id, visibility = new.visibility, owner_id = new.owner_id
   where path <@ new.path
     and id <> new.id
     and (unit_id is distinct from new.unit_id
          or visibility is distinct from new.visibility
          or owner_id is distinct from new.owner_id);
  return null;
end;
$$;

create trigger pages_space_aupd
  after update on pages
  for each row
  when (new.unit_id is distinct from old.unit_id
        or new.visibility is distinct from old.visibility
        or new.owner_id is distinct from old.owner_id)
  execute function pages_propagate_space();

-- -------------------------------------------------------------
-- 가시성 함수
--   내 소속(U)과 페이지 공간(P)이 같은 계열(P 가 U 의 조상·자신·후손)이면 볼 수 있다.
--   실장(재무관리실)은 재무/총무/회계팀 페이지를, 재무팀원은 재무관리실·본부 페이지를 본다.
-- -------------------------------------------------------------
create or replace function my_unit_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select unit_id from profiles where id = auth.uid() $$;

create or replace function can_view_unit(p_unit uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  with recursive up as (
    select id, parent_id from org_units where id = my_unit_id()
    union all
    select o.id, o.parent_id from org_units o join up on o.id = up.parent_id
  ),
  down as (
    select id from org_units where id = my_unit_id()
    union all
    select o.id from org_units o join down on o.parent_id = down.id
  )
  select p_unit is not null and exists (
    select 1 from (select id from up union select id from down) c where c.id = p_unit
  );
$$;

-- -------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------
alter table org_units enable row level security;

create policy org_units_select on org_units
  for select to authenticated using (true);
create policy org_units_write on org_units
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy pages_select on pages;
drop policy pages_update on pages;

create policy pages_select on pages
  for select to authenticated
  using (
    (visibility = '본부')
    or (visibility = '소속' and (can_view_unit(unit_id) or is_admin()))
    or (visibility = '개인' and owner_id = auth.uid())
  );

create policy pages_update on pages
  for update to authenticated
  using (
    (archived_at is null or is_admin())
    and (
      (visibility = '본부')
      or (visibility = '소속' and (can_view_unit(unit_id) or is_admin()))
      or (visibility = '개인' and owner_id = auth.uid())
    )
  )
  with check (true);

-- 진행 로그·댓글·멘션은 페이지가 보일 때만 (pages 의 RLS 가 서브쿼리에 적용된다)
drop policy page_updates_select on page_updates;
create policy page_updates_select on page_updates
  for select to authenticated
  using (exists (select 1 from pages p where p.id = page_updates.page_id));

drop policy comments_select on comments;
create policy comments_select on comments
  for select to authenticated
  using (exists (select 1 from pages p where p.id = comments.page_id));

-- -------------------------------------------------------------
-- 사이드바 트리 뷰에 공간 정보 추가
-- -------------------------------------------------------------
create or replace view v_page_tree
with (security_invoker = true) as
select
  p.id,
  p.parent_id,
  p.depth,
  p.type,
  p.icon,
  p.title,
  p.status,
  p.sort_order,
  p.path,
  exists (select 1 from pages c
           where c.parent_id = p.id and c.archived_at is null) as has_children,
  p.unit_id,
  p.visibility,
  p.owner_id
from pages p
where p.archived_at is null
order by p.path;

-- -------------------------------------------------------------
-- 조직도 조회 (소속 인원 수 포함)
-- -------------------------------------------------------------
create or replace view v_org_units
with (security_invoker = true) as
select
  u.id, u.parent_id, u.name, u.level, u.sort_order,
  (select count(*) from profiles pr where pr.unit_id = u.id and pr.deactivated_at is null) as member_count
from org_units u
order by u.sort_order;

-- -------------------------------------------------------------
-- 미입력 리마인드는 "권장만" 으로 결정 → 0007 이 등록한 스케줄이 있으면 해제
-- -------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'teamhub-daily-stale-reminder';
  end if;
end $$;
