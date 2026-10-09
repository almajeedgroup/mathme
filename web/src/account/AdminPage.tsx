import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconArrowLeft, IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Logo } from '../ui/Logo';
import { notifications } from '../ui/notify';
import { useAccount } from './accountStore';
import { api, ApiError } from './api';
import { inr, PLANS } from './plans';
import { revenueScenario, SCENARIO_START } from './revenue';

interface Metrics {
  users: number;
  signups7: number;
  signups30: number;
  weeklyActive: number;
  payingUsers: number;
  paying: Record<string, number>;
  conversion: number;
  mrr: number;
  arr: number;
  churn30: number;
  churned30: number;
  revenue30: number;
  revenueAll: number;
  gstCollected: number;
  campus: { paid: number; pilot: number; members: number };
  newEnquiries: number;
}

interface Enquiry {
  id: string;
  kind: string;
  institution: string;
  contact_name: string;
  email: string;
  phone: string;
  city: string;
  students: number;
  message: string;
  status: string;
  created_at: number;
}

interface Org {
  id: string;
  name: string;
  status: string;
  student_seats: number;
  teacher_seats: number;
  ends_at: number;
  billing_state: string;
  billing_email: string;
  codes: { code: string; role: string }[];
  used: Record<string, number>;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const day = (ts: number) => new Date(ts * 1000).toLocaleDateString('en-IN');

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="mm-stat">
      <Text className="mm-label">{label}</Text>
      <Text className="mm-stat-value">{value}</Text>
      {note && (
        <Text size="xs" c="dimmed">
          {note}
        </Text>
      )}
    </div>
  );
}

function Calculator() {
  const [n, setN] = useState(SCENARIO_START);
  const r = revenueScenario(n);
  const num = (key: keyof typeof n, label: string, step = 1, money = false) => (
    <NumberInput
      label={label}
      value={money ? n[key] / 100 : n[key]}
      min={0}
      step={step}
      thousandSeparator=","
      onChange={(v) => setN({ ...n, [key]: Math.max(0, Number(v) || 0) * (money ? 100 : 1) })}
      data-testid={`calc-${key}`}
    />
  );
  return (
    <Stack gap="sm" maw={720}>
      <Text size="sm" c="dimmed">
        Change the number of paying customers to explore revenue. These are planning assumptions, not a
        forecast.
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        {num('plus', `Plus subscribers · ${inr(PLANS.plus.prices.monthly ?? 0)}/month`)}
        {num('pro', `Pro subscribers · ${inr(PLANS.pro.prices.monthly ?? 0)}/month`)}
        {num('campus', `Campus licences · ${inr(PLANS.campus.prices.annual ?? 0)}/year`)}
        {num('enterprise', 'Enterprise clients')}
        {num('enterpriseMonthly', 'Enterprise, ₹ per month (assumed)', 1000, true)}
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Stat label="Monthly revenue equivalent" value={inr(r.monthly)} />
        <Stat label="Annual run rate" value={inr(r.annual)} />
      </SimpleGrid>
      <Text size="xs" c="dimmed">
        Assumes every listed customer pays the full stated price; annual Campus revenue is divided by 12.
        Excludes taxes, discounts, churn, payment fees, hosting, development, support and other expenses.
        Revenue is not profit.
      </Text>
      <Button variant="subtle" w="fit-content" onClick={() => setN(SCENARIO_START)}>
        Reset example
      </Button>
    </Stack>
  );
}

