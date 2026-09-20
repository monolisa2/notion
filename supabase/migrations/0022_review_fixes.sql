-- =============================================================
-- 0022 — 코드 리뷰에서 나온 DB 문제 두 가지
--
-- (1) [보안] 공지 알림 대상 명단이 아무에게나 열려 있었다
--     notice_audience / notice_pending_count 는 security definer 인데
--     **호출자가 그 페이지를 볼 수 있는지 검사하지 않았다.**
--     재현: 재무실 사람이 인사관리실 '소속' 공지의 대상 2명을 그대로 조회.
--     페이지는 못 보는데 "그 공지가 존재하고 누구를 대상으로 하는지" 가 새어 나간다.
--     → notify_notice 와 같은 기준으로 권한을 검사한다.
--
-- (2) 저장 공간 표시가 첨부만 세고 있었다
--     0018 에서 만든 avatars 버킷도 같은 1GB 무료 한도를 쓰는데 집계에서 빠져 있어,
--     프로필 사진이 쌓이면 막대는 초록인데 업로드가 실패하게 된다.
--     → 우리가 쓰는 버킷 전체를 센다.
-- =============================================================

-- -------------------------------------------------------------
-- (1) 공지 대상 조회에도 열람 권한 검사
-- -------------------------------------------------------------
create or replace function can_view_page(p_page uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from pages p
     where p.id = p_page
       and (
         p.visibility = '본부'
         or (p.visibility = '소속' and (can_view_unit(p.unit_id) or is_admin()))
         or (p.visibility = '개인' and p.owner_id = auth.uid())
       )
  );
$$;

create or replace function notice_audience(p_page uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select pr.id
    from profiles pr, pages p
   where p.id = p_page
     -- 못 보는 페이지의 대상 명단은 알려 주지 않는다
     and can_view_page(p_page)
     and pr.deactivated_at is null
     and pr.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
     and (
       p.visibility = '본부'
       or (p.visibility = '소속' and user_can_view_unit(pr.id, p.unit_id))
     );
$$;

-- notice_pending_count 는 notice_audience 를 쓰므로 자동으로 막히지만,
-- "0 명" 과 "권한 없음" 이 같아 보이지 않도록 명시한다.
create or replace function notice_pending_count(p_page uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case when not can_view_page(p_page) then 0 else (
    select count(*)::int
      from notice_audience(p_page) a(uid)
     where not exists (
       select 1 from notifications n
        where n.recipient_id = a.uid
          and n.kind = 'notice'
          and n.page_id = p_page
          and (n.created_at at time zone 'Asia/Seoul')::date
              = (now() at time zone 'Asia/Seoul')::date
     )
  ) end;
$$;

-- -------------------------------------------------------------
-- (2) 저장 공간: 우리가 쓰는 버킷 전체
-- -------------------------------------------------------------
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
  if exists (select 1 from information_schema.tables
              where table_schema = 'storage' and table_name = 'objects') then
    execute $q$
      select coalesce(sum((metadata->>'size')::bigint), 0)
        from storage.objects
       where bucket_id in ('attachments', 'avatars')
    $q$ into n;
  end if;
  return n;
end;
$$;

grant execute on function can_view_page(uuid) to authenticated;
