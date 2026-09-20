-- =============================================================
-- 0020 — 조직 멘션 (@인사관리실, @경영관리본부)
--
-- 결정 변경: 0000~0019 까지 "@팀전체 그룹 멘션 금지" 였으나
--            "알림은 한 번에 보낼 수 있어야 한다"는 판단으로 연다 (2026-09-20).
--
-- 어떻게 폭탄이 되지 않게 하는가
--   1. 대상은 **그 페이지를 실제로 볼 수 있는 사람**뿐.
--      pages_select 와 같은 규칙 — 못 보는 페이지의 알림을 받으면 눌러도 안 열린다.
--   2. 조직을 고르면 **하위 조직까지** 펼친다 (본부 → 실 → 팀).
--   3. 이미 멘션된 사람에게 다시 알림이 가지 않는다.
--      sync_page_mentions 가 차집합(새로 생긴 멘션)만 처리하므로,
--      저장할 때마다 같은 사람에게 반복 발송되지 않는다.
--   4. 본인 제외·5분 묶음·수신 설정은 enqueue_notification 이 그대로 적용한다.
--
-- 저장 형태는 이름이 아니라 unit id (props.unitId). 조직명이 바뀌어도 안 깨진다.
-- =============================================================

-- 조직(하위 포함) 구성원 중, 이 페이지를 볼 수 있는 사람
--   returns table 로 (구성원, 어느 조직에서 왔는지) 를 같이 돌려준다 —
--   알림 미리보기 문장을 조직별로 붙이기 위해.
create or replace function expand_unit_mention(p_page uuid, p_units uuid[])
returns table (user_id uuid, unit_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with recursive seed as (
    select o.id as root_id, o.id
      from org_units o
     where o.id = any(p_units)
  ),
  sub as (
    select root_id, id from seed
    union all
    select s.root_id, o.id
      from org_units o
      join sub s on o.parent_id = s.id
  )
  select distinct pr.id, s.root_id
    from profiles pr
    join sub s on s.id = pr.unit_id
    join pages p on p.id = p_page
   where pr.deactivated_at is null
     and (
       p.visibility = '본부'
       or (p.visibility = '소속' and user_can_view_unit(pr.id, p.unit_id))
       or (p.visibility = '개인' and pr.id = p.owner_id)
     );
$$;

grant execute on function expand_unit_mention(uuid, uuid[]) to authenticated;
