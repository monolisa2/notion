#!/usr/bin/env bash
# TeamHub 백업 — 한 달에 한 번, 내 PC 에서 실행한다.
#
# Supabase 무료 플랜에는 우리가 되돌릴 수 있는 백업이 없다.
# 실수로 지우거나 프로젝트에 문제가 생겼을 때 돌아갈 곳을 만들어 두는 것이 이 스크립트다.
#
# 준비 (한 번만)
#   1) PostgreSQL 클라이언트 설치 — pg_dump 가 있어야 한다
#        macOS : brew install libpq && brew link --force libpq
#        Windows: https://www.postgresql.org/download/windows/ (Command Line Tools 만 선택해도 됨)
#   2) Supabase 대시보드 → Project Settings → Database → Connection string → URI 복사
#        ("Use connection pooling" 을 끄고 Direct connection 을 쓴다)
#
# 실행
#   SUPABASE_DB_URL='postgresql://postgres:비밀번호@db.xxxx.supabase.co:5432/postgres' \
#     bash scripts/backup.sh
#
# 결과
#   backups/teamhub-YYYY-MM-DD.sql.gz  (텍스트 덤프, 수십 MB 이하)
#   이 파일을 사내 드라이브에 올려 두면 끝. 3개월치만 남기고 지워도 된다.
#
# 첨부 파일(Storage)은 이 덤프에 들어가지 않는다 — 아래 "첨부 파일" 안내 참고.

set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "SUPABASE_DB_URL 이 없습니다." >&2
  echo "Supabase 대시보드 > Project Settings > Database > Connection string (URI) 를 넣어 주세요." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump 를 찾을 수 없습니다. PostgreSQL 클라이언트를 먼저 설치하세요." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/backups"
STAMP="$(date +%Y-%m-%d)"
OUT="$OUT_DIR/teamhub-$STAMP.sql.gz"

mkdir -p "$OUT_DIR"

echo "백업 중… (몇 분 걸릴 수 있습니다)"
# public 스키마만: 우리가 만든 표와 데이터. auth 스키마(계정)는 Supabase 가 관리한다.
pg_dump "$SUPABASE_DB_URL" \
  --schema=public \
  --no-owner \
  --no-privileges \
  | gzip -9 > "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
echo
echo "완료: $OUT  ($SIZE)"
echo
echo "다음 두 가지를 잊지 마세요."
echo "  1) 이 파일을 사내 드라이브(또는 외장 디스크)에 올려 두기 — PC 안에만 있으면 백업이 아닙니다."
echo "  2) 첨부 파일은 따로입니다. Supabase 대시보드 > Storage > attachments 에서"
echo "     중요한 파일만 내려받거나, 애초에 큰 자료는 사내 드라이브 링크로 공유하세요."
