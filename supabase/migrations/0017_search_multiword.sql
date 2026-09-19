-- =============================================================
-- 0017 — 검색 개선: 여러 단어 AND + 부분 일치 인덱스
--   - 기존 검색은 입력 전체를 하나의 문자열로 ilike '%...%' 했다.
--     "무술 대회" 처럼 띄어 쓰면 그 순서·간격 그대로 있어야만 잡혔다.
--     → 공백으로 나눠 **모든 단어가 들어 있으면** 결과에 포함한다.
--   - to_tsvector GIN 인덱스는 ilike 에 쓰이지 않아 매번 전체 스캔이었다.
--     → pg_trgm 인덱스로 교체해 부분 일치가 인덱스를 타게 한다.
-- =============================================================

create extension if not exists pg_trgm;

drop index if exists pages_search_idx;
create index pages_search_trgm_idx on pages using gin (search_text gin_trgm_ops);
create index pages_title_trgm_gin_idx on pages using gin (title gin_trgm_ops);

create or replace function search_pages(p_q text, p_limit int default 30)
returns table (
  id uuid, title text, icon text, type text, template text, unit_id uuid,
  visibility text, updated_at timestamptz, snippet text
)
language sql
stable
security invoker
as $$
  with t as (
    -- 공백으로 나눈 검색어 (빈 조각 제거)
    select array_agg('%' || w || '%') as patterns, (array_agg(w))[1] as first_word
      from unnest(regexp_split_to_array(trim(p_q), '\s+')) as w
     where length(w) > 0
  )
  select
    p.id, p.title, p.icon, p.type, p.template, p.unit_id, p.visibility, p.updated_at,
    -- 첫 단어 주변 160자
    case
      when position(lower(t.first_word) in lower(coalesce(p.search_text, ''))) > 0 then
        substr(p.search_text,
               greatest(1, position(lower(t.first_word) in lower(p.search_text)) - 40),
               160)
      else left(p.search_text, 160)
    end as snippet
  from pages p, t
  where p.archived_at is null
    and t.patterns is not null
    and p.search_text ilike all (t.patterns)
  order by (p.title ilike '%' || t.first_word || '%') desc, p.updated_at desc
  limit p_limit;
$$;
