import { Notification, Stack } from '@mantine/core';

import { useToasts } from './notify';

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const hide = useToasts((s) => s.hide);
  return (
    <Stack
      gap="xs"
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 400,
        width: 360,
        maxWidth: 'calc(100vw - 32px)',
      }}
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <Notification key={t.id} color={t.color} title={t.title} onClose={() => hide(t.id)} withBorder>
          {t.message}
        </Notification>
      ))}
    </Stack>
  );
}
