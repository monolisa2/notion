/**
 * types/db.ts 생성 — `supabase gen types typescript` 의 대체 경로.
 *
 * Supabase CLI 는 내부적으로 postgres-meta → @supabase/postgrest-typegen 을 호출해
 * 타입을 만든다. 이 스크립트는 그 라이브러리를 직접 호출하므로 출력이 CLI 와 동일하다.
 * CLI 를 쓸 수 있는 환경이면 `npm run gen:types` 를 쓰고,
 * 바이너리 설치가 막힌 환경(사내 프록시 등)에서는 이 스크립트를 쓴다.
 *
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run gen:types:db
 *
 * 손으로 types/db.ts 를 고치지 말 것 (CLAUDE.md 9절).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import {
  generateTypescript,
  introspect,
  sortGeneratorMetadata,
} from '@supabase/postgrest-typegen';

const databaseUrl = process.env.DATABASE_URL ?? process.argv[2];
if (!databaseUrl) {
  console.error('사용법: DATABASE_URL=postgresql://... node scripts/gen-types.mjs [출력경로]');
  process.exit(1);
}
const outFile = process.argv[3] ?? path.join('types', 'db.ts');
const schemas = (process.env.GEN_TYPES_SCHEMAS ?? 'public').split(',').map((s) => s.trim());

const pool = new pg.Pool({ connectionString: databaseUrl });
try {
  const metadata = sortGeneratorMetadata(await introspect(pool, { includedSchemas: schemas }));
  const source = await generateTypescript(metadata, {
    defaultSchema: 'public',
    detectOneToOneRelationships: false,
    // Supabase 프로젝트의 PostgREST 버전을 알면 지정 (예: POSTGREST_VERSION=13)
    postgrestVersion: process.env.POSTGREST_VERSION,
  });
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, source, 'utf8');
  const tables = metadata.tables.filter((t) => schemas.includes(t.schema)).map((t) => t.name);
  const views = metadata.views.filter((v) => schemas.includes(v.schema)).map((v) => v.name);
  console.log(`✓ ${outFile} 생성 — tables: ${tables.join(', ')} / views: ${views.join(', ')}`);
} finally {
  await pool.end();
}
