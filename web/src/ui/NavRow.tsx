import { Text, Tooltip, UnstyledButton } from '@mantine/core';
import type { ReactNode } from 'react';

/** One row of the sidebar: an icon and a label, like a chat in ChatGPT or Claude. */
export function NavRow({
  icon,
  label,
  onClick,
  active,
  right,
  testId,
  ariaLabel,
  tooltip,
}: {
  icon: ReactNode;
  label: ReactNode;
  onClick(): void;
  active?: boolean;
  right?: ReactNode;
  testId?: string;
  ariaLabel?: string;
  tooltip?: string;
}) {
  const row = (
    <UnstyledButton
      className="mm-nav-row"
      data-active={active || undefined}
      onClick={onClick}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      <span className="mm-nav-icon" aria-hidden>
        {icon}
      </span>
      <Text size="sm" truncate flex={1}>
        {label}
      </Text>
      {right}
    </UnstyledButton>
  );
  if (!tooltip) return row;
  return (
    <Tooltip label={tooltip} position="right" multiline w={240} withArrow openDelay={600}>
      {row}
    </Tooltip>
  );
}
