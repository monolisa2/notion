-- =============================================================
-- 0016 — 양식 'guide'(사용법 안내) 허용
--   0009 의 template 체크가 고정 목록이라 새 양식이 거부되던 것 수정
-- =============================================================

alter table pages drop constraint pages_template_check;
alter table pages add constraint pages_template_check
  check (template in ('blank', 'meeting', 'task', 'notice', 'weekly', 'guide'));
