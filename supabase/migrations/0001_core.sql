-- =============================================================
-- 0001_core.sql
-- 확장 / profiles / pages(무한 중첩) / ltree 경로 트리거
-- =============================================================

create extension if not exists "pgcrypto";
create extension if not exists "ltree";

-- -------------------------------------------------------------
-- 공통: updated_at 자동 갱신
-- -------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- -------------------------------------------------------------
-- profiles
--   auth.users 와 1:1. 조직 정보는 여기 박지 말고 org_snapshots 로 분리.
--   (10월 합병 후 본부/팀 구조가 바뀌어도 이 테이블은 그대로 유지)
-- -------------------------------------------------------------
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text not null,
  email           text,
  avatar_url      text,
  job_title       text,                       -- 직책 (표시용)
  naverworks_id   text,                       -- 네이버웍스 봇 DM 대상 ID
  notify_mention  boolean not null default true,
  notify_assign   boolean not null default true,
  notify_due      boolean not null default true,
  is_admin        boolean not null default false,
  deactivated_at  timestamptz,                -- 퇴사/이동 시. 행은 남김(멘션 무결성)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index profiles_active_idx on profiles (name) where deactivated_at is null;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();


-- -------------------------------------------------------------
-- org_snapshots
--   조직 구조를 시점별로 저장. 합병 전/후 소속을 모두 보존한다.
--   effective_to 가 null 이면 현재 유효한 소속.
-- -------------------------------------------------------------
create table org_snapshots (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references profiles(id) on delete cascade,
  company        text,                        -- 인라이플 / 모비소프트 / 모비위드 / 에이닉
  division       text,                        -- 본부
  team           text,
  manager_id     uuid references profiles(id),
  effective_from date not null default current_date,
  effective_to   date,
  created_at     timestamptz not null default now()
);

create index org_snapshots_current_idx
  on org_snapshots (profile_id) where effective_to is null;


-- -------------------------------------------------------------
-- pages
--   모든 것이 페이지다. 업무(task)는 속성이 붙은 페이지일 뿐.
--   parent_id 로 무한 중첩, path 로 조상 경로 캐시(사이드바 트리용).
-- -------------------------------------------------------------
create table pages (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid references pages(id) on delete cascade,
  path         ltree,                         -- 트리거가 자동 관리. 직접 쓰지 말 것
  depth        int not null default 0,        -- path 깊이 캐시
  type         text not null default 'doc'
                 check (type in ('doc','task')),
  icon         text,                          -- 이모지 1자
  title        text not null default '제목 없음',
  content      jsonb,                         -- BlockNote 문서 JSON

  -- 형제 간 순서. 실수형이라 두 항목 사이 끼워넣기가 O(1)
  sort_order   double precision not null default 1000,

  -- ---- type='task' 일 때만 의미 있는 속성 ----
  status       text check (status in ('대기','진행','검토','완료','보류','드롭')),
  assignee_id  uuid references profiles(id) on delete set null,
  priority     text check (priority in ('긴급','높음','보통','낮음')),
  progress     int check (progress between 0 and 100),
  start_date   date,
  due_date     date,
  completed_at timestamptz,

  created_by   uuid not null references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz,                   -- 소프트 삭제

  -- task 는 status 필수, doc 은 task 속성 금지
  constraint pages_task_shape check (
    (type = 'task' and status is not null)
    or
    (type = 'doc' and status is null and assignee_id is null
     and progress is null and due_date is null)
  )
);

create index pages_path_idx        on pages using gist (path);
create index pages_children_idx    on pages (parent_id, sort_order);
create index pages_assignee_idx    on pages (assignee_id, status)
                                   where type = 'task' and archived_at is null;
create index pages_due_idx         on pages (due_date)
                                   where type = 'task' and archived_at is null
                                     and status in ('대기','진행','검토');
create index pages_title_trgm_idx  on pages (lower(title));

create trigger pages_updated_at
  before update on pages
  for each row execute function set_updated_at();


-- -------------------------------------------------------------
-- ltree 경로 관리
--
-- 주의: UUID 에는 하이픈이 있어 ltree 라벨로 바로 못 쓴다.
--       하이픈을 '_' 로 바꿔 라벨화한다. (이거 모르면 무조건 터짐)
-- -------------------------------------------------------------
create or replace function page_label(p_id uuid)
returns text
language sql
immutable
as $$
  select replace(p_id::text, '-', '_');
