import { useEffect } from 'react';

import { useUiStore } from '../state/uiStore';
import { checkHealth } from './geometryApi';

/** Check now and then whether the geometry service is running. */
export function useServiceHealth(intervalMs = 30_000) {
  const setOnline = useUiStore((s) => s.setServiceOnline);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (document.visibilityState === 'hidden') return;
      const health = await checkHealth();
      if (cancelled) return;
      setOnline(health.ok);
      useUiStore.setState({ assistantOnline: health.assistant });
    };
    check();
    const timer = setInterval(check, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [setOnline, intervalMs]);
}
