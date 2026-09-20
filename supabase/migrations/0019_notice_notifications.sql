-- =============================================================
-- 0019 — 공지 알림 보내기
--
-- 왜 필요한가
--   공지를 고정하면 홈 상단에 뜨지만, **앱을 안 열면 모른다.**
--   "밥은 먹고 다니냐" 같은 공지야 괜찮지만 마감·규정 공지는 닿아야 한다.
--
-- @팀전체 그룹 멘션과는 다른 물건이다 (그건 계속 금지)
--   · 본문에 아무나 @전체를 칠 수 있는 게 아니라,
--     **공지로 고정된 페이지**에서 **작성자·관리자만** 누르는 버튼이다
--   · 받는 사람은 그 페이지를 **실제로 볼 수 있는 사람**뿐 (RLS 와 같은 규칙)
--   · 하루 한 번 (실수로 두 번 눌러도 두 번 가지 않는다)
--   · 보낸 사람 본인은 제외 (enqueue_notification 이 이미 처리)
--
-- 수신 설정(notify_*)은 따르지 않는다 — 공식 공지는 닿는 것이 목적이고,
-- 계정 화면의 알림 설정 3종(멘션·배정·기한) 어디에도 해당하지 않는다.
-- (enqueue_notification 의 `else true` 분기를 그대로 탄다 → 0003 은 손대지 않는다)
-- =============================================================

-- -------------------------------------------------------------
-- (1) 알림 종류에 'notice' 추가
-- -------------------------------------------------------------
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('mention','assigned','comment','due_soon','stale','notice'));

-- -------------------------------------------------------------
-- (2) 특정 사용자가 그 공간을 볼 수 있는가
--     can_view_unit(unit) 의 "임의의 사용자" 판
-- -------------------------------------------------------------
create or replace function user_can_view_unit(p_user uuid, p_unit uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive me as (
    select unit_id, coalesce(is_admin, false) as is_admin
      from profiles where id = p_user
  ),
  up as (
    select o.id, o.parent_id from org_units o, me where o.id = me.unit_id
    union all
    select o.id, o.parent_id from org_units o join up on o.id = up.parent_id
  ),
  down as (
    select o.id, o.parent_id from org_units o, me where o.id = me.unit_id
    union all
    select o.id, o.parent_id from org_units o join down on o.parent_id = down.id
  )
  select coalesce((select is_admin from me), false)
      or (p_unit is not null
          and exists (select 1 from (select id from up union select id from down) c
                       where c.id = p_unit));
$$;

-- -------------------------------------------------------------
-- (3) 이 공지의 알림 대상
--     pages_select 정책과 같은 규칙으로 고른다
--     (못 보는 페이지의 알림을 받으면 눌러도 안 열린다)
-- -------------------------------------------------------------
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
     and pr.deactivated_at is null
     and pr.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
     and (
       p.visibility = '본부'
       or (p.visibility = '소속' and user_can_view_unit(pr.id, p.unit_id))
     );
$$;

-- 아직 안 보낸 사람 수 (버튼 누르기 전에 "몇 명에게" 를 보여주기 위해)
create or replace function notice_pending_count(p_page uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from notice_audience(p_page) a(uid)
   where not exists (
     select 1 from notifications n
      where n.recipient_id = a.uid
        and n.kind = 'notice'
        and n.page_id = p_page
        and (n.created_at at time zone 'Asia/Seoul')::date
            = (now() at time zone 'Asia/Seoul')::date
   );
$$;

-- -------------------------------------------------------------
-- (4) 보내기
-- -------------------------------------------------------------
create or replace function notify_notice(p_page uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page  record;
  v_actor uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_count int := 0;
  v_id    uuid;
  r       record;
begin
  select p.id, p.title, p.pinned, p.visibility, p.created_by
    into v_page
    from pages p
   where p.id = p_page and p.archived_at is null;

  if v_page.id is null then
    raise exception '페이지를 찾을 수 없습니다';
  end if;
  if not coalesce(v_page.pinned, false) then
    raise exception '공지로 고정된 페이지만 알림을 보낼 수 있습니다';
  end if;
  if v_page.visibility = '개인' then
    raise exception '개인 메모는 알림을 보낼 수 없습니다';
  end if;
  if not (v_page.created_by = v_actor or is_admin()) then
    raise exception '공지 작성자와 관리자만 알림을 보낼 수 있습니다';
  end if;

  for r in
    select a.uid
      from notice_audience(p_page) a(uid)
     where not exists (
       -- 오늘 이미 받은 사람은 건너뛴다 (두 번 눌러도 두 번 가지 않게)
       select 1 from notifications n
        where n.recipient_id = a.uid
          and n.kind = 'notice'
          and n.page_id = p_page
          and (n.created_at at time zone 'Asia/Seoul')::date = v_today
     )
  loop
    v_id := enqueue_notification(
      p_recipient  => r.uid,
      p_actor      => v_actor,
      p_kind       => 'notice',
      p_page_id    => p_page,
      p_title      => v_page.title,
      p_preview    => '새 공지가 올라왔습니다',
      p_dedupe_key => 'notice:' || p_page::text || ':' || v_today::text
    );
    if v_id is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function user_can_view_unit(uuid, uuid) to authenticated;
grant execute on function notice_audience(uuid)          to authenticated;
grant execute on function notice_pending_count(uuid)     to authenticated;
grant execute on function notify_notice(uuid)            to authenticated;
