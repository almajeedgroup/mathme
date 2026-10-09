import { Alert, Badge, Button, Group, Progress, Stack, Table, Text } from '@mantine/core';
import { useEffect, useState } from 'react';

import { downloadBlob } from '../export/download';
import { notifications } from '../ui/notify';
import { useAccount } from './accountStore';
import { useAccountUi } from './accountUi';
import { api } from './api';
import { type Invoice, invoicePdf } from './invoicePdf';
import { inr, PLANS, UNLIMITED } from './plans';

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = limit === UNLIMITED;
  return (
    <div>
      <Group justify="space-between">
        <Text size="sm">{label}</Text>
        <Text size="sm" c="dimmed">
          {used.toLocaleString('en-IN')} / {unlimited ? 'unlimited' : limit.toLocaleString('en-IN')}
        </Text>
      </Group>
      <Progress
        value={unlimited ? 0 : Math.min(100, (used / Math.max(1, limit)) * 100)}
        size="sm"
        radius="xl"
      />
    </div>
  );
}

const date = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

/** Settings → Account: plan, what has been used, renewal, invoices. */
export function AccountSettings() {
  const me = useAccount((s) => s.me);
  const refresh = useAccount((s) => s.refresh);
  const signIn = useAccount((s) => s.signIn);
  const setUi = useAccountUi((s) => s.set);
  const [invoices, setInvoices] = useState<
    { id: string; number: string; issued_at: number; total: number; description: string }[]
  >([]);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (me.user) {
      api<{ invoices: typeof invoices }>('/api/billing/invoices')
        .then((r) => setInvoices(r.invoices))
        .catch(() => undefined);
    }
  }, [me.user]);

  if (!me.user) {
    return (
      <Stack gap="sm">
        <Text size="sm">Sign in to save projects in the cloud, see your plan and manage billing.</Text>
        <Button onClick={() => signIn()} disabled={!me.signinAvailable} w="fit-content">
          Sign in with Google
        </Button>
      </Stack>
    );
  }
  const plan = PLANS[me.plan];
  const sub = me.subscription;
  const usage = me.usage ?? { exports: 0, geometry: 0, ai: 0, cloudProjects: 0 };
  const download = async (id: string) => {
    const inv = await api<Invoice>(`/api/billing/invoices/${id}`);
    downloadBlob(await invoicePdf(inv), `mathme-invoice-${inv.number.replaceAll('/', '-')}.pdf`);
  };
  const cancel = async () => {
    await api('/api/billing/cancel', { method: 'POST' });
    setConfirm(false);
    await refresh();
    notifications.show({
      message: 'Your plan will not renew. You keep it until the end of the period you paid for.',
    });
  };

  return (
    <Stack gap="md" data-testid="account-settings">
      <Group justify="space-between">
        <div>
          <Text fw={700}>
            {plan.label} · {plan.name}
          </Text>
          <Text size="xs" c="dimmed">
            {me.source === 'campus' && me.campus
              ? `Through ${me.campus.name} (${me.campus.role}) until ${date(me.campus.endsAt)}`
              : sub
                ? `${sub.period === 'annual' ? 'Yearly' : 'Monthly'} · ${
                    sub.cancelAtPeriodEnd ? 'ends' : sub.period === 'annual' ? 'runs until' : 'renews'
                  } ${date(sub.currentPeriodEnd)}${sub.status === 'past_due' ? ' · the last payment failed' : ''}`
                : 'Free forever'}
          </Text>
        </div>
        <Group gap={6}>
          {me.plan !== 'pro' && (
            <Button size="xs" onClick={() => setUi({ pricing: true })} data-testid="settings-upgrade">
              Upgrade
            </Button>
          )}
          {sub && !sub.cancelAtPeriodEnd && (
            <Button size="xs" variant="default" onClick={() => setConfirm(true)}>
              Cancel renewal…
            </Button>
          )}
        </Group>
      </Group>
      {confirm && (
        <Alert color="orange" variant="light" title="Stop renewing?">
          <Text size="sm" mb="xs">
            You keep {plan.label} until {sub && date(sub.currentPeriodEnd)}. After that your account moves to
            Free and your projects stay safe.
          </Text>
          <Group gap={6}>
            <Button size="xs" variant="default" onClick={() => setConfirm(false)}>
              Keep my plan
            </Button>
            <Button size="xs" color="red" onClick={() => void cancel()}>
              Stop renewing
            </Button>
          </Group>
        </Alert>
      )}
      <Stack gap="xs">
        <Text className="mm-label">This month and today</Text>
        <Meter label="Exports this month" used={usage.exports} limit={me.limits.exportsPerMonth} />
        <Meter label="Cloud projects" used={usage.cloudProjects} limit={me.limits.cloudProjects} />
        <Meter label="Geometry jobs today" used={usage.geometry} limit={me.limits.geometryJobsPerDay} />
        <Meter label="AI chat messages today" used={usage.ai} limit={me.limits.aiMessagesPerDay} />
      </Stack>
      <Stack gap="xs">
        <Text className="mm-label">Invoices</Text>
        {invoices.length === 0 ? (
          <Text size="sm" c="dimmed">
            No payments yet.
          </Text>
        ) : (
          <Table verticalSpacing={4} data-testid="invoice-list">
            <Table.Tbody>
              {invoices.map((i) => (
                <Table.Tr key={i.id}>
                  <Table.Td>
                    <Text size="sm">{i.number}</Text>
                    <Text size="xs" c="dimmed">
                      {date(i.issued_at)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light">{inr(i.total, true)}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="subtle" onClick={() => void download(i.id)}>
                      PDF
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Stack>
  );
}
