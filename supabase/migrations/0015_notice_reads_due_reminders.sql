-- =============================================================
-- 0015 — 공지 읽음 확인 + 기한 임박 알림
--   - 읽음 = 그 페이지를 연 기록(page_visits). 별도 테이블 없이 재활용.
--     현황 조회는 공지 작성자·관리자만 (security definer 로 개인 방문기록 보호를 우회하되 가드)
--   - 기한 알림: 기한 당일·3일 전 아침에 담당자에게 (진행 중 업무만).
--     미입력 리마인드(0007)와 달리 이건 스케줄을 켠다 (2026-09-19 결정)
-- =============================================================

create or replace function notice_readers(p_page uuid)
returns table (user_id uuid, name text, read_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from pages p
     where p.id = p_page
       and p.pinned
       and (p.created_by = auth.uid() or is_admin())
  ) then
    raise exception '공지 작성자와 관리자만 읽음 현황을 볼 수 있습니다';
  end if;
  return query
    select pr.id, pr.name, v.visited_at
      from profiles pr
      left join page_visits v on v.user_id = pr.id and v.page_id = p_page
     where pr.deactivated_at is null
     order by v.visited_at desc nulls last, pr.name;
end;
$$;

grant execute on function notice_readers(uuid) to authenticated;

-- -------------------------------------------------------------
-- 기한 임박 알림 (kind='due_soon' 은 0003 부터 준비되어 있음)
-- -------------------------------------------------------------
create or replace function enqueue_due_reminders(p_today date default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := coalesce(p_today, (now() at time zone 'Asia/Seoul')::date);
  v_count int := 0;
  r       record;
  v_id    uuid;
begin
  for r in
    select p.id, p.title, p.assignee_id, p.due_date
      from pages p
      join profiles pr on pr.id = p.assignee_id and pr.deactivated_at is null
     where p.type = 'task'
       and p.archived_at is null
       and status_kind(p.status) in ('대기', '진행')
       and p.due_date in (v_today, v_today + 3)
  loop
    v_id := enqueue_notification(
      p_recipient  => r.assignee_id,
      p_actor      => null,
      p_kind       => 'due_soon',
      p_page_id    => r.id,
      p_title      => case
                        when r.due_date = v_today then format('오늘이 기한입니다: %s', r.title)
                        else format('기한 3일 전: %s', r.title)
                      end,
      p_preview    => '기한 ' || r.due_date::text,
      p_dedupe_key => 'due:' || r.id::text || ':' || r.due_date::text
    );
    if v_id is not null then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

comment on function enqueue_due_reminders(date) is
  '기한 당일·3일 전 업무의 담당자에게 due_soon 알림. pg_cron 이 평일 09:00 KST 에 호출.';

revoke execute on function enqueue_due_reminders(date) from public, anon, authenticated;

-- 평일 09:00 KST = 00:00 UTC (Supabase 에서만 등록, 로컬은 건너뜀)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'teamhub-due-reminder';
    perform cron.schedule(
      'teamhub-due-reminder',
      '0 0 * * 1-5',
      $job$ select public.enqueue_due_reminders(); $job$
    );
  else
    raise notice 'pg_cron 이 없어 스케줄을 건너뜁니다 (Supabase 에서는 자동 등록됨)';
  end if;
end $$;
