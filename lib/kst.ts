/**
 * 한국 시간(KST) 기준 날짜·시각.
 *
 * 서버 컴포넌트는 **Vercel 서버의 시간대(UTC)** 로 돈다.
 * 그래서 `new Date().getHours()` 를 그대로 쓰면 한국 아침 7시에 "밤 10시" 가 되고,
 * `toISOString().slice(0,10)` 은 한국 시간 오전 9시 이전에 **어제 날짜**가 된다.
 * 화면에 보이는 "오늘"·인사말은 전부 이 파일을 쓴다.
 *
 * (DB 쪽은 이미 `now() at time zone 'Asia/Seoul'` 로 맞춰져 있다 — 0015/0019)
 */

const KST = 'Asia/Seoul';

/** 한국 기준 오늘 (YYYY-MM-DD) */
export function kstToday(): string {
  // en-CA 로케일이 YYYY-MM-DD 형식을 준다
  return new Date().toLocaleDateString('en-CA', { timeZone: KST });
}

/** 한국 기준 시각 (0~23) */
export function kstHour(): number {
  return Number(new Date().toLocaleString('en-US', { timeZone: KST, hour: '2-digit', hour12: false }));
}

/** 한국 기준 N일 뒤/전 (YYYY-MM-DD) */
export function kstDateAdd(days: number): string {
  const d = new Date(`${kstToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
