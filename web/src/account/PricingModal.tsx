import {
  Alert,
  Badge,
  Button,
  Group,
  List,
  Modal,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { useAccount } from './accountStore';
import { useAccountUi } from './accountUi';
import { api, ApiError } from './api';
import { inr, type Period, PLANS, type PlanId, withGst } from './plans';

interface PlansInfo {
  states: string[];
  sellerState: string;
  payments: 'cashfree' | 'fake';
}

let plansInfo: Promise<PlansInfo> | null = null;
function loadPlansInfo() {
  plansInfo ??= api<PlansInfo>('/api/plans').catch((e) => {
    plansInfo = null;
    throw e;
  });
  return plansInfo;
}

function PlanCard({
  id,
  period,
  current,
  onChoose,
}: {
  id: PlanId;
  period: Period;
  current: boolean;
  onChoose(): void;
}) {
  const plan = PLANS[id];
  const price = plan.prices[period];
  const monthlyEquivalent = period === 'annual' && price ? Math.round(price / 12) : null;
  const saving = period === 'annual' && plan.prices.monthly && price ? plan.prices.monthly * 12 - price : 0;
  return (
    <div className={`mm-plan${id === 'plus' ? ' mm-plan-featured' : ''}`} data-testid={`plan-${id}`}>
      <Group justify="space-between" align="flex-start">
        <div>
          <Text className="mm-label">{plan.name}</Text>
          <Title order={3}>{plan.label}</Title>
        </div>
        {id === 'plus' && <Badge color="pink">Recommended</Badge>}
        {current && <Badge variant="light">Your plan</Badge>}
      </Group>
      <Text size="sm" c="dimmed" mt={4}>
        {plan.tagline}
      </Text>
      <Group gap={6} align="baseline" mt="sm">
        <Text className="mm-price">{price ? inr(price) : '₹0'}</Text>
        <Text size="sm" c="dimmed">
          {price ? (period === 'annual' ? '/year + GST' : '/month + GST') : 'forever'}
        </Text>
      </Group>
      <Text size="xs" c="dimmed" h={18}>
        {monthlyEquivalent ? `About ${inr(monthlyEquivalent)} a month · you save ${inr(saving)}` : ''}
      </Text>
      <List
        size="sm"
        spacing={4}
        mt="sm"
        icon={<IconCheck size={14} color="var(--mm-violet)" />}
        className="mm-plan-features"
      >
        {plan.features.map((f) => (
          <List.Item key={f}>{f}</List.Item>
        ))}
      </List>
      {id !== 'free' && (
        <Button
          fullWidth
          mt="md"
          variant={id === 'plus' ? 'filled' : 'light'}
          onClick={onChoose}
          disabled={current}
          data-testid={`choose-${id}`}
        >
          {current ? 'Current plan' : `Choose ${plan.label}`}
        </Button>
      )}
    </div>
  );
}

export function PricingModal() {
  const open = useAccountUi((s) => s.pricing);
  const set = useAccountUi((s) => s.set);
  const me = useAccount((s) => s.me);
  const signIn = useAccount((s) => s.signIn);
  const [period, setPeriod] = useState<Period>('monthly');
  const choose = (plan: 'plus' | 'pro') => {
    if (!me.user) {
      signIn('/?pricing=1');
      return;
    }
    set({ pricing: false, checkout: { plan, period } });
  };
  return (
    <Modal
      opened={open}
      onClose={() => set({ pricing: false })}
      title="Plans"
      size={1080}
      centered
      classNames={{ title: 'mm-modal-title' }}
    >
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap">
          <Text size="sm" c="dimmed">
            Prices in Indian rupees. 18% GST is added at checkout.
          </Text>
          <SegmentedControl
            radius="xl"
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            data={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'annual', label: 'Yearly (save up to 30%)' },
            ]}
            data-testid="period-switch"
          />
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          {(['free', 'plus', 'pro'] as const).map((id) => (
            <PlanCard
              key={id}
              id={id}
              period={period}
              current={me.user ? me.plan === id && me.source !== 'campus' : id === 'free'}
              onChoose={() => choose(id as 'plus' | 'pro')}
            />
          ))}
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <div className="mm-plan mm-plan-wide">
            <Group justify="space-between">
              <div>
                <Text className="mm-label">Education</Text>
                <Title order={4}>Campus</Title>
              </div>
              <Text fw={700}>{inr(PLANS.campus.prices.annual ?? 0)}/year + GST</Text>
            </Group>
            <Text size="sm" c="dimmed" mt={4}>
              {PLANS.campus.features.slice(0, 3).join(' · ')}. We start with a pilot.
            </Text>
            <Button mt="sm" variant="light" onClick={() => set({ pricing: false, enquiry: 'campus' })}>
              Ask about a school pilot
            </Button>
          </div>
          <div className="mm-plan mm-plan-wide">
            <Group justify="space-between">
              <div>
                <Text className="mm-label">Teams and labs</Text>
                <Title order={4}>Enterprise</Title>
              </div>
              <Text fw={700}>Custom quote</Text>
            </Group>
            <Text size="sm" c="dimmed" mt={4}>
              Volume licences, team workspaces and custom workflows for universities, R&amp;D teams and
              studios.
            </Text>
            <Button mt="sm" variant="light" onClick={() => set({ pricing: false, enquiry: 'enterprise' })}>
              Contact us
            </Button>
          </div>
        </SimpleGrid>
      </Stack>
    </Modal>
  );
}

