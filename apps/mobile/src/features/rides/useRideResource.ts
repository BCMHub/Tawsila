import { useEffect, useState } from 'react';

type Result<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; value: T };

export function useRideResource<T>(load: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState<{ load: typeof load; attempt: number; result: Result<T> }>();

  useEffect(() => {
    let active = true;
    const store = (result: Result<T>) => {
      if (active) setResponse({ load, attempt, result });
    };
    void (async () => {
      try {
        store({ status: 'ready', value: await load() });
      } catch {
        store({ status: 'error' });
      }
    })();
    return () => { active = false; };
  }, [load, attempt]);

  const result: Result<T> = response?.load === load && response.attempt === attempt
    ? response.result
    : { status: 'loading' };
  return { result, retry: () => setAttempt(value => value + 1) };
}
