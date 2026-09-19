-- =============================================================
-- 0012 — 업무 상태 커스터마이징 (본부 공통)
--   상태 목록을 page_statuses 테이블로 빼서 관리자·조직장(팀장/실장/본부장)이
--   이름·색·순서를 편집한다. 칸반 열과 업무 화면이 이 목록을 따른다.
--
--   각 상태는 kind('대기'|'진행'|'완료'|'보류'|'드롭') 를 가진다 — 대시보드
--   집계·완료 처리 같은 "의미" 는 kind 로 판정하므로 이름을 바꿔도 깨지지 않는다.
--   pages.status 는 상태 이름을 그대로 저장(화면 원칙)하고 FK on update cascade
--   로 이름 변경이 기존 업무에 자동 반영된다. page_updates.status_snapshot 은
--   기록 당시 문자열 그대로 둔다 (append-only 이력).
-- =============================================================

create table page_statuses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(trim(name)) between 1 and 20),
  kind       text not null check (kind in ('대기', '진행', '완료', '보류', '드롭')),
  color      text not null default 'zinc',
  sort_order int  not null default 1000,
  created_at timestamptz not null default now()
);

insert into page_statuses (name, kind, color, sort_order) values
  ('대기', '대기', 'zinc',    100),
  ('진행', '진행', 'blue',    200),
  ('검토', '진행', 'violet',  300),
  ('완료', '완료', 'emerald', 400),
  ('보류', '보류', 'amber',   500),
  ('드롭', '드롭', 'zinc',    600);

alter table page_statuses enable row level security;

create policy page_statuses_select on page_statuses
  for select to authenticated using (true);

-- 편집: 관리자 + 조직장(팀장·실장·본부장)
create policy page_statuses_write on page_statuses
  for all to authenticated
  using (
    is_admin() or exists (
      select 1 from profiles
       where id = auth.uid()
         and deactivated_at is null
         and job_title in ('팀장', '실장', '본부장')
    )
  )
  with check (
    is_admin() or exists (
      select 1 from profiles
       where id = auth.uid()
         and deactivated_at is null
         and job_title in ('팀장', '실장', '본부장')
    )
  );

-- -------------------------------------------------------------
-- pages.status: 고정 check → FK. 이름 변경은 cascade 로 따라온다.
-- 사용 중인 상태 삭제는 FK 가 막는다 (restrict).
-- -------------------------------------------------------------
alter table pages drop constraint pages_status_check;
alter table pages add constraint pages_status_fk
  foreign key (status) references page_statuses(name)
  on update cascade on delete restrict;

-- 부분 인덱스 조건의 상태 목록 제거 (인덱스 조건에는 서브쿼리를 못 쓴다)
drop index pages_due_idx;
create index pages_due_idx on pages (due_date)
  where type = 'task' and archived_at is null;

-- -------------------------------------------------------------
-- 상태 이름 → 의미
-- -------------------------------------------------------------
create or replace function status_kind(p_status text)
returns text
language sql stable
as $$
  select kind from page_statuses where name = p_status;
$$;

grant execute on function status_kind(text) to authenticated;

-- 완료 처리: '완료' 라는 이름이 아니라 kind 로 판정
create or replace function pages_touch_completed()
returns trigger
language plpgsql
as $$
declare
  v_old_kind text;
begin
  if tg_op = 'UPDATE' then
    v_old_kind := status_kind(old.status);
  end if;
  if status_kind(new.status) = '완료' and coalesce(v_old_kind, '') <> '완료' then
    new.completed_at := now();
    new.progress := 100;
  elsif status_kind(new.status) is distinct from '완료' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------
-- 대시보드 뷰·함수: 상태 리터럴 → kind 판정으로 교체
--   열림(진행 중) = kind in ('대기','진행')
-- -------------------------------------------------------------
create or replace view v_assignee_summary
with (security_invoker = true) as
select
  pr.id                                                              as assignee_id,
  pr.name,
  pr.avatar_url,
  count(*) filter (where status_kind(p.status) in ('대기', '진행'))  as open_count,
  count(*) filter (where status_kind(p.status) = '진행')             as in_progress,
  count(*) filter (where status_kind(p.status) = '완료')             as done_count,
  count(*) filter (where status_kind(p.status) = '보류')             as on_hold,
  count(*) filter (where p.due_date < current_date
                     and status_kind(p.status) in ('대기', '진행'))  as overdue,
  round(avg(p.progress) filter (where status_kind(p.status) in ('대기', '진행')))
                                                                     as avg_progress
from profiles pr
left join pages p
  on p.assignee_id = pr.id
 and p.type = 'task'
 and p.archived_at is null
