-- =============================================================
-- 0018 — 본문 버전 기록(되돌리기) + 프로필 사진 버킷
--
--  (1) page_snapshots
--      자동 저장이라 실수로 본문을 지우고 저장하면 되돌릴 방법이 없었다.
--      "지운 페이지"는 보관함에서 복구되지만 "지워진 본문"은 복구되지 않는다.
--      → 본문이 바뀔 때 **바뀌기 직전 내용**을 스냅샷으로 남긴다.
--
--      기록 시점 (아래 중 하나라도 해당하면 기록):
--        · 이 페이지의 마지막 스냅샷이 10분보다 오래됨   (편집 세션당 1개꼴)
--        · 마지막 스냅샷을 만든 사람과 지금 저장하는 사람이 다름
--          (남의 글을 조용히 덮어쓰는 경우를 반드시 남긴다)
--        · 본문이 절반 이하로 줄어듦 (대량 삭제 감지 — 이 기능의 존재 이유)
--
--      보관량: 페이지당 최근 30개 / 90일. 텍스트라 용량 부담이 거의 없다.
--      append-only. 되돌리기는 pages.content 를 다시 쓰는 것이라 또 스냅샷이 남는다
--      (= 되돌리기도 되돌릴 수 있다).
--
--  (2) storage.avatars 버킷
--      프로필 사진. 2MB, 공개 읽기(사진이라 서버 컴포넌트에서 URL 그대로 쓴다).
--      경로는 <uid>/<랜덤>.<확장자> — 본인 폴더에만 쓸 수 있다.
-- =============================================================

-- -------------------------------------------------------------
-- (1) 본문 버전 기록
-- -------------------------------------------------------------
drop trigger if exists pages_snapshot_bu on pages;
drop table if exists page_snapshots cascade;

create table page_snapshots (
  id         uuid primary key default gen_random_uuid(),
  page_id    uuid not null references pages(id) on delete cascade,
  title      text not null,
  content    jsonb,
  -- 이 내용을 "밀어낸" 사람 = 다음 버전을 저장한 사람
  replaced_by uuid references profiles(id) on delete set null,
  -- now() 가 아니라 clock_timestamp(): 한 트랜잭션에서 두 번 저장돼도 순서가 뒤집히지 않는다
  created_at timestamptz not null default clock_timestamp()
);

create index page_snapshots_page_idx on page_snapshots (page_id, created_at desc);

alter table page_snapshots enable row level security;

-- 페이지가 보이면 그 페이지의 기록도 보인다 (pages RLS 가 그대로 걸린다)
create policy page_snapshots_select on page_snapshots
  for select to authenticated
  using (exists (select 1 from pages p where p.id = page_snapshots.page_id));

-- INSERT/UPDATE/DELETE 정책 없음 = 앱에서 직접 못 건드린다.
-- 기록은 아래 트리거(security definer)만, 정리도 트리거가 한다.

create or replace function pages_snapshot_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_at     timestamptz;
  v_last_by     uuid;
  v_old_len     int;
  v_new_len     int;
  v_should      boolean := false;
begin
  -- 본문이 실제로 바뀐 경우만
  if new.content is not distinct from old.content then
    return new;
  end if;

  select s.created_at, s.replaced_by
    into v_last_at, v_last_by
    from page_snapshots s
   where s.page_id = old.id
   order by s.created_at desc
   limit 1;

  v_old_len := coalesce(length(old.content::text), 0);
  v_new_len := coalesce(length(new.content::text), 0);

  if v_last_at is null or v_last_at < now() - interval '10 minutes' then
    v_should := true;                                    -- 새 편집 세션
  elsif v_last_by is distinct from auth.uid() then
    v_should := true;                                    -- 다른 사람이 덮어씀
  elsif v_old_len > 200 and v_new_len < v_old_len / 2 then
    v_should := true;                                    -- 대량 삭제
  end if;

  if not v_should then
    return new;
  end if;

  insert into page_snapshots (page_id, title, content, replaced_by)
  values (old.id, old.title, old.content, auth.uid());

  -- 정리: 페이지당 최근 30개, 90일
  delete from page_snapshots s
   where s.page_id = old.id
     and (
       s.created_at < now() - interval '90 days'
       or s.id not in (
         select s2.id from page_snapshots s2
          where s2.page_id = old.id
          order by s2.created_at desc
          limit 30
       )
     );

  return new;
end;
$$;

create trigger pages_snapshot_bu
  before update of content on pages
  for each row execute function pages_snapshot_content();

-- -------------------------------------------------------------
-- (2) 프로필 사진 버킷
-- -------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('avatars', 'avatars', true, 2 * 1024 * 1024)
    on conflict (id) do update set public = true, file_size_limit = 2 * 1024 * 1024;

    -- 두 번 실행해도 안전하게 (SQL 편집기에서 다시 돌리는 경우)
    execute $p$ drop policy if exists "avatars_read" on storage.objects $p$;
    execute $p$ drop policy if exists "avatars_insert" on storage.objects $p$;
    execute $p$ drop policy if exists "avatars_update" on storage.objects $p$;
    execute $p$ drop policy if exists "avatars_delete" on storage.objects $p$;

    execute $p$ create policy "avatars_read" on storage.objects
      for select using (bucket_id = 'avatars') $p$;
    execute $p$ create policy "avatars_insert" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
    execute $p$ create policy "avatars_update" on storage.objects
      for update to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
    execute $p$ create policy "avatars_delete" on storage.objects
      for delete to authenticated
      using (bucket_id = 'avatars'
             and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())) $p$;
  else
    raise notice 'storage 스키마가 없어 avatars 버킷 생성을 건너뜁니다 (Supabase 에서는 실행됨)';
  end if;
end $$;
