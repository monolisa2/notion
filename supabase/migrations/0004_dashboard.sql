-- =============================================================
-- 0004_dashboard.sql
-- 대시보드 뷰 5종 + 정체 업무 감지
--
-- security_invoker = true : 뷰를 조회하는 사람의 RLS 가 적용된다.
--   (이 옵션을 빼면 뷰가 RLS 우회 구멍이 된다. 반드시 켜 둘 것)
-- =============================================================

-- -------------------------------------------------------------
-- 1) 실시간 활동 피드
-- -------------------------------------------------------------
create or replace view v_activity_feed
with (security_invoker = true) as
select
  u.id,
  u.created_at,
  u.page_id,
  p.title           as page_title,
  p.icon,
  p.status,
  pr.name           as author_name,
  pr.avatar_url,
  u.content,
  u.progress_snapshot,
  u.blocker
from page_updates u
join pages    p  on p.id = u.page_id
join profiles pr on pr.id = u.author_id
where p.archived_at is null
order by u.created_at desc;


-- -------------------------------------------------------------
-- 2) 담당자별 현황
-- -------------------------------------------------------------
create or replace view v_assignee_summary
with (security_invoker = true) as
select
  pr.id                                                          as assignee_id,
  pr.name,
  pr.avatar_url,
  count(*) filter (where p.status in ('대기','진행','검토'))      as open_count,
  count(*) filter (where p.status = '진행')                       as in_progress,
  count(*) filter (where p.status = '완료')                       as done_count,
  count(*) filter (where p.status = '보류')                       as on_hold,
  count(*) filter (where p.due_date < current_date
                     and p.status in ('대기','진행','검토'))       as overdue,
  round(avg(p.progress) filter (where p.status in ('대기','진행','검토')))
                                                                 as avg_progress
from profiles pr
left join pages p
  on p.assignee_id = pr.id
 and p.type = 'task'
 and p.archived_at is null
where pr.deactivated_at is null
group by pr.id, pr.name, pr.avatar_url;


-- -------------------------------------------------------------
-- 3) 기한 리스크
-- -------------------------------------------------------------
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
  and p.status in ('대기','진행','검토')
  and p.due_date is not null
  and p.due_date <= current_date + 7
order by p.due_date;


-- -------------------------------------------------------------
-- 4) 정체 업무 — 관리자가 제일 원하는 지표
--    진행 중인데 3일 이상 아무 진행 로그가 없는 업무
-- -------------------------------------------------------------
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
  and p.status in ('대기','진행','검토')
  and coalesce(lu.last_update_at, p.created_at) < now() - interval '3 days'
order by last_activity_at;


-- -------------------------------------------------------------
-- 5) 막힌 업무 (최신 로그에 blocker 가 있는 것)
-- -------------------------------------------------------------
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
  and p.status in ('대기','진행','검토')
  and u.blocker is not null
order by p.id, u.created_at desc;


-- -------------------------------------------------------------
-- 사이드바 트리 (ltree 경로로 정렬 → 한 번의 쿼리로 트리 완성)
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
           where c.parent_id = p.id and c.archived_at is null) as has_children
from pages p
where p.archived_at is null
order by p.path;


-- -------------------------------------------------------------
-- 주간보고 원문 추출
--   지난 N일치 진행 로그를 담당자별로 묶어 반환.
--   이 결과를 LLM 에 넣으면 주간보고 초안이 나온다.
-- -------------------------------------------------------------
--   담당자(assignee)가 아니라 '로그 작성자'로 묶는다.
--   기간 중 담당자가 바뀌면 작성자 기준이 실제 수행자를 정확히 반영한다.
create or replace function weekly_digest(p_days int default 7)
returns table (
  author_name   text,
  page_title    text,
  page_status   text,
  progress      int,
  assignee_name text,
  updates       text,
  blockers      text
)
language sql
security invoker
as $$
  select
    au.name                                as author_name,
    p.title                                as page_title,
    p.status                               as page_status,
    p.progress,
    coalesce(asg.name, '미지정')           as assignee_name,
    string_agg(
      to_char(u.created_at, 'MM/DD') || ' ' || u.content,
      E'\n' order by u.created_at
    )                                      as updates,
    string_agg(u.blocker, E'\n' order by u.created_at)
                                           as blockers
  from page_updates u
  join pages    p   on p.id  = u.page_id
  join profiles au  on au.id = u.author_id
  left join profiles asg on asg.id = p.assignee_id
  where u.created_at >= now() - make_interval(days => p_days)
    and p.archived_at is null
  group by au.name, p.id, p.title, p.status, p.progress, asg.name
  order by au.name, p.title;
$$;


-- -------------------------------------------------------------
-- 미입력자 — 주간보고에 명시적으로 표시할 것.
--   입력률을 끌어올리는 가장 강한 장치다.
-- -------------------------------------------------------------
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
    count(p.id) filter (where p.status in ('대기','진행','검토')) as open_tasks,
    (select max(created_at) from page_updates u where u.author_id = pr.id)
  from profiles pr
  left join pages p
    on p.assignee_id = pr.id and p.type = 'task' and p.archived_at is null
  where pr.deactivated_at is null
  group by pr.id, pr.name
  having count(p.id) filter (where p.status in ('대기','진행','검토')) > 0
     and not exists (
       select 1 from page_updates u
        where u.author_id = pr.id
          and u.created_at >= now() - make_interval(days => p_days)
     );
$$;