where pr.deactivated_at is null
group by pr.id, pr.name, pr.avatar_url;

create or replace view v_due_risk
with (security_invoker = true) as
select
  p.id,
  p.title,
  p.icon,
  p.status,
  p.priority,
  p.progress,
  p.due_date,
  p.due_date - current_date as days_left,
  case
    when p.due_date <  current_date                    then '초과'
    when p.due_date =  current_date                    then '오늘'
    when p.due_date <= current_date + 3                then '임박'
    else '여유'
  end                       as risk_level,
  pr.name                   as assignee_name,
  pr.avatar_url
from pages p
left join profiles pr on pr.id = p.assignee_id
where p.type = 'task'
  and p.archived_at is null
  and status_kind(p.status) in ('대기', '진행')
  and p.due_date is not null
  and p.due_date <= current_date + 7
order by p.due_date;

create or replace view v_stale_tasks
with (security_invoker = true) as
select
  p.id,
  p.title,
  p.icon,
  p.status,
  p.progress,
  p.due_date,
  pr.name                                     as assignee_name,
  pr.avatar_url,
  coalesce(lu.last_update_at, p.created_at)   as last_activity_at,
  extract(day from now() - coalesce(lu.last_update_at, p.created_at))::int
                                              as stale_days
from pages p
left join profiles pr on pr.id = p.assignee_id
left join lateral (
  select max(created_at) as last_update_at
    from page_updates u
   where u.page_id = p.id
) lu on true
where p.type = 'task'
  and p.archived_at is null
  and status_kind(p.status) in ('대기', '진행')
  and coalesce(lu.last_update_at, p.created_at) < now() - interval '3 days'
order by last_activity_at;

create or replace view v_blocked_tasks
with (security_invoker = true) as
select distinct on (p.id)
  p.id,
  p.title,
  p.icon,
  p.status,
  p.progress,
  pr.name        as assignee_name,
  u.blocker,
  u.created_at   as raised_at
from pages p
join page_updates u on u.page_id = p.id
left join profiles pr on pr.id = p.assignee_id
where p.type = 'task'
  and p.archived_at is null
  and status_kind(p.status) in ('대기', '진행')
  and u.blocker is not null
order by p.id, u.created_at desc;

create or replace function silent_members(p_days int default 7)
returns table (
  profile_id  uuid,
  name        text,
  open_tasks  bigint,
  last_log_at timestamptz
)
language sql
security invoker
as $$
  select
    pr.id,
    pr.name,
    count(p.id) filter (where status_kind(p.status) in ('대기', '진행')) as open_tasks,
    (select max(created_at) from page_updates u where u.author_id = pr.id)
  from profiles pr
  left join pages p
    on p.assignee_id = pr.id and p.type = 'task' and p.archived_at is null
  where pr.deactivated_at is null
  group by pr.id, pr.name
  having count(p.id) filter (where status_kind(p.status) in ('대기', '진행')) > 0
     and not exists (
       select 1 from page_updates u
        where u.author_id = pr.id
          and u.created_at >= now() - make_interval(days => p_days)
     );
$$;

-- 미입력 리마인드도 kind 판정으로 (스케줄 등록은 하지 않는다 — 0008 에서 해제된 상태 유지)
create or replace function enqueue_daily_reminders(p_today date default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := coalesce(p_today, (now() at time zone 'Asia/Seoul')::date);
  v_count int := 0;
  r       record;
  v_id    uuid;
begin
  for r in
    select
      pr.id                                          as profile_id,
      count(p.id)                                    as open_tasks,
      (array_agg(p.id order by p.updated_at asc))[1] as page_id
    from profiles pr
    join pages p
      on p.assignee_id = pr.id
     and p.type = 'task'
     and p.archived_at is null
     and status_kind(p.status) in ('대기', '진행')
    where pr.deactivated_at is null
      and not exists (
        select 1
          from page_updates u
         where u.author_id = pr.id
           and (u.created_at at time zone 'Asia/Seoul')::date = v_today
      )
    group by pr.id
  loop
    v_id := enqueue_notification(
      p_recipient  => r.profile_id,
      p_actor      => null,
      p_kind       => 'stale',
      p_page_id    => r.page_id,
      p_title      => format('오늘 진행 상황을 한 줄 남겨주세요 (진행 중 업무 %s건)', r.open_tasks),
      p_preview    => '⌃⇧L 또는 사이드바 "진행 로그 남기기"에서 30초면 됩니다',
      p_dedupe_key => 'stale:' || v_today::text
    );
    if v_id is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;
