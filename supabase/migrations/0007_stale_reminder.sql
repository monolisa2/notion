-- =============================================================
-- 0007_stale_reminder.sql
-- 미입력 리마인드 — 평일 17:30(KST) 에 오늘 진행 로그를 한 건도 안 올린 담당자에게
-- kind='stale' 알림을 큐에 넣는다. 발송은 Phase 5 (push-notifications) 가 한다.
--
--   - 대상: 진행 중(대기/진행/검토) 업무를 가진 활성 사용자 중 오늘(KST) page_updates 0건
--   - enqueue_notification 을 통해서만 생성 → notify_due=false 면 자동으로 건너뛴다
--   - dedupe_key 'stale:<날짜>' — enqueue_notification 의 5분 묶음 창 안에서 재실행돼도 중복 없음.
--     하루 1회 cron 이므로 그 이상은 필요 없다
--   - 문구는 압박하지 않고 가볍게
-- =============================================================

create or replace function enqueue_daily_reminders(p_today date default null)
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
    select
      pr.id                                          as profile_id,
      count(p.id)                                    as open_tasks,
      -- 딥링크용: 가장 오래 손대지 않은 업무 하나
      (array_agg(p.id order by p.updated_at asc))[1] as page_id
    from profiles pr
    join pages p
      on p.assignee_id = pr.id
     and p.type = 'task'
     and p.archived_at is null
     and p.status in ('대기','진행','검토')
    where pr.deactivated_at is null
      and not exists (
        select 1
          from page_updates u
         where u.author_id = pr.id
           and (u.created_at at time zone 'Asia/Seoul')::date = v_today
      )
    group by pr.id
  loop
    v_id := enqueue_notification(
      p_recipient  => r.profile_id,
      p_actor      => null,
      p_kind       => 'stale',
      p_page_id    => r.page_id,
      p_title      => format('오늘 진행 상황을 한 줄 남겨주세요 (진행 중 업무 %s건)', r.open_tasks),
      p_preview    => '⌃⇧L 또는 사이드바 "진행 로그 남기기"에서 30초면 됩니다',
      p_dedupe_key => 'stale:' || v_today::text
    );
    if v_id is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

comment on function enqueue_daily_reminders(date) is
  '오늘(KST) 진행 로그를 안 남긴 담당자에게 stale 알림을 큐에 넣는다. pg_cron 이 평일 17:30 KST 에 호출.';

-- 사용자가 직접 호출할 이유는 없다. 서버(cron)만 실행.
revoke execute on function enqueue_daily_reminders(date) from public, anon, authenticated;

-- -------------------------------------------------------------
-- pg_cron 스케줄 (Supabase 에서만 존재. 로컬 PostgreSQL 에서는 조용히 건너뛴다)
--   평일 17:30 KST = 08:30 UTC  →  '30 8 * * 1-5'
-- -------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'teamhub-daily-stale-reminder';
    perform cron.schedule(
      'teamhub-daily-stale-reminder',
      '30 8 * * 1-5',
      $job$ select public.enqueue_daily_reminders(); $job$
    );
  else
    raise notice 'pg_cron 이 없어 스케줄을 건너뜁니다 (Supabase 에서는 자동 등록됨)';
  end if;
end $$;
