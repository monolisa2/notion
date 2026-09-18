-- =============================================================
-- 0003_mentions.sql
-- mentions(사람 태그) / notifications(알림 큐)
-- =============================================================

-- -------------------------------------------------------------
-- mentions
--   본문 JSON 안에만 멘션이 있으면 "나를 언급한 글 모아보기"가 불가능하다.
--   그래서 별도 테이블로 뽑아 색인한다.
--
--   (page_id, mentioned_id) 유일 제약:
--     한 페이지에서 같은 사람을 열 번 언급해도 알림은 한 건이면 충분하다.
--     이 제약이 재편집 시 중복 삽입을 자동으로 막아준다.
-- -------------------------------------------------------------
create table mentions (
  id            uuid primary key default gen_random_uuid(),
  page_id       uuid not null references pages(id) on delete cascade,
  comment_id    uuid references comments(id) on delete cascade,
  mentioned_id  uuid not null references profiles(id) on delete cascade,
  author_id     uuid not null references profiles(id),
  context       text,                         -- 멘션 앞뒤 문장(알림 미리보기)
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- 본문 멘션: 페이지당 1인 1건
create unique index mentions_body_uniq
  on mentions (page_id, mentioned_id)
  where comment_id is null;

-- 댓글 멘션: 댓글당 1인 1건
create unique index mentions_comment_uniq
  on mentions (comment_id, mentioned_id)
  where comment_id is not null;

create index mentions_inbox_idx
  on mentions (mentioned_id, read_at, created_at desc);


-- -------------------------------------------------------------
-- notifications
--   전달 채널과 무관한 알림 큐.
--   pushed_at 이 null 인 행을 Edge Function 이 집어 네이버웍스로 보낸다.
-- -------------------------------------------------------------
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  actor_id     uuid references profiles(id) on delete set null,
  kind         text not null
                 check (kind in ('mention','assigned','comment','due_soon','stale')),
  page_id      uuid references pages(id) on delete cascade,
  title        text not null,                 -- 알림 문구
  preview      text,                          -- 본문 미리보기
  dedupe_key   text,                          -- 5분 묶음 처리용
  read_at      timestamptz,
  pushed_at    timestamptz,                   -- 네이버웍스 발송 완료 시각
  push_error   text,
  created_at   timestamptz not null default now()
);

create index notifications_inbox_idx
  on notifications (recipient_id, read_at, created_at desc);

create index notifications_outbox_idx
  on notifications (created_at)
  where pushed_at is null;


-- -------------------------------------------------------------
-- 알림 생성 공통 함수
--   - 자기 자신에게는 알림 안 감
--   - 같은 dedupe_key 로 5분 내 알림이 있으면 새로 만들지 않음
--   - profiles 의 수신 설정(notify_*)을 존중
--   - 비활성 사용자에게는 안 보냄
-- -------------------------------------------------------------
create or replace function enqueue_notification(
  p_recipient  uuid,
  p_actor      uuid,
  p_kind       text,
  p_page_id    uuid,
  p_title      text,
  p_preview    text default null,
  p_dedupe_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_allowed  boolean;
begin
  -- 1) 자기 자신 멘션 제외 (자기 글에 자기 이름 쓰는 경우 의외로 많다)
  if p_recipient = p_actor then
    return null;
  end if;

  -- 2) 수신 설정 및 활성 여부 확인
  select case p_kind
           when 'mention'  then notify_mention
           when 'comment'  then notify_mention
           when 'assigned' then notify_assign
           when 'due_soon' then notify_due
           when 'stale'    then notify_due
           else true
         end
    into v_allowed
    from profiles
   where id = p_recipient
     and deactivated_at is null;

  if coalesce(v_allowed, false) = false then
    return null;
  end if;

  -- 3) 5분 내 동일 dedupe_key 알림이 있으면 묶어서 생략
  --    (문서 여러 군데 고치며 계속 저장하면 알림이 폭탄이 된다)
  if p_dedupe_key is not null and exists (
    select 1 from notifications
     where recipient_id = p_recipient
       and dedupe_key   = p_dedupe_key
       and created_at   > now() - interval '5 minutes'
  ) then
    return null;
  end if;

  insert into notifications
    (recipient_id, actor_id, kind, page_id, title, preview, dedupe_key)
  values
    (p_recipient, p_actor, p_kind, p_page_id, p_title, p_preview, p_dedupe_key)
  returning id into v_id;

  return v_id;
end;
$$;


-- -------------------------------------------------------------
-- 본문 멘션 동기화 (diff 방식)
--
--   매번 전체 삭제 후 재삽입하면 이미 읽은 알림이 다시 '안 읽음'으로
--   되돌아간다. 그래서 반드시 차집합만 처리한다.
--     - 새로 생긴 멘션만 insert  → 알림 발생
--     - 사라진 멘션만 delete     → 알림도 함께 정리
--     - 그대로인 멘션은 손대지 않음 (read_at 보존)
--
--   호출: supabase.rpc('sync_page_mentions', { ... })
-- -------------------------------------------------------------
create or replace function sync_page_mentions(
  p_page_id      uuid,
  p_author_id    uuid,
  p_mentioned    uuid[],                      -- 현재 본문에 있는 멘션 대상 전체
  p_contexts     jsonb default '{}'::jsonb    -- { "<uuid>": "앞뒤 문장", ... }
)
returns int                                   -- 새로 생긴 멘션 수
language plpgsql
security invoker
as $$
declare
  v_title text;
  v_new   int := 0;
  r       record;
