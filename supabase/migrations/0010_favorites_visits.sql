-- =============================================================
-- 0010_favorites_visits.sql
-- 노션식 사이드바를 위한 개인 데이터: 즐겨찾기 · 최근 방문
--   둘 다 "내 것만" 읽고 쓴다. 페이지 가시성은 조회 시 pages RLS 가 다시 거른다.
-- =============================================================

create table page_favorites (
  user_id    uuid not null references profiles(id) on delete cascade,
  page_id    uuid not null references pages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, page_id)
);

create table page_visits (
  user_id    uuid not null references profiles(id) on delete cascade,
  page_id    uuid not null references pages(id) on delete cascade,
  visited_at timestamptz not null default now(),
  primary key (user_id, page_id)
);
create index page_visits_recent_idx on page_visits (user_id, visited_at desc);

alter table page_favorites enable row level security;
alter table page_visits    enable row level security;

create policy favorites_own on page_favorites
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy visits_own on page_visits
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 방문 기록: upsert 한 줄로 (페이지를 열 때 클라이언트가 호출)
create or replace function touch_page_visit(p_page_id uuid)
returns void
language sql
security invoker
as $$
  insert into page_visits (user_id, page_id, visited_at)
  values (auth.uid(), p_page_id, now())
  on conflict (user_id, page_id) do update set visited_at = now();
$$;

-- 최근 항목 / 즐겨찾기 (보관된 페이지 제외, pages RLS 적용)
create or replace view v_recent_pages
with (security_invoker = true) as
select v.user_id, v.visited_at, p.id, p.title, p.icon, p.type, p.status
from page_visits v
join pages p on p.id = v.page_id and p.archived_at is null
order by v.visited_at desc;

create or replace view v_favorite_pages
with (security_invoker = true) as
select f.user_id, f.created_at, p.id, p.title, p.icon, p.type, p.status
from page_favorites f
join pages p on p.id = f.page_id and p.archived_at is null
order by f.created_at;
