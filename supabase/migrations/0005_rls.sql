-- =============================================================
-- 0005_rls.sql
-- RLS + Realtime
--
-- 파일럿 정책: "팀 전원 공유"가 기본.
--   읽기  → 로그인한 사람 전부
--   쓰기  → 로그인한 사람 전부 (협업 도구의 본질)
--   수정/삭제 → 작성자 또는 관리자
--   알림/멘션 → 본인 것만
--
-- 비공개 페이지가 필요해지면 pages.visibility 컬럼과
-- page_members 테이블을 나중에 얹는다. 지금은 넣지 않는다.
-- =============================================================

alter table profiles       enable row level security;
alter table org_snapshots  enable row level security;
alter table pages          enable row level security;
alter table page_updates   enable row level security;
alter table comments       enable row level security;
alter table mentions       enable row level security;
alter table notifications  enable row level security;


-- 관리자 판별 (RLS 안에서 profiles 를 다시 읽으면 재귀가 걸리므로
--  security definer 함수로 우회한다)
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;


-- -------------------------------------------------------------
-- profiles : 전원 조회, 본인만 수정
-- -------------------------------------------------------------
create policy profiles_select on profiles
  for select to authenticated
  using (true);

create policy profiles_insert_self on profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update_self on profiles
  for update to authenticated
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());


-- -------------------------------------------------------------
-- org_snapshots : 전원 조회, 관리자만 편집
-- -------------------------------------------------------------
create policy org_select on org_snapshots
  for select to authenticated using (true);

create policy org_write on org_snapshots
  for all to authenticated
  using (is_admin()) with check (is_admin());


-- -------------------------------------------------------------
-- pages : 전원 조회/생성, 수정은 전원(협업), 삭제는 작성자·관리자
-- -------------------------------------------------------------
create policy pages_select on pages
  for select to authenticated
  using (true);

create policy pages_insert on pages
  for insert to authenticated
  with check (created_by = auth.uid());

create policy pages_update on pages
  for update to authenticated
  using (archived_at is null or is_admin())
  with check (true);

create policy pages_delete on pages
  for delete to authenticated
  using (created_by = auth.uid() or is_admin());


-- -------------------------------------------------------------
-- page_updates : append-only. 조회는 전원, 작성은 본인 명의로만.
--   수정/삭제 정책을 아예 만들지 않음 → 로그 위조 불가
--   (오기재는 새 로그로 정정하게 한다)
-- -------------------------------------------------------------
create policy page_updates_select on page_updates
  for select to authenticated using (true);

create policy page_updates_insert on page_updates
  for insert to authenticated
  with check (author_id = auth.uid());


-- -------------------------------------------------------------
-- comments : 조회 전원, 작성 본인, 수정·삭제 본인·관리자
-- -------------------------------------------------------------
create policy comments_select on comments
  for select to authenticated using (true);

create policy comments_insert on comments
  for insert to authenticated
  with check (author_id = auth.uid());

create policy comments_update on comments
  for update to authenticated
  using (author_id = auth.uid() or is_admin())
  with check (author_id = auth.uid() or is_admin());

create policy comments_delete on comments
  for delete to authenticated
  using (author_id = auth.uid() or is_admin());


-- -------------------------------------------------------------
-- mentions : 언급당한 사람 또는 언급한 사람만
-- -------------------------------------------------------------
create policy mentions_select on mentions
  for select to authenticated
  using (mentioned_id = auth.uid() or author_id = auth.uid());

create policy mentions_write on mentions
  for all to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());


-- -------------------------------------------------------------
-- notifications : 본인 수신분만. 생성은 함수(security definer)가 담당.
-- -------------------------------------------------------------
create policy notifications_select on notifications
  for select to authenticated
  using (recipient_id = auth.uid());

create policy notifications_update on notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());


-- -------------------------------------------------------------
-- Realtime
--   팀 단위 인원이므로 postgres_changes 로 충분하다.
--   전사 확장 시에는 broadcast 채널로 교체할 것.
-- -------------------------------------------------------------
alter publication supabase_realtime add table pages;
alter publication supabase_realtime add table page_updates;
alter publication supabase_realtime add table comments;
alter publication supabase_realtime add table notifications;

-- 업데이트 이벤트에서 변경 전 값을 받으려면 필요
alter table pages replica identity full;


-- -------------------------------------------------------------
-- auth.users 생성 시 profiles 자동 생성
-- -------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name',
             new.raw_user_meta_data ->> 'name',
             split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
