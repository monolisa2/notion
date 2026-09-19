-- =============================================================
-- 0013 — 업무 참여자(다중 담당) + 진행 로그 답글
--   - 담당자(assignee)는 1명 유지(책임자, 대시보드 집계 기준).
--     함께 하는 사람은 page_people 로 여러 명 표시·선택한다.
--   - 진행 로그(page_updates)에 답글: comments.update_id 로 특정 로그에 단다.
--     페이지 댓글(update_id null)과 같은 테이블·같은 RLS 를 쓴다.
-- =============================================================

create table page_people (
  page_id  uuid not null references pages(id) on delete cascade,
  user_id  uuid not null references profiles(id) on delete cascade,
  added_by uuid references profiles(id) on delete set null,
  primary key (page_id, user_id)
);

create index page_people_user_idx on page_people (user_id);

alter table page_people enable row level security;

-- 페이지가 보이면(pages RLS) 참여자도 보이고 편집할 수 있다 (소규모 본부 기준)
create policy page_people_select on page_people
  for select to authenticated
  using (exists (select 1 from pages p where p.id = page_people.page_id));
create policy page_people_insert on page_people
  for insert to authenticated
  with check (exists (select 1 from pages p where p.id = page_people.page_id));
create policy page_people_delete on page_people
  for delete to authenticated
  using (exists (select 1 from pages p where p.id = page_people.page_id));

-- 진행 로그 답글
alter table comments add column update_id uuid references page_updates(id) on delete cascade;
create index comments_update_idx on comments (update_id) where update_id is not null;
