-- =============================================================
-- 0014 — 부모 업무 진행률 자동 계산
--   하위 업무(type='task', 보관 안 됨)가 있는 업무의 진행률은
--   하위 업무 진행률의 평균으로 자동 계산된다.
--   하위가 없는 업무만 손으로 조정한다 (화면에서도 슬라이더를 잠근다).
--   변경은 위로 전파된다 (하위 → 부모 → 조부모 …).
-- =============================================================

create or replace function pages_rollup_progress()
returns trigger
language plpgsql
as $$
declare
  v_parents uuid[] := '{}';
  v_pid     uuid;
  v_avg     int;
begin
  if tg_op in ('INSERT', 'UPDATE') and new.parent_id is not null then
    v_parents := array_append(v_parents, new.parent_id);
  end if;
  if tg_op in ('DELETE', 'UPDATE') and old.parent_id is not null
     and (tg_op = 'DELETE' or old.parent_id is distinct from new.parent_id) then
    v_parents := array_append(v_parents, old.parent_id);
  end if;

  foreach v_pid in array v_parents loop
    select round(avg(progress))::int into v_avg
      from pages
     where parent_id = v_pid and type = 'task' and archived_at is null;
    if v_avg is not null then
      -- 값이 실제로 바뀔 때만 갱신 → 이 UPDATE 가 다시 이 트리거를 태워 위로 전파된다
      update pages
         set progress = v_avg
       where id = v_pid and type = 'task' and progress is distinct from v_avg;
    end if;
  end loop;
  return null;
end;
$$;

create trigger pages_rollup_aiud
  after insert or delete or update of progress, parent_id, archived_at, type on pages
  for each row execute function pages_rollup_progress();

-- 기존 데이터 1회 정리: 하위 업무가 있는 업무의 진행률을 평균으로 맞춘다
update pages p
   set progress = sub.avg_progress
  from (
    select parent_id, round(avg(progress))::int as avg_progress
      from pages
     where type = 'task' and archived_at is null and parent_id is not null
     group by parent_id
  ) sub
 where p.id = sub.parent_id
   and p.type = 'task'
   and p.progress is distinct from sub.avg_progress;