declare global {
  interface Window {
    Cashfree?: (opts: { mode: 'sandbox' | 'production' }) => {
      checkout(o: { paymentSessionId: string; redirectTarget: '_self' }): Promise<unknown>;
      subscriptionsCheckout(o: { subsSessionId: string; redirectTarget: '_self' }): Promise<unknown>;
    };
  }
}

function loadCashfree(): Promise<NonNullable<Window['Cashfree']>> {
  if (window.Cashfree) return Promise.resolve(window.Cashfree);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    s.onload = () =>
      window.Cashfree ? resolve(window.Cashfree) : reject(new Error('Cashfree did not load.'));
    s.onerror = () => reject(new Error('Could not reach Cashfree. Check your internet connection.'));
    document.head.appendChild(s);
  });
}

interface CheckoutResult {
  provider: 'cashfree' | 'fake';
  kind?: 'subscription' | 'order';
  sessionId?: string;
  mode?: 'sandbox' | 'production';
  url?: string;
}

/** Billing details (for the GST invoice), the price with GST, then off to Cashfree. */
export function CheckoutModal() {
  const checkout = useAccountUi((s) => s.checkout);
  const set = useAccountUi((s) => s.set);
  const me = useAccount((s) => s.me);
  const [info, setInfo] = useState<PlansInfo | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<string | null>(null);
  const [gstin, setGstin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checkout) return;
    setName((n) => n || me.user?.name || '');
    loadPlansInfo()
      .then(setInfo)
      .catch((e: Error) => setError(e.message));
  }, [checkout, me.user?.name]);

  if (!checkout) return null;
  const plan = PLANS[checkout.plan];
  const base = plan.prices[checkout.period] ?? 0;
  const tax = state && info ? withGst(base, info.sellerState, state) : null;

  const pay = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await api<CheckoutResult>('/api/billing/checkout', {
        method: 'POST',
        body: { plan: checkout.plan, period: checkout.period, name, phone, state, gstin },
      });
      if (r.provider === 'fake' && r.url) {
        location.href = r.url;
        return;
      }
      const cashfree = (await loadCashfree())({ mode: r.mode ?? 'sandbox' });
      if (r.kind === 'subscription')
        await cashfree.subscriptionsCheckout({ subsSessionId: r.sessionId!, redirectTarget: '_self' });
      else await cashfree.checkout({ paymentSessionId: r.sessionId!, redirectTarget: '_self' });
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      opened
      onClose={() => set({ checkout: null })}
      title={`${plan.label}, ${checkout.period === 'annual' ? 'yearly' : 'monthly'}`}
      centered
      size="md"
      classNames={{ title: 'mm-modal-title' }}
    >
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          These details go on your GST invoice. Your state decides whether the invoice shows CGST and SGST or
          IGST.
        </Text>
        <TextInput
          label="Name on the invoice"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Mobile number"
          description="Cashfree asks for one to set up payments."
          value={phone}
          onChange={(e) => setPhone(e.currentTarget.value)}
          placeholder="98765 43210"
          required
        />
        <Select
          label="State"
          data={info?.states ?? []}
          value={state}
          onChange={setState}
          searchable
          required
          data-testid="checkout-state"
        />
        <TextInput
          label="GSTIN (optional, for businesses)"
          value={gstin}
          onChange={(e) => setGstin(e.currentTarget.value.toUpperCase())}
          maxLength={15}
        />
        <div className="mm-gst" data-testid="checkout-total">
          <Group justify="space-between">
            <Text size="sm">{plan.label} plan</Text>
            <Text size="sm">{inr(base, true)}</Text>
          </Group>
          {tax ? (
            tax.igst ? (
              <Group justify="space-between">
                <Text size="sm">IGST 18%</Text>
                <Text size="sm">{inr(tax.igst, true)}</Text>
              </Group>
            ) : (
              <>
                <Group justify="space-between">
                  <Text size="sm">CGST 9%</Text>
                  <Text size="sm">{inr(tax.cgst, true)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">SGST 9%</Text>
                  <Text size="sm">{inr(tax.sgst, true)}</Text>
                </Group>
              </>
            )
          ) : (
            <Text size="xs" c="dimmed">
              Choose your state to see the GST.
            </Text>
          )}
          <Group justify="space-between" mt={4}>
            <Text fw={800}>Total {checkout.period === 'annual' ? 'for the year' : 'each month'}</Text>
            <Text fw={800}>{inr(tax?.total ?? Math.floor((base * 118 + 50) / 100), true)}</Text>
          </Group>
        </div>
        <Text size="xs" c="dimmed">
          {checkout.period === 'monthly'
            ? 'You set up a monthly payment (UPI AutoPay, card or net banking) and can cancel any time in Settings → Account; you keep the plan until the end of the month you paid for.'
            : 'One payment for 12 months. We remind you before the year ends; nothing renews by itself.'}{' '}
          See the Refund &amp; Cancellation policy.
        </Text>
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}
        {info?.payments === 'fake' && (
          <Alert color="yellow" variant="light">
            Test mode: no money moves.
          </Alert>
        )}
        <Button
          onClick={pay}
          loading={busy}
          disabled={!state || name.trim().length < 2}
          data-testid="checkout-pay"
        >
          Continue to payment
        </Button>
      </Stack>
    </Modal>
  );
}
