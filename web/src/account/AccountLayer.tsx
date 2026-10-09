import { Button, Checkbox, Group, Modal, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';

import type { ProjectMeta } from '../state/persistence';
import { useUiStore } from '../state/uiStore';
import { notifications } from '../ui/notify';
import { useAccount } from './accountStore';
import { useAccountUi } from './accountUi';
import { ACCOUNTS_ON } from './api';
import { ClassModal, EnquiryModal } from './ClassModal';
import { deviceOnly, moveUp, startCloud } from './cloud';
import { CheckoutModal, PricingModal } from './PricingModal';
import { PLANS } from './plans';
import { UpgradePrompt } from './UpgradePrompt';

const OFFER_KEY = 'mathme.cloud.offered.';

/** First sign-in on this device: offer to move the browser's projects to the cloud. */
function MoveUpOffer({ projects, onClose }: { projects: ProjectMeta[]; onClose(): void }) {
  const limit = useAccount((s) => s.me.limits.cloudProjects);
  const [chosen, setChosen] = useState(() => projects.slice(0, Math.max(0, limit)).map((p) => p.id));
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const moved = await moveUp(chosen);
    notifications.show({
      color: 'violet',
      message: `${moved} project${moved === 1 ? '' : 's'} now saved in the cloud.`,
    });
    onClose();
  };
  return (
    <Modal opened onClose={onClose} title="Save your projects in the cloud?" centered>
      <Stack gap="sm">
        <Text size="sm">
          These projects are on this device only. Your plan keeps {limit} in the cloud, so you can open them
          anywhere.
        </Text>
        <Stack gap={4} mah={260} style={{ overflow: 'auto' }}>
          {projects.map((p) => (
            <Checkbox
              key={p.id}
              label={p.name || 'Untitled'}
              checked={chosen.includes(p.id)}
              onChange={(e) =>
                setChosen(e.currentTarget.checked ? [...chosen, p.id] : chosen.filter((id) => id !== p.id))
              }
            />
          ))}
        </Stack>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Keep on this device
          </Button>
          <Button onClick={() => void go()} loading={busy} disabled={!chosen.length} data-testid="move-up">
            Save {chosen.length} in the cloud
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Accounts for the hosted app: who is signed in, cloud saving, and the account dialogs. */
export function AccountLayer() {
  const [offer, setOffer] = useState<ProjectMeta[] | null>(null);
  useEffect(() => {
    if (!ACCOUNTS_ON) return;
    let stop: (() => void) | null = null;
    void useAccount
      .getState()
      .refresh()
      .then((me) => {
        const params = new URLSearchParams(location.search);
        const note = (message: string, color = 'violet') => notifications.show({ color, message });
        if (params.get('billing') === 'return') {
          if (me.plan !== 'free') note(`Payment received. Welcome to ${PLANS[me.plan].label}!`, 'green');
          else note('We are waiting for the payment to be confirmed. This page updates in a minute.');
          useUiStore.setState({ settingsOpen: true });
        }
        if (params.get('billing') === 'cancelled') note('Checkout cancelled. Nothing was charged.');
        if (params.get('signin') === 'failed') note('Sign-in did not finish. Please try again.', 'red');
        if (params.get('campus') === 'paid')
          note('Thank you! The Campus licence payment was received.', 'green');
        if (params.get('pricing')) useAccountUi.getState().set({ pricing: true });
        if ([...params.keys()].length) {
          try {
            history.replaceState(null, '', location.pathname + location.hash);
          } catch {
            /* ignore */
          }
        }
        if (!me.user) return;
        stop = startCloud();
        const key = OFFER_KEY + me.user.id;
        try {
          const local = deviceOnly();
          if (!localStorage.getItem(key) && local.length && me.limits.cloudProjects > 0) setOffer(local);
          localStorage.setItem(key, '1');
        } catch {
          /* private mode */
        }
      });
    return () => stop?.();
  }, []);
  if (!ACCOUNTS_ON) return null;
  return (
    <>
      <UpgradePrompt />
      <PricingModal />
      <CheckoutModal />
      <ClassModal />
      <EnquiryModal />
      {offer && <MoveUpOffer projects={offer} onClose={() => setOffer(null)} />}
    </>
  );
}
