import { Badge, Tooltip } from '@mantine/core';

import { useUiStore } from '../../state/uiStore';

export const SERVICE_HELP =
  'This uses the MathMe geometry service (Python). Ask your teacher to start it, or see the README: uvicorn app.main:app --port 8000';

export function useServiceOnline(): boolean {
  return useUiStore((s) => s.serviceOnline === true);
}

/** A small badge that says whether the geometry service is available. */
export function ServiceBadge() {
  const online = useUiStore((s) => s.serviceOnline);
  if (online === null) return null;
  return (
    <Tooltip label={online ? 'Geometry service is running' : SERVICE_HELP} multiline w={260}>
      <Badge size="xs" variant="dot" color={online ? 'green' : 'gray'} data-testid="service-badge">
        {online ? 'service online' : 'service offline'}
      </Badge>
    </Tooltip>
  );
}
