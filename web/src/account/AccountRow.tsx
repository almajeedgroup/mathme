import { Avatar, Badge, Button, Group, Menu, Text, UnstyledButton } from '@mantine/core';
import { IconBrandGoogle, IconLogout, IconSchool, IconSettings, IconSparkles } from '@tabler/icons-react';

import { useUiStore } from '../state/uiStore';
import { useAccount } from './accountStore';
import { useAccountUi } from './accountUi';
import { ACCOUNTS_ON } from './api';
import { PLANS } from './plans';

/** Bottom of the sidebar: who is signed in and their plan, like the user row in ChatGPT or Claude. */
export function AccountRow() {
  const me = useAccount((s) => s.me);
  const signIn = useAccount((s) => s.signIn);
  const signOut = useAccount((s) => s.signOut);
  const setUi = useAccountUi((s) => s.set);
  if (!ACCOUNTS_ON) return null;
  if (!me.user) {
    return (
      <Button
        fullWidth
        variant="light"
        leftSection={<IconBrandGoogle size={16} />}
        onClick={() => signIn()}
        disabled={!me.signinAvailable}
        data-testid="signin"
      >
        Sign in with Google
      </Button>
    );
  }
  const plan = PLANS[me.plan];
  return (
    <Menu position="top-start" width={240}>
      <Menu.Target>
        <UnstyledButton className="mm-nav-row" data-testid="account-row">
          <Avatar src={me.user.avatar || null} size={26} radius="xl" color="violet">
            {me.user.name.slice(0, 1)}
          </Avatar>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" truncate>
              {me.user.name || me.user.email}
            </Text>
          </div>
          <Badge size="sm" variant={me.plan === 'free' ? 'light' : 'filled'} data-testid="plan-badge">
            {plan.label}
          </Badge>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{me.user.email}</Menu.Label>
        {me.plan === 'free' && (
          <Menu.Item leftSection={<IconSparkles size={14} />} onClick={() => setUi({ pricing: true })}>
            Upgrade
          </Menu.Item>
        )}
        <Menu.Item leftSection={<IconSchool size={14} />} onClick={() => setUi({ classOpen: true })}>
          {me.campus ? 'My class' : 'Join a class'}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconSettings size={14} />}
          onClick={() => useUiStore.setState({ settingsOpen: true })}
        >
          Account and billing
        </Menu.Item>
        {me.user.role === 'owner' && (
          <Menu.Item onClick={() => (location.hash = '#admin')} data-testid="open-admin">
            Owner dashboard
          </Menu.Item>
        )}
        <Menu.Divider />
        <Menu.Item leftSection={<IconLogout size={14} />} onClick={() => void signOut()}>
          Sign out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/** The plan badge shown in compact places. */
export function PlanBadge() {
  const plan = useAccount((s) => s.me.plan);
  if (!ACCOUNTS_ON) return null;
  return (
    <Group gap={4}>
      <Badge size="xs" variant="light">
        {PLANS[plan].label}
      </Badge>
    </Group>
  );
}