function NewOrgModal({
  from,
  onClose,
  onDone,
}: {
  from: Partial<Enquiry> | null;
  onClose(): void;
  onDone(): void;
}) {
  const [states, setStates] = useState<string[]>([]);
  const [name, setName] = useState(from?.institution ?? '');
  const [email, setEmail] = useState(from?.email ?? '');
  const [state, setState] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>('pilot');
  const [months, setMonths] = useState<number | string>(from ? 3 : 12);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ states: string[] }>('/api/plans').then((p) => setStates(p.states));
  }, []);
  const create = async () => {
    try {
      await api('/api/admin/orgs', {
        method: 'POST',
        body: {
          name,
          status,
          months: Number(months),
          billingState: state ?? '',
          billingEmail: email,
          enquiryId: from?.id ?? null,
        },
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };
  return (
    <Modal opened onClose={onClose} title="New Campus licence" centered>
      <Stack gap="xs">
        <TextInput
          label="Institution"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          data-testid="org-name"
        />
        <TextInput label="Billing email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
        <Select label="State (for GST)" data={states} value={state} onChange={setState} searchable />
        <Group grow>
          <Select
            label="Type"
            data={[
              { value: 'pilot', label: 'Pilot (unpaid)' },
              { value: 'paid', label: 'Paid' },
            ]}
            value={status}
            onChange={setStatus}
          />
          <NumberInput label="Months" value={months} onChange={setMonths} min={1} max={36} />
        </Group>
        <Text size="xs" c="dimmed">
          Seats: {PLANS.campus.seats.students} students and {PLANS.campus.seats.teachers} teachers. Join codes
          are made for you.
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        <Button onClick={() => void create()} disabled={name.length < 2} data-testid="create-org">
          Create licence
        </Button>
      </Stack>
    </Modal>
  );
}

/** The owner's dashboard (#admin). */
export function AdminPage() {
  const me = useAccount((s) => s.me);
  const [m, setM] = useState<Metrics | null>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [payments, setPayments] = useState<Record<string, string | number>[]>([]);
  const [newOrg, setNewOrg] = useState<Partial<Enquiry> | null | false>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [metrics, enq, o, p] = await Promise.all([
        api<Metrics>('/api/admin/metrics'),
        api<{ enquiries: Enquiry[] }>('/api/admin/enquiries'),
        api<{ orgs: Org[] }>('/api/admin/orgs'),
        api<{ payments: Record<string, string | number>[] }>('/api/admin/payments'),
      ]);
      setM(metrics);
      setEnquiries(enq.enquiries);
      setOrgs(o.orgs);
      setPayments(p.payments);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const paying = useMemo(
    () =>
      m
        ? Object.entries(m.paying)
            .map(([k, v]) => `${PLANS[k.split('_')[0] as 'plus'].label} ${k.split('_')[1]}: ${v}`)
            .join(' · ')
        : '',
    [m],
  );

  const act = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      notifications.show({ color: 'green', message: done });
      await load();
    } catch (e) {
      notifications.show({ color: 'red', message: e instanceof Error ? e.message : String(e) });
    }
  };

  if (me.user?.role !== 'owner') {
    return (
      <Stack p="xl" maw={480}>
        <Title order={3}>Owner dashboard</Title>
        <Text>Sign in with the owner's Google account to see this page.</Text>
        <Button w="fit-content" onClick={() => (location.hash = '')}>
          Back to MathMe
        </Button>
      </Stack>
    );
  }

  return (
    <ScrollArea h="100dvh" data-testid="admin">
      <Stack p="lg" gap="lg" maw={1200} mx="auto">
        <Group justify="space-between">
          <Group gap="sm" c="violet">
            <Tooltip label="Back to MathMe">
              <ActionIcon onClick={() => (location.hash = '')} aria-label="Back to MathMe">
                <IconArrowLeft size={18} />
              </ActionIcon>
            </Tooltip>
            <Logo size={28} />
            <Title order={2} c="var(--mantine-color-text)">
              Owner dashboard
            </Title>
          </Group>
          <Group gap={6}>
            <Button
              variant="default"
              size="xs"
              onClick={() =>
                void act(() => api('/api/admin/run-daily', { method: 'POST' }), 'Daily jobs ran.')
              }
            >
              Run daily jobs
            </Button>
            <ActionIcon onClick={() => void load()} aria-label="Refresh">
              <IconRefresh size={18} />
            </ActionIcon>
          </Group>
        </Group>
        {error && <Alert color="red">{error}</Alert>}
        {m && (
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm" data-testid="metrics">
            <Stat label="MRR (before GST)" value={inr(m.mrr)} note={`Run rate ${inr(m.arr)} a year`} />
            <Stat label="Paying users" value={String(m.payingUsers)} note={paying || 'none yet'} />
            <Stat label="Free → paid" value={pct(m.conversion)} note={`of ${m.users} users`} />
            <Stat label="Churn (30 days)" value={pct(m.churn30)} note={`${m.churned30} plans ended`} />
            <Stat label="Sign-ups" value={String(m.signups7)} note={`last 7 days · ${m.signups30} in 30`} />
            <Stat
              label="Weekly active"
              value={String(m.weeklyActive)}
              note="used MathMe in the last 7 days"
            />
            <Stat
              label="Revenue (30 days)"
              value={inr(m.revenue30)}
              note={`${inr(m.revenueAll)} all time, before GST`}
            />
            <Stat
              label="Campus"
              value={`${m.campus.paid} paid · ${m.campus.pilot} pilot`}
              note={`${m.campus.members} teachers and students`}
            />
          </SimpleGrid>
        )}
        <Tabs defaultValue="enquiries" variant="pills" radius="xl">
          <Tabs.List mb="sm">
            <Tabs.Tab value="enquiries">
              Enquiries {m?.newEnquiries ? <Badge size="xs">{m.newEnquiries}</Badge> : null}
            </Tabs.Tab>
            <Tabs.Tab value="campus">Campus licences</Tabs.Tab>
            <Tabs.Tab value="payments">Payments</Tabs.Tab>
            <Tabs.Tab value="calculator">Revenue calculator</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="enquiries">
            <Table.ScrollContainer minWidth={760}>
              <Table verticalSpacing="xs" data-testid="enquiries">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Institution</Table.Th>
                    <Table.Th>Contact</Table.Th>
                    <Table.Th>Students</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {enquiries.map((e) => (
                    <Table.Tr key={e.id}>
                      <Table.Td>
                        <Text size="sm" fw={600}>
                          {e.institution}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {e.kind} · {e.city || '—'} · {day(e.created_at)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{e.contact_name}</Text>
                        <Text size="xs" c="dimmed">
                          {e.email} {e.phone}
                        </Text>
                      </Table.Td>
                      <Table.Td>{e.students || '—'}</Table.Td>
                      <Table.Td>
                        <Select
                          size="xs"
                          w={130}
                          data={['new', 'contacted', 'converted', 'closed']}
                          value={e.status}
                          onChange={(v) =>
                            v &&
                            void act(
                              () =>
                                api(`/api/admin/enquiries/${e.id}`, { method: 'PATCH', body: { status: v } }),
                              'Saved.',
                            )
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        {e.kind === 'campus' && e.status !== 'converted' && (
                          <Button size="xs" variant="light" onClick={() => setNewOrg(e)}>
                            Start pilot
                          </Button>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {enquiries.length === 0 && (
              <Text size="sm" c="dimmed">
                No enquiries yet.
              </Text>
            )}
          </Tabs.Panel>
          <Tabs.Panel value="campus">
            <Button size="xs" mb="sm" onClick={() => setNewOrg(null)} data-testid="new-org">
              New licence
            </Button>
            <Table.ScrollContainer minWidth={900}>
              <Table verticalSpacing="xs" data-testid="orgs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Institution</Table.Th>
                    <Table.Th>Seats used</Table.Th>
                    <Table.Th>Join codes</Table.Th>
                    <Table.Th>Until</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {orgs.map((o) => (
                    <Table.Tr key={o.id}>
                      <Table.Td>
                        <Text size="sm" fw={600}>
                          {o.name}
                        </Text>
                        <Badge
                          size="xs"
                          variant="light"
                          color={o.status === 'paid' ? 'teal' : o.status === 'pilot' ? 'violet' : 'gray'}
                        >
                          {o.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {o.used.student ?? 0}/{o.student_seats} students · {o.used.teacher ?? 0}/
                        {o.teacher_seats} teachers
                      </Table.Td>
                      <Table.Td>
                        {o.codes.map((c) => (
                          <Text key={c.code} size="xs" ff="monospace" data-testid={`org-code-${c.role}`}>
                            {c.role}: {c.code}
                          </Text>
                        ))}
                      </Table.Td>
                      <Table.Td>{day(o.ends_at)}</Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Button
                            size="xs"
                            variant="default"
                            onClick={() =>
                              void act(
                                () =>
                                  api(`/api/admin/orgs/${o.id}/extend`, {
                                    method: 'POST',
                                    body: { months: 12 },
                                  }),
                                'Extended by 12 months.',
                              )
                            }
                          >
                            +12 months
                          </Button>
                          {o.status !== 'paid' && (
                            <Button
                              size="xs"
                              variant="default"
                              onClick={() => {
                                const reference = window.prompt('Payment reference (e.g. NEFT/UTR number)');
                                if (reference)
                                  void act(
                                    () =>
                                      api(`/api/admin/orgs/${o.id}/mark-paid`, {
                                        method: 'POST',
                                        body: { reference },
                                      }),
                                    'Marked paid; invoice issued.',
                                  );
                              }}
                            >
                              Mark paid
                            </Button>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Tabs.Panel>
          <Tabs.Panel value="payments">
            <Table.ScrollContainer minWidth={760}>
              <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Who</Table.Th>
                    <Table.Th>What</Table.Th>
                    <Table.Th>Invoice</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Before GST</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {payments.map((p) => (
                    <Table.Tr key={String(p.id)}>
                      <Table.Td>{day(Number(p.paid_at))}</Table.Td>
                      <Table.Td>{String(p.who ?? '')}</Table.Td>
                      <Table.Td>{String(p.description)}</Table.Td>
                      <Table.Td ff="monospace">{String(p.number ?? '')}</Table.Td>
                      <Table.Td className="mm-num">{inr(Number(p.base), true)}</Table.Td>
                      <Table.Td className="mm-num">{inr(Number(p.total), true)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {m && (
              <Text size="xs" c="dimmed" mt="xs">
                GST collected so far: {inr(m.gstCollected, true)} (pay it to the government; it is not
                revenue).
              </Text>
            )}
          </Tabs.Panel>
          <Tabs.Panel value="calculator">
            <Calculator />
          </Tabs.Panel>
        </Tabs>
      </Stack>
      {newOrg !== false && (
        <NewOrgModal
          from={newOrg}
          onClose={() => setNewOrg(false)}
          onDone={() => {
            setNewOrg(false);
            void load();
          }}
        />
      )}
    </ScrollArea>
  );
}
