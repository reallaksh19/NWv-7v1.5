import { useMemo } from 'react';
import { getRuntimeCapabilities } from '../runtime/runtimeCapabilities.js';

export function buildShellRuntimeProps(runtime) {
  return {
    showStaticHostBadge: Boolean(runtime?.isStaticHost),
    staticHostBadgeTitle: 'Static-host mode: snapshot/cache-first behavior is active.',
    staticHostBadgeLabel: 'Static-host mode',
    staticHostBadgeIcon: '📦',
  };
}

export function useShellRuntimeProps() {
  const runtime = useMemo(() => getRuntimeCapabilities(), []);

  return useMemo(() => (
    buildShellRuntimeProps(runtime)
  ), [runtime]);
}

export default useShellRuntimeProps;
