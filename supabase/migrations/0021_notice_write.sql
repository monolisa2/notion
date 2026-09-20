-- =============================================================
-- 0021 — 공지 바로 쓰기 + 고정 권한 구멍 메우기
--
-- (1) 권한 구멍
--     0009 의 pages_guard_pinned 는 `before update of pinned` 뿐이라
--     **INSERT 로는 누구나 pinned = true 인 페이지를 만들 수 있었다.**
--     그러면 관리자가 아니어도 전원의 홈 상단에 글을 올릴 수 있다.
--     → INSERT 에도 같은 검사를 건다.
--
-- (2) 공지 화면에서 바로 쓰기
--     지금까지는 "공간에서 페이지 만들기 → 공지 양식 → ⋯ 메뉴에서 고정" 이었다.
--     공지 화면의 "＋ 공지 쓰기" 는 관리자면 처음부터 pinned = true 로 넣는다.
--     (1) 의 검사가 있으므로 관리자가 아니면 DB 가 막는다 — 화면을 믿지 않는다.
-- =============================================================

create or replace function pages_guard_pinned_ins()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.pinned, false) and not is_admin() then
    raise exception '공지 고정은 관리자만 할 수 있습니다';
  end if;
  return new;
end;
$$;

drop trigger if exists pages_pinned_bins on pages;
create trigger pages_pinned_bins
  before insert on pages
  for each row
  when (auth.uid() is not null)          -- 서버(service role) 호출은 통과
  execute function pages_guard_pinned_ins();
