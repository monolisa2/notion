\set ON_ERROR_STOP on
\pset pager off

-- ============ 사용자 3명 ============
insert into auth.users (id, email, raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','min@co.kr','{"full_name":"신민철"}'),
 ('22222222-2222-2222-2222-222222222222','ok@co.kr','{"full_name":"옥미영"}'),
 ('33333333-3333-3333-3333-333333333333','nam@co.kr','{"full_name":"남현석"}');

update profiles set naverworks_id = 'nw_' || left(id::text,4);

\echo '--- 1) profiles 자동 생성 (handle_new_user 트리거)'
select name, email, naverworks_id from profiles order by name;

-- ============ 무한 중첩 ============
\echo '--- 2) 4단계 중첩 + path 자동 생성'
insert into pages (id, title, type, created_by) values
 ('aaaaaaaa-0000-0000-0000-000000000001','10월 합병 준비','doc','11111111-1111-1111-1111-111111111111');

insert into pages (id, parent_id, title, type, created_by) values
 ('aaaaaaaa-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','급여체계 통합','doc','11111111-1111-1111-1111-111111111111');

insert into pages (id, parent_id, title, type, status, assignee_id, progress, due_date, created_by) values
 ('aaaaaaaa-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000002','4사 급여일 통일안 작성','task','진행','22222222-2222-2222-2222-222222222222',40,current_date + 2,'11111111-1111-1111-1111-111111111111');

insert into pages (id, parent_id, title, type, created_by) values
 ('aaaaaaaa-0000-0000-0000-000000000004','aaaaaaaa-0000-0000-0000-000000000003','참고: 노무사 의견서','doc','11111111-1111-1111-1111-111111111111');

select depth, repeat('  ', depth) || title as tree, nlevel(path) as levels
  from pages order by path;

\echo '--- 3) 부모 변경 시 후손 path 일괄 재작성'
-- 3번(업무)을 루트 아래로 옮기면 4번(참고문서)도 따라와야 한다
update pages set parent_id = 'aaaaaaaa-0000-0000-0000-000000000001'
 where id = 'aaaaaaaa-0000-0000-0000-000000000003';

select depth, repeat('  ', depth) || title as tree from pages order by path;

\echo '--- 4) 순환 이동 차단 (부모를 자기 후손 아래로)'
do $$
begin
  update pages set parent_id = 'aaaaaaaa-0000-0000-0000-000000000004'
   where id = 'aaaaaaaa-0000-0000-0000-000000000003';
  raise notice 'FAIL: 순환이 허용되었다';
exception when others then
  raise notice 'PASS: %', sqlerrm;
end $$;

\echo '--- 5) sort_order 중간값 끼워넣기'
insert into pages (id, parent_id, title, type, created_by, sort_order) values
 ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','A','doc','11111111-1111-1111-1111-111111111111',1000),
 ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','B','doc','11111111-1111-1111-1111-111111111111',2000),
 ('bbbbbbbb-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','C','doc','11111111-1111-1111-1111-111111111111',3000);
-- C 를 A 바로 뒤로
select move_page('bbbbbbbb-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001') as new_order;
select title, sort_order from pages
 where parent_id = 'aaaaaaaa-0000-0000-0000-000000000001' and title in ('A','B','C')
 order by sort_order;

\echo '--- 6) doc 에 업무 속성 넣으면 거부 (pages_task_shape)'
do $$
begin
  insert into pages (title, type, progress, created_by)
  values ('잘못된 문서','doc',50,'11111111-1111-1111-1111-111111111111');
  raise notice 'FAIL: 제약이 안 걸렸다';
exception when check_violation then
  raise notice 'PASS: check 제약 작동';
end $$;

-- ============ 진행 로그 ============
\echo '--- 7) 진행 로그 INSERT 만으로 pages.progress/status 동기화'
insert into page_updates (page_id, author_id, content, progress_snapshot, status_snapshot)
values ('aaaaaaaa-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222',
        '4사 급여일 현황 취합 완료, 1안 초안 작성 중', 65, '진행');

select title, status, progress from pages where id='aaaaaaaa-0000-0000-0000-000000000003';

\echo '--- 8) blocker 기록 → v_blocked_tasks 노출'
insert into page_updates (page_id, author_id, content, progress_snapshot, blocker)
values ('aaaaaaaa-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222',
        '노무사 검토 요청', 70, '권세웅 노무사 회신 대기');
select title, blocker, progress from v_blocked_tasks;

-- ============ 멘션 diff 동기화 ============
\echo '--- 9) 멘션 최초 동기화 (민철 → 미영, 현석)'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select sync_page_mentions(
  'aaaaaaaa-0000-0000-0000-000000000003',
  '11111111-1111-1111-1111-111111111111',
  array['22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333']::uuid[],
  '{"22222222-2222-2222-2222-222222222222":"@옥미영 급여일 1안으로 갑니다","33333333-3333-3333-3333-333333333333":"@남현석 확인 부탁"}'::jsonb
) as new_mentions;

select p.name as mentioned, m.context from mentions m join profiles p on p.id=m.mentioned_id order by p.name;

\echo '--- 10) 미영이 알림을 읽음 처리'
update mentions set read_at = now() where mentioned_id='22222222-2222-2222-2222-222222222222';
update notifications set read_at = now() where recipient_id='22222222-2222-2222-2222-222222222222';

\echo '--- 11) 재저장(미영 유지 + 현석 삭제) → 미영의 read_at 이 보존되어야 함'
select sync_page_mentions(
  'aaaaaaaa-0000-0000-0000-000000000003',
  '11111111-1111-1111-1111-111111111111',
  array['22222222-2222-2222-2222-222222222222']::uuid[],
  '{"22222222-2222-2222-2222-222222222222":"@옥미영 급여일 1안으로 갑니다"}'::jsonb
) as new_mentions;

select p.name as mentioned,
       (m.read_at is not null) as 읽음유지
  from mentions m join profiles p on p.id=m.mentioned_id;
-- 기대: 미영 1건, 읽음유지=true / 현석 행은 사라짐

\echo '--- 12) 자기 자신 멘션 → 알림 없음'
select sync_page_mentions(
  'aaaaaaaa-0000-0000-0000-000000000002',
  '11111111-1111-1111-1111-111111111111',
  array['11111111-1111-1111-1111-111111111111']::uuid[]
) as new_mentions;
select count(*) as 민철에게_간_알림 from notifications where recipient_id='11111111-1111-1111-1111-111111111111';
-- 기대: 0

\echo '--- 13) 5분 내 같은 페이지 반복 멘션 → 1건으로 묶임'
insert into pages (id, title, type, created_by) values
 ('cccccccc-0000-0000-0000-000000000001','반복저장 테스트','doc','11111111-1111-1111-1111-111111111111');
select sync_page_mentions('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
  array['33333333-3333-3333-3333-333333333333']::uuid[]);
-- 멘션을 지웠다가 다시 추가 (타이핑 중 저장 반복 상황)
select sync_page_mentions('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', array[]::uuid[]);
select sync_page_mentions('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
  array['33333333-3333-3333-3333-333333333333']::uuid[]);
select count(*) as 현석_알림건수 from notifications
 where recipient_id='33333333-3333-3333-3333-333333333333' and page_id='cccccccc-0000-0000-0000-000000000001';
-- 기대: 1

\echo '--- 14) 수신 거부 설정 존중'
update profiles set notify_mention = false where id='33333333-3333-3333-3333-333333333333';
insert into pages (id, title, type, created_by) values
 ('cccccccc-0000-0000-0000-000000000002','수신거부 테스트','doc','11111111-1111-1111-1111-111111111111');
select sync_page_mentions('cccccccc-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',
  array['33333333-3333-3333-3333-333333333333']::uuid[]);
select count(*) as 알림 from notifications where page_id='cccccccc-0000-0000-0000-000000000002';
-- 기대: 0
update profiles set notify_mention = true where id='33333333-3333-3333-3333-333333333333';

\echo '--- 15) 담당자 지정 알림 (멘션과 문구 분리)'
update pages set assignee_id='33333333-3333-3333-3333-333333333333'
 where id='aaaaaaaa-0000-0000-0000-000000000003';
select kind, title from notifications where kind='assigned';

-- ============ 대시보드 뷰 ============
\echo '--- 16) 정체 업무 감지 (3일 이상 무업데이트)'
insert into pages (id, title, type, status, assignee_id, progress, created_by, created_at) values
 ('dddddddd-0000-0000-0000-000000000001','정체된 업무','task','진행',
  '22222222-2222-2222-2222-222222222222',30,'11111111-1111-1111-1111-111111111111', now() - interval '9 days');
select title, stale_days, assignee_name from v_stale_tasks order by stale_days desc;

\echo '--- 17) 기한 리스크'
insert into pages (id, title, type, status, assignee_id, due_date, progress, created_by) values
 ('dddddddd-0000-0000-0000-000000000002','기한 초과 업무','task','진행','33333333-3333-3333-3333-333333333333',current_date-3,20,'11111111-1111-1111-1111-111111111111'),
 ('dddddddd-0000-0000-0000-000000000003','오늘 마감','task','검토','22222222-2222-2222-2222-222222222222',current_date,90,'11111111-1111-1111-1111-111111111111');
select title, days_left, risk_level, assignee_name from v_due_risk order by due_date;

\echo '--- 18) 담당자별 요약'
select name, open_count, in_progress, overdue, avg_progress from v_assignee_summary order by name;

\echo '--- 19) 완료 처리 시 completed_at / progress=100 자동'
update pages set status='완료' where id='dddddddd-0000-0000-0000-000000000003';
select title, status, progress, (completed_at is not null) as 완료시각기록
  from pages where id='dddddddd-0000-0000-0000-000000000003';

\echo '--- 20) 주간보고 원문 추출'
select author_name, page_title, assignee_name, progress, updates, blockers from weekly_digest(7);
\echo '--- 20b) 미입력자 탐지'
select name, open_tasks, last_log_at from silent_members(7);

\echo '--- 21) 활동 피드'
select author_name, page_title, content, progress_snapshot from v_activity_feed limit 5;

-- ============ RLS ============
\echo '--- 22) RLS: 남의 알림은 안 보인다'
grant usage on schema public, auth to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public, auth to authenticated;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select count(*) as 미영이_보는_알림 from notifications;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select count(*) as 현석이_보는_알림 from notifications;
reset role;

\echo '--- 23) RLS: 진행 로그 수정/삭제 정책이 아예 없어야 함 (append-only)'
select count(*) as page_updates_write_policies
  from pg_policies
 where tablename='page_updates' and cmd in ('UPDATE','DELETE');
-- 기대: 0

\echo '--- 24) 모든 뷰에 security_invoker 적용 확인'
select c.relname,
       coalesce((select option_value from pg_options_to_table(c.reloptions)
                  where option_name='security_invoker'),'없음') as security_invoker
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where c.relkind='v' and n.nspname='public'
 order by c.relname;