$$;


create or replace function pages_set_path()
returns trigger
language plpgsql
as $$
declare
  parent_path ltree;
begin
  if new.parent_id is null then
    new.path := page_label(new.id)::ltree;
  else
    select path into parent_path from pages where id = new.parent_id;

    if parent_path is null then
      raise exception '부모 페이지(%)를 찾을 수 없습니다', new.parent_id;
    end if;

    -- 순환 방지: 자기 자신 또는 자기 후손을 부모로 지정하는 것 차단
    --
    -- 주의: page_label(new.id)::ltree 와 비교하면 안 된다.
    --   ltree 의 <@ 는 '접두 경로' 기준이라 '001.003.004' <@ '003' 은 false 다.
    --   반드시 이 페이지의 '전체 경로'(old.path)와 비교해야 한다.
    if new.parent_id = new.id then
      raise exception '페이지를 자신의 하위로 이동할 수 없습니다';
    end if;

    if tg_op = 'UPDATE' and old.path is not null
       and parent_path <@ old.path then
      raise exception '페이지를 자신의 하위로 이동할 수 없습니다';
    end if;

    new.path := parent_path || page_label(new.id)::ltree;
  end if;

  new.depth := nlevel(new.path) - 1;
  return new;
end;
$$;

create trigger pages_path_biu
  before insert on pages
  for each row execute function pages_set_path();

create trigger pages_path_bupd
  before update of parent_id on pages
  for each row
  when (new.parent_id is distinct from old.parent_id)
  execute function pages_set_path();


-- 부모가 바뀌면 모든 후손의 path 를 한 번에 재작성
create or replace function pages_reparent_descendants()
returns trigger
language plpgsql
as $$
begin
  update pages
     set path  = new.path || subpath(path, nlevel(old.path)),
         depth = nlevel(new.path || subpath(path, nlevel(old.path))) - 1
   where path <@ old.path
     and id <> new.id;
  return null;
end;
$$;

-- 주의: `after update OF path` 로 쓰면 안 된다.
--   `UPDATE ... OF col` 은 SQL 문이 그 컬럼을 명시적으로 언급했을 때만 발동한다.
--   path 는 BEFORE 트리거가 채우는 값이므로, `set parent_id = ...` 문에서는
--   OF path 조건이 성립하지 않아 트리거가 조용히 건너뛰어진다.
--   (후손 경로가 갱신되지 않고 트리가 깨진다 — 반드시 OF 절 없이 둘 것)
create trigger pages_path_aupd
  after update on pages
  for each row
  when (new.path is distinct from old.path)
  execute function pages_reparent_descendants();


-- -------------------------------------------------------------
-- 완료 시각 자동 기록
-- -------------------------------------------------------------
create or replace function pages_touch_completed()
returns trigger
language plpgsql
as $$
begin
  if new.status = '완료' and coalesce(old.status, '') <> '완료' then
    new.completed_at := now();
    new.progress := 100;
  elsif new.status is distinct from '완료' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger pages_completed_bupd
  before insert or update of status on pages
  for each row
  when (new.type = 'task')
  execute function pages_touch_completed();


-- -------------------------------------------------------------
-- 형제 사이에 끼워넣기용 sort_order 계산
--   move_page(대상, 새 부모, 이 페이지 바로 뒤에 놓을 형제)
-- -------------------------------------------------------------
create or replace function move_page(
  p_page_id   uuid,
  p_parent_id uuid,
  p_after_id  uuid default null   -- null 이면 맨 앞
)
returns double precision
language plpgsql
security invoker
as $$
declare
  prev_order double precision;
  next_order double precision;
  new_order  double precision;
begin
  if p_after_id is null then
    select coalesce(min(sort_order), 2000) into next_order
      from pages
     where parent_id is not distinct from p_parent_id
       and id <> p_page_id;
    new_order := next_order / 2;
  else
    select sort_order into prev_order
      from pages where id = p_after_id;

    select min(sort_order) into next_order
      from pages
     where parent_id is not distinct from p_parent_id
       and sort_order > prev_order
       and id <> p_page_id;

    new_order := case
                   when next_order is null then prev_order + 1000
                   else (prev_order + next_order) / 2
                 end;
  end if;

  update pages
     set parent_id = p_parent_id,
         sort_order = new_order
   where id = p_page_id;

  return new_order;
end;
$$;
