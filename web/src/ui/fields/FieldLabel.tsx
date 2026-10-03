import { Group, Text, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

export function FieldLabel({ label, help }: { label: string; help?: string }) {
  return (
    <Group gap={4} wrap="nowrap">
      <Text size="sm" fw={500}>
        {label}
      </Text>
      {help && (
        <Tooltip
          label={help}
          multiline
          w={240}
          withArrow
          openDelay={150}
          events={{ hover: true, focus: true, touch: true }}
        >
          <IconInfoCircle size={14} style={{ opacity: 0.55, flexShrink: 0 }} aria-label={help} tabIndex={0} />
        </Tooltip>
      )}
    </Group>
  );
}
