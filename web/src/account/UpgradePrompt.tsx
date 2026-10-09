import { Button, Group, List, Modal, Stack, Text } from '@mantine/core';
import { IconBrandGoogle, IconSparkles } from '@tabler/icons-react';

import { useAccount } from './accountStore';
import { useAccountUi } from './accountUi';
import { useUpgradePrompt } from './limits';
import { inr, PLANS } from './plans';

/** "This needs Plus" (or "sign in first"), with the way forward. */
export function UpgradePrompt() {
  const p = useUpgradePrompt();
  const signIn = useAccount((s) => s.signIn);
  const signedIn = useAccount((s) => Boolean(s.me.user));
  const openPricing = () => {
    p.close();
    useAccountUi.getState().set({ pricing: true });
  };
  const plan = p.plan ? PLANS[p.plan] : null;
  return (
    <Modal opened={p.open} onClose={p.close} title={p.title} centered size="md" data-testid="upgrade-prompt">
      <Stack gap="md">
        <Text size="sm">{p.message}</Text>
        {plan && (
          <div className="mm-upgrade-card">
            <Group justify="space-between" mb={6}>
              <Text fw={800}>
                {plan.label} · {plan.name}
              </Text>
              <Text fw={700} c="violet">
                {inr(plan.prices.monthly ?? 0)}/month + GST
              </Text>
            </Group>
            <List size="sm" spacing={2}>
              {plan.features.slice(1, 5).map((f) => (
                <List.Item key={f}>{f}</List.Item>
              ))}
            </List>
          </div>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={p.close}>
            Not now
          </Button>
          {p.signIn || !signedIn ? (
            <Button
              leftSection={<IconBrandGoogle size={16} />}
              onClick={() => signIn()}
              data-testid="prompt-signin"
            >
              Sign in with Google
            </Button>
          ) : (
            <Button
              leftSection={<IconSparkles size={16} />}
              onClick={openPricing}
              data-testid="prompt-see-plans"
            >
              See plans
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
