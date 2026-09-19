-- =============================================================
-- 0011 — 공간별 페이지 작성 권한
--   관리자 화면(조직도 관리)에서 공간마다 "누가 새 페이지를 만들 수 있는지" 설정한다.
--     전원(기본): 그 공간을 볼 수 있는 사람 누구나 (본부 공용 포함)
--     리더      : 직책이 팀장·실장·본부장인 사람 + 관리자
--     지정      : org_unit_writers 에 등록된 사람 + 관리자
--   개인 메모는 제한 없음. 하위 페이지 생성도 그 공간의 작성 권한을 따른다.
-- =============================================================

alter table org_units
  add column write_scope text not null default '전원'
    check (write_scope in ('전원', '리더', '지정'));

create table org_unit_writers (
  unit_id uuid not null references org_units(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (unit_id, user_id)
);

alter table org_unit_writers enable row level security;

create policy unit_writers_select on org_unit_writers
  for select to authenticated using (true);
create policy unit_writers_write on org_unit_writers
  for all to authenticated using (is_admin()) with check (is_admin());

-- -------------------------------------------------------------
-- 작성 가능 여부 (RLS 안에서 쓰므로 security definer)
-- -------------------------------------------------------------
create or replace function can_write_unit(p_unit uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when is_admin() then true
    when p_unit is null then false
    else case (select write_scope from org_units where id = p_unit)
      when '전원' then true
      when '리더' then exists (
        select 1 from profiles
         where id = auth.uid()
           and deactivated_at is null
           and job_title in ('팀장', '실장', '본부장')
      )
      when '지정' then exists (
        select 1 from org_unit_writers w
         where w.unit_id = p_unit and w.user_id = auth.uid()
      )
      else false
    end
  end;
$$;

grant execute on function can_write_unit(uuid) to authenticated;

-- -------------------------------------------------------------
-- 페이지 INSERT 에 작성 권한 반영
--   (BEFORE 트리거 pages_inherit_space 가 unit/visibility 를 채운 뒤 검사된다)
-- -------------------------------------------------------------
drop policy pages_insert on pages;
create policy pages_insert on pages
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (visibility = '개인' or can_write_unit(unit_id))
  );

-- -------------------------------------------------------------
-- v_org_units 에 write_scope 노출 (컬럼 순서가 바뀌므로 재생성)
-- -------------------------------------------------------------
drop view if exists v_org_units;
create view v_org_units
with (security_invoker = true) as
select
  u.id, u.parent_id, u.name, u.level, u.sort_order, u.write_scope,
  (select count(*) from profiles pr where pr.unit_id = u.id and pr.deactivated_at is null) as member_count
from org_units u
order by u.sort_order;