begin
  select title into v_title from pages where id = p_page_id;

  -- (1) 사라진 멘션 제거 + 미열람 알림도 같이 제거
  delete from notifications n
   where n.page_id = p_page_id
     and n.kind = 'mention'
     and n.read_at is null
     and n.recipient_id <> all (coalesce(p_mentioned, '{}'::uuid[]));

  delete from mentions m
   where m.page_id = p_page_id
     and m.comment_id is null
     and m.mentioned_id <> all (coalesce(p_mentioned, '{}'::uuid[]));

  -- (2) 새로 생긴 멘션만 추가
  for r in
    select unnest(coalesce(p_mentioned, '{}'::uuid[])) as uid
  loop
    insert into mentions (page_id, mentioned_id, author_id, context)
    values (p_page_id, r.uid, p_author_id, p_contexts ->> r.uid::text)
    on conflict do nothing;

    if found then
      v_new := v_new + 1;

      perform enqueue_notification(
        p_recipient  => r.uid,
        p_actor      => p_author_id,
        p_kind       => 'mention',
        p_page_id    => p_page_id,
        p_title      => format('%s님이 「%s」에서 회원님을 언급했습니다',
                               (select name from profiles where id = p_author_id),
                               coalesce(v_title, '제목 없음')),
        p_preview    => p_contexts ->> r.uid::text,
        p_dedupe_key => 'mention:' || p_page_id::text
      );
    end if;
  end loop;

  return v_new;
end;
$$;


-- -------------------------------------------------------------
-- 댓글 멘션
-- -------------------------------------------------------------
create or replace function sync_comment_mentions(
  p_comment_id uuid,
  p_mentioned  uuid[]
)
returns int
language plpgsql
security invoker
as $$
declare
  c      record;
  v_new  int := 0;
  r      record;
begin
  select c0.id, c0.page_id, c0.author_id, c0.body_text, p.title
    into c
    from comments c0
    join pages p on p.id = c0.page_id
   where c0.id = p_comment_id;

  for r in select unnest(coalesce(p_mentioned, '{}'::uuid[])) as uid
  loop
    insert into mentions (page_id, comment_id, mentioned_id, author_id, context)
    values (c.page_id, p_comment_id, r.uid, c.author_id, left(c.body_text, 200))
    on conflict do nothing;

    if found then
      v_new := v_new + 1;
      perform enqueue_notification(
        p_recipient  => r.uid,
        p_actor      => c.author_id,
        p_kind       => 'comment',
        p_page_id    => c.page_id,
        p_title      => format('%s님이 「%s」 댓글에서 회원님을 언급했습니다',
                               (select name from profiles where id = c.author_id),
                               coalesce(c.title, '제목 없음')),
        p_preview    => left(c.body_text, 200),
        p_dedupe_key => 'comment:' || p_comment_id::text
      );
    end if;
  end loop;

  return v_new;
end;
$$;


-- -------------------------------------------------------------
-- 담당자 지정 알림
--   멘션("이 글 좀 봐줘")과 담당자 지정("네 일이야")은 목적이 다르다.
--   문구를 분리해 긴급도를 구분한다.
-- -------------------------------------------------------------
create or replace function pages_notify_assignee()
returns trigger
language plpgsql
as $$
begin
  if new.assignee_id is not null
     and new.assignee_id is distinct from old.assignee_id then
    perform enqueue_notification(
      p_recipient  => new.assignee_id,
      p_actor      => auth.uid(),
      p_kind       => 'assigned',
      p_page_id    => new.id,
      p_title      => format('「%s」 업무가 회원님께 배정되었습니다', new.title),
      p_preview    => case when new.due_date is not null
                           then '기한: ' || new.due_date::text end,
      p_dedupe_key => 'assign:' || new.id::text
    );
  end if;
  return new;
end;
$$;

create trigger pages_notify_assign
  after insert or update of assignee_id on pages
  for each row
  when (new.type = 'task')
  execute function pages_notify_assignee();


-- -------------------------------------------------------------
-- 내 알림 읽음 처리
-- -------------------------------------------------------------
create or replace function mark_notifications_read(p_ids uuid[] default null)
returns int
language plpgsql
security invoker
as $$
declare v_count int;
begin
  update notifications
     set read_at = now()
   where recipient_id = auth.uid()
     and read_at is null
     and (p_ids is null or id = any(p_ids));
  get diagnostics v_count = row_count;

  update mentions
     set read_at = now()
   where mentioned_id = auth.uid()
     and read_at is null;

  return v_count;
end;
$$;
