-- =============================================================
-- 0006_labels_optional.sql   ★ 선택 사항 ★
--
-- 사람 태그(멘션)는 0003 에 이미 있다. 이건 그것과 별개로
-- "합병" "채용" "노동사건" 같은 분류 라벨이 필요할 때만 실행한다.
-- 파일럿에서 안 쓸 거면 이 파일을 그냥 삭제하면 된다.
--
-- 경고: 자유 입력 라벨은 3주면 무너진다.
--   인사 / HR / 에이치알 / 인사팀 이 각각 다른 라벨로 쌓인다.
--   대응: 입력창에서 자동완성을 먼저 띄우고, 새 라벨 생성은
--         "+ 새 라벨 만들기" 버튼을 따로 눌러야 되게 마찰을 준다.
--         (아래 create_label 함수가 유사 라벨을 미리 경고한다)
-- =============================================================

create extension if not exists "pg_trgm";

create table labels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default 'gray'
                check (color in ('gray','red','orange','yellow',
                                 'green','blue','purple','pink')),
  created_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now()
);

-- 대소문자·공백 무시 유일성
create unique index labels_name_uniq
  on labels (lower(regexp_replace(name, '\s+', '', 'g')));

create index labels_trgm_idx on labels using gin (name gin_trgm_ops);

create table page_labels (
  page_id  uuid references pages(id)  on delete cascade,
  label_id uuid references labels(id) on delete cascade,
  added_by uuid references profiles(id),
  added_at timestamptz not null default now(),
  primary key (page_id, label_id)
);

create index page_labels_label_idx on page_labels (label_id);

alter table labels      enable row level security;
alter table page_labels enable row level security;

create policy labels_select on labels
  for select to authenticated using (true);

create policy labels_insert on labels
  for insert to authenticated
  with check (created_by = auth.uid());

create policy labels_manage on labels
  for update to authenticated using (is_admin()) with check (is_admin());

create policy labels_delete on labels
  for delete to authenticated using (is_admin());

create policy page_labels_all on page_labels
  for all to authenticated using (true) with check (true);


-- -------------------------------------------------------------
-- 유사 라벨 탐지 — 새 라벨 만들기 전 호출해서 사용자에게 보여준다
--   "이미 「인사관리」 라벨이 있습니다. 그걸 쓰시겠어요?"
-- -------------------------------------------------------------
create or replace function similar_labels(p_name text)
returns table (id uuid, name text, color text, similarity real)
language sql
security invoker
stable
as $$
  select l.id, l.name, l.color, similarity(l.name, p_name) as similarity
    from labels l
   where similarity(l.name, p_name) > 0.3
   order by similarity desc
   limit 5;
$$;


-- 라벨 병합 (관리자용 정리 도구)
create or replace function merge_labels(p_from uuid, p_into uuid)
returns int
language plpgsql
security invoker
as $$
declare v_moved int;
begin
  if not is_admin() then
    raise exception '관리자만 라벨을 병합할 수 있습니다';
  end if;

  insert into page_labels (page_id, label_id, added_by)
  select page_id, p_into, added_by from page_labels where label_id = p_from
  on conflict do nothing;

  get diagnostics v_moved = row_count;
  delete from labels where id = p_from;
  return v_moved;
end;
$$;
