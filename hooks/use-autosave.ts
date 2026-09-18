'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/**
 * 디바운스 자동저장.
 *   schedule(payload) → delay 후 save(payload) 한 번만 호출.
 *   저장 중 새 변경이 오면 끝난 뒤 다시 저장한다.
 *   언마운트 시 대기 중인 변경은 즉시 flush.
 */
export function useAutosave<T>(
  save: (payload: T) => Promise<void>,
  delay = 700,
) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<T | null>(null);
  const inFlight = useRef(false);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      // 저장 중 새 변경이 들어오면 루프를 한 번 더 돈다
      while (pending.current !== null) {
        const payload = pending.current;
        pending.current = null;
        setStatus('saving');
        try {
          await saveRef.current(payload);
          setStatus('saved');
        } catch (e) {
          setStatus('error');
          throw e;
        }
      }
    } finally {
      inFlight.current = false;
    }
  }, []);

  const schedule = useCallback(
    (payload: T) => {
      pending.current = payload;
      setStatus('dirty');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush().catch(() => {});
      }, delay);
    },
    [delay, flush],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current !== null && !inFlight.current) {
        const payload = pending.current;
        pending.current = null;
        void saveRef.current(payload).catch(() => {});
      }
    };
  }, []);

  return { status, schedule, flush };
}
