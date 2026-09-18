-- =============================================================
-- 0002_activity.sql
-- page_updates(일별 진행 로그) / comments
--
-- page_updates 가 이 시스템의 핵심 차별점이다.
-- 노션은 "현재 상태"만 보여주고 "어떻게 여기까지 왔는지"는 못 보여준다.
-- 이 테이블이 주간보고 자동 생성의 유일한 재료다. append-only 로 유지.
-- =============================================================

create table page_updates (
  id                uuid primary key default gen_random_uuid(),
  page_id           uuid not null references pages(id) on delete cascade,
  author_id         uuid not null references profiles(id),
  content           text not null check (length(trim(content)) > 0),
  progress_snapshot int check (progress_snapshot between 0 and 100),
  status_snapshot   text,
  blocker           text,                     -- 막힌 사유. null 이면 정상
  created_at        timestamptz not null default now()
);

create index page_updates_page_idx   on page_updates (page_id, created_at desc);
create index page_updates_feed_idx   on page_updates (created_at desc);
create index page_updates_author_idx on page_updates (author_id, created_at desc);
create index page_updates_blocker_idx on page_updates (page_id)
  where blocker is not null;


-- 진행 로그를 남기면 pages.progress / status 를 함께 갱신
-- (입력창 한 곳에서 다 끝나게 하는 것이 입력률의 핵심)
create or replace function page_updates_sync_page()
returns trigger
language plpgsql
as $$
begin
  update pages
     set progress = coalesce(new.progress_snapshot, progress),
         status   = coalesce(new.status_snapshot, status),
         updated_at = now()
   where id = new.page_id
     and type = 'task';
  return new;
end;
$$;

create trigger page_updates_sync
  after insert on page_updates
  for each row execute function page_updates_sync_page();


-- -------------------------------------------------------------
-- comments
--   스레드 1단계만 허용(parent_id). 무한 대댓글은 파일럿에서 불필요.
-- -------------------------------------------------------------
create table comments (
  id           uuid primary key default gen_random_uuid(),
  page_id      uuid not null references pages(id) on delete cascade,
  parent_id    uuid references comments(id) on delete cascade,
  author_id    uuid not null references profiles(id),
  body         jsonb not null,                -- BlockNote inline JSON (멘션 노드 포함)
  body_text    text not null,                 -- 알림 미리보기 / 검색용 평문
  resolved_at  timestamptz,
  resolved_by  uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index comments_page_idx on comments (page_id, created_at);
create index comments_open_idx on comments (page_id) where resolved_at is null;

create trigger comments_updated_at
  before update on comments
  for each row execute function set_updated_at();
