-- =============================================================
-- 0009_collections_search_storage.sql
-- 양식 태그·일정 날짜·공지 고정·검색 텍스트·보관 복구·파일 저장소
--
--   pages.template    어떤 양식으로 만들었는지 ('blank','meeting','task','notice','weekly') → 모아보기
--   pages.event_date  회의 일시 / 주간 정리 기준일 → 캘린더 (업무는 due_date)
--   pages.pinned      공지 고정 (관리자만 변경)
--   pages.search_text 제목 + 본문 평문 (트리거) → 검색
--   restore_page()    보관 취소 (후손 포함)
--   storage.attachments 버킷 50MB (Supabase 에서만)
-- =============================================================

alter table pages
  add column template    text check (template in ('blank','meeting','task','notice','weekly')),
  add column event_date  date,
  add column pinned      boolean not null default false,
  add column search_text text;

create index pages_template_idx on pages (template, event_date desc) where archived_at is null;
create index pages_event_idx    on pages (event_date) where archived_at is null and event_date is not null;
create index pages_pinned_idx   on pages (pinned) where pinned and archived_at is null;
-- 검색: 팀 규모라 ilike 로 충분. trigram 확장을 켜면 더 빠르다 (0006 이 pg_trgm 을 켬)
create index pages_search_idx   on pages using gin (to_tsvector('simple', coalesce(search_text, '')));

-- 기존 업무 페이지에 template 표시
update pages set template = 'task' where type = 'task' and template is null;

-- -------------------------------------------------------------
-- 본문(BlockNote JSON) 의 모든 text 를 뽑아 search_text 에 넣는다
-- -------------------------------------------------------------
create or replace function pages_build_search_text()
returns trigger
language plpgsql
as $$
declare
  body text;
begin
  select string_agg(t #>> '{}', ' ')
    into body
    from jsonb_path_query(coalesce(new.content, '[]'::jsonb), 'strict $.**.text') t;
  new.search_text := left(coalesce(new.title, '') || ' ' || coalesce(body, ''), 20000);
  return new;
end;
$$;

create trigger pages_search_biu
  before insert or update of title, content on pages
  for each row execute function pages_build_search_text();

-- 기존 행 채우기
update pages set title = title;

-- -------------------------------------------------------------
-- 공지 고정은 관리자만
-- -------------------------------------------------------------
create or replace function pages_guard_pinned()
returns trigger
language plpgsql
as $$
begin
  if new.pinned is distinct from old.pinned and not is_admin() then
    raise exception '공지 고정은 관리자만 할 수 있습니다';
  end if;
  return new;
end;
$$;

create trigger pages_pinned_bupd
  before update of pinned on pages
  for each row
  when (auth.uid() is not null)
  execute function pages_guard_pinned();

-- -------------------------------------------------------------
-- 검색 (제목 + 본문). 보이는 페이지만 (RLS 는 pages 에 적용됨)
-- -------------------------------------------------------------
create or replace function search_pages(p_q text, p_limit int default 30)
returns table (
  id uuid, title text, icon text, type text, template text, unit_id uuid,
  visibility text, updated_at timestamptz, snippet text
)
language sql
stable
security invoker
as $$
  select
    p.id, p.title, p.icon, p.type, p.template, p.unit_id, p.visibility, p.updated_at,
    -- 첫 매치 주변 80자
    case
      when position(lower(p_q) in lower(coalesce(p.search_text, ''))) > 0 then
        substr(p.search_text,
               greatest(1, position(lower(p_q) in lower(p.search_text)) - 40),
               160)
      else left(p.search_text, 160)
    end as snippet
  from pages p
  where p.archived_at is null
    and length(trim(p_q)) > 0
    and p.search_text ilike '%' || p_q || '%'
  order by (p.title ilike '%' || p_q || '%') desc, p.updated_at desc
  limit p_limit;
$$;

-- -------------------------------------------------------------
-- 보관 취소: 페이지와 후손 전체 (같은 시점에 함께 보관된 것)
-- -------------------------------------------------------------
create or replace function restore_page(p_id uuid)
returns int
language plpgsql
security invoker
as $$
declare
  v_path ltree;
  v_at   timestamptz;
  n int;
begin
  select path, archived_at into v_path, v_at from pages where id = p_id;
  if v_path is null then
    raise exception '페이지를 찾을 수 없습니다';
  end if;
  update pages
     set archived_at = null
   where path <@ v_path
     and (id = p_id or archived_at = v_at);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- 보관함 조회: 보관된 것 중 "보관 묶음의 최상위" (부모가 없거나 부모는 보관되지 않은 것)
create or replace view v_trash
with (security_invoker = true) as
select p.id, p.title, p.icon, p.type, p.unit_id, p.visibility, p.archived_at, p.created_by,
       (select count(*) from pages c where c.path <@ p.path and c.id <> p.id and c.archived_at = p.archived_at) as descendants
from pages p
where p.archived_at is not null
  and (p.parent_id is null
       or not exists (select 1 from pages q where q.id = p.parent_id and q.archived_at = p.archived_at))
order by p.archived_at desc;

-- 보관된 페이지도 보관함에서 보이도록 select 정책은 그대로(archived 조건 없음).
-- 삭제(영구)는 작성자·관리자만 — 기존 pages_delete 정책.

-- -------------------------------------------------------------
-- 사이드바 트리 뷰: 양식·고정 컬럼 추가
-- -------------------------------------------------------------
create or replace view v_page_tree
with (security_invoker = true) as
select
  p.id, p.parent_id, p.depth, p.type, p.icon, p.title, p.status, p.sort_order, p.path,
  exists (select 1 from pages c where c.parent_id = p.id and c.archived_at is null) as has_children,
  p.unit_id, p.visibility, p.owner_id,
  p.template, p.pinned, p.event_date, p.due_date, p.updated_at
from pages p
where p.archived_at is null
order by p.path;

-- -------------------------------------------------------------
-- 파일 저장소 (Supabase 에서만 실행됨. 로컬 PostgreSQL 은 건너뜀)
--   버킷 attachments · 파일당 50MB (무료 플랜 상한) · 로그인 사용자 읽기/쓰기, 삭제는 올린 사람·관리자
--   경로 규칙: <page_id>/<uuid>-<파일명>
-- -------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('attachments', 'attachments', false, 52428800)
    on conflict (id) do update set file_size_limit = excluded.file_size_limit, public = false;

    execute $p$ create policy "attachments_read" on storage.objects
      for select to authenticated using (bucket_id = 'attachments') $p$;
    execute $p$ create policy "attachments_insert" on storage.objects
      for insert to authenticated with check (bucket_id = 'attachments' and owner = auth.uid()) $p$;
    execute $p$ create policy "attachments_delete" on storage.objects
      for delete to authenticated using (bucket_id = 'attachments' and (owner = auth.uid() or public.is_admin())) $p$;
  else
    raise notice 'storage 스키마가 없어 버킷 생성을 건너뜁니다 (Supabase 에서는 실행됨)';
  end if;
end $$;

-- 첨부 파일 총 용량 (관리자 화면 표시용). storage 스키마가 없으면 0
create or replace function storage_usage_bytes()
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n bigint := 0;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    execute $q$ select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects where bucket_id = 'attachments' $q$ into n;
  end if;
  return n;
end;
$$;
