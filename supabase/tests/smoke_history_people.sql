\set ON_ERROR_STOP on
\pset pager off
-- =============================================================
-- 0013 참여자 · 0018 본문 기록 · 인수인계 회귀 테스트
--   실행: 마이그레이션을 모두 적용한 빈 DB 에 이 파일 하나
-- =============================================================

-- ---- 사람 3명 (handle_new_user 트리거가 profiles 를 만든다)
insert into auth.users (id, email, raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','min@co.kr','{"full_name":"신민철"}'),
 ('22222222-2222-2222-2222-222222222222','ok@co.kr','{"full_name":"옥미영"}'),
 ('33333333-3333-3333-3333-333333333333','nam@co.kr','{"full_name":"남현석"}');

-- 조직: 본부(0008 시드) 아래 인사관리실 / 재무실
insert into org_units (id, parent_id, name, level, sort_order) values
 ('aaaa0000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','인사관리실','실',100),
 ('aaaa0000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','재무실','실',200);

update profiles set unit_id='aaaa0000-0000-4000-8000-000000000001', job_title='팀장'
 where id='11111111-1111-1111-1111-111111111111';
update profiles set unit_id='aaaa0000-0000-4000-8000-000000000001'
 where id='22222222-2222-2222-2222-222222222222';
update profiles set unit_id='aaaa0000-0000-4000-8000-000000000002', is_admin=false
 where id='33333333-3333-3333-3333-333333333333';
update profiles set is_admin=false where id='22222222-2222-2222-2222-222222222222';

-- 신민철 담당 업무 2건 (인사관리실 공간, 소속 공개)
insert into pages (id, title, type, status, progress, assignee_id, created_by, unit_id, visibility) values
 ('bbbb0000-0000-4000-8000-000000000001','급여체계 통합','task','진행',40,
  '11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111',
  'aaaa0000-0000-4000-8000-000000000001','소속'),
 ('bbbb0000-0000-4000-8000-000000000002','채용 공고 정리','task','대기',0,
  '11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111',
  'aaaa0000-0000-4000-8000-000000000001','소속');

-- 옥미영을 1번 업무의 "참여자" 로 (담당자는 아님)
insert into page_people (page_id, user_id, added_by) values
 ('bbbb0000-0000-4000-8000-000000000001','22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111');

\echo ''
\echo '=== 1) 참여자로만 들어간 사람도 "내 업무" 에서 찾을 수 있다 (I1) ==='
-- 앱의 홈 화면이 하는 것과 같은 두 갈래 조회
select
  (select count(*) from pages where type='task' and assignee_id='22222222-2222-2222-2222-222222222222')
    as 담당_건수_기대0,
  (select count(*) from page_people pp join pages p on p.id=pp.page_id
    where pp.user_id='22222222-2222-2222-2222-222222222222' and p.type='task' and p.archived_at is null)
    as 참여_건수_기대1;

\echo ''
\echo '=== 2) 속성 변경 자동 로그: status_snapshot 이 null 이면 상태를 건드리지 않는다 (I2) ==='
-- 기한만 바꿨을 때 남기는 로그 형태 그대로
insert into page_updates (page_id, author_id, content, progress_snapshot, status_snapshot)
values ('bbbb0000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111',
        '기한 변경: 2026-09-30 → 2026-10-15', 40, null);
select status as 상태_기대_진행, progress as 진행률_기대_40
  from pages where id='bbbb0000-0000-4000-8000-000000000001';

\echo ''
\echo '=== 3) 본문 기록: 바뀌기 직전 내용을 남긴다 (I6) ==='
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false) \gset
update pages set content = jsonb_build_object('t', repeat('처음 쓴 긴 본문 ', 30))
 where id='bbbb0000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false) \gset
update pages set content = jsonb_build_object('t','옥미영이 통째로 지움')
 where id='bbbb0000-0000-4000-8000-000000000001';
select
  count(*) as 기록_수_기대2,
  (select p.name from page_snapshots s join profiles p on p.id=s.replaced_by
    where s.page_id='bbbb0000-0000-4000-8000-000000000001'
    order by s.created_at desc limit 1) as 마지막을_덮어쓴_사람_기대_옥미영
  from page_snapshots where page_id='bbbb0000-0000-4000-8000-000000000001';

\echo ''
\echo '=== 4) 본문 기록 RLS: 못 보는 페이지의 기록은 안 보인다 ==='
insert into pages (id, title, type, created_by, owner_id, visibility, unit_id, content) values
 ('cccc0000-0000-4000-8000-000000000001','신민철 개인 메모','doc',
  '11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','개인',null,
  jsonb_build_object('t', repeat('개인 메모 내용 ', 30)));
update pages set content = jsonb_build_object('t','고침') where id='cccc0000-0000-4000-8000-000000000001';

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false) \gset
select count(*) as 본인이_보는_개인메모_기록_기대1 from page_snapshots
 where page_id='cccc0000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false) \gset
select count(*) as 남이_보는_개인메모_기록_기대0 from page_snapshots
 where page_id='cccc0000-0000-4000-8000-000000000001';

\echo ''
\echo '=== 5) 본문 기록은 append-only (앱에서 INSERT/UPDATE/DELETE 불가) ==='
reset role;
select count(*) as page_snapshots_쓰기정책_기대0
  from pg_policies where tablename='page_snapshots' and cmd <> 'SELECT';

\echo ''
\echo '=== 6) 인수인계: 담당 업무 일괄 이관 + 각 업무에 기록 (I10) ==='
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false) \gset
update pages set assignee_id='33333333-3333-3333-3333-333333333333'
 where type='task' and assignee_id='11111111-1111-1111-1111-111111111111'
   and status in (select name from page_statuses where kind in ('대기','진행','보류'))
   and archived_at is null;
insert into page_updates (page_id, author_id, content, progress_snapshot, status_snapshot)
select id,'11111111-1111-1111-1111-111111111111',
       '담당자 변경: 신민철 → 남현석 (계정 비활성화에 따른 인수인계)', progress, null
  from pages where type='task' and assignee_id='33333333-3333-3333-3333-333333333333';
select
 (select count(*) from pages where type='task' and assignee_id='33333333-3333-3333-3333-333333333333') as 이관_기대2,
 (select count(*) from page_updates where content like '담당자 변경%인수인계%') as 인수인계_기록_기대2;

\echo ''
\echo '=== 7) 진행률 자동 계산(0014)과 자동 로그가 충돌하지 않는다 ==='
insert into pages (id, parent_id, title, type, status, progress, created_by, unit_id, visibility) values
 ('bbbb0000-0000-4000-8000-000000000010','bbbb0000-0000-4000-8000-000000000002','하위 A','task','진행',80,
  '11111111-1111-1111-1111-111111111111','aaaa0000-0000-4000-8000-000000000001','소속'),
 ('bbbb0000-0000-4000-8000-000000000011','bbbb0000-0000-4000-8000-000000000002','하위 B','task','대기',20,
  '11111111-1111-1111-1111-111111111111','aaaa0000-0000-4000-8000-000000000001','소속');
select progress as 부모_진행률_기대50 from pages where id='bbbb0000-0000-4000-8000-000000000002';
-- 부모에 자동 로그를 남겨도 평균이 유지되어야 한다
insert into page_updates (page_id, author_id, content, progress_snapshot, status_snapshot)
values ('bbbb0000-0000-4000-8000-000000000002','11111111-1111-1111-1111-111111111111',
        '우선순위 변경: 없음 → 높음', 50, null);
select progress as 로그_후_부모_진행률_기대50 from pages where id='bbbb0000-0000-4000-8000-000000000002';
