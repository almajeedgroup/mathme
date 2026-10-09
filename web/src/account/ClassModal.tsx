import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Code,
  Group,
  Modal,
  NumberInput,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconCopy, IconUserMinus } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';

import type { Project } from '../engine/types';
import { startNewProject } from '../ui/navigation';
import { notifications } from '../ui/notify';
import { useAccount } from './accountStore';
import { useAccountUi } from './accountUi';
import { api, ApiError } from './api';

interface ClassView {
  org: {
    id: string;
    name: string;
    status: string;
    active: boolean;
    endsAt: number;
    seats: { teacher: number; student: number };
    used: { teacher: number; student: number };
  } | null;
  role?: 'teacher' | 'student';
  projects?: {
    id: string;
    name: string;
    objects: number;
    updated_at: number;
    owner_name: string;
    has_thumb: number;
  }[];
  codes?: { code: string; role: string }[];
  members?: { id: string; name: string; email: string; role: string }[];
}

/** Campus: join with a code; the class page with the roster (teachers) and the students' shared projects. */
export function ClassModal() {
  const open = useAccountUi((s) => s.classOpen);
  const set = useAccountUi((s) => s.set);
  const refreshMe = useAccount((s) => s.refresh);
  const [view, setView] = useState<ClassView | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<ClassView>('/api/campus')
      .then(setView)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const join = async () => {
    setError(null);
    try {
      await api('/api/campus/join', { method: 'POST', body: { code } });
      await refreshMe();
      load();
      notifications.show({ color: 'violet', message: 'You joined the class.' });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };
  const openCopy = async (id: string, owner: string) => {
    const p = await api<{ data: Project; name: string }>(`/api/projects/${id}`);
    set({ classOpen: false });
    startNewProject({ ...p.data, name: `${p.name} (by ${owner})` });
  };
  const remove = async (userId: string) => {
    await api(`/api/campus/members/${userId}`, { method: 'DELETE' });
    load();
  };

  const org = view?.org;
  return (
    <Modal
      opened={open}
      onClose={() => set({ classOpen: false })}
      title={org ? org.name : 'Join a class'}
      size="xl"
      centered
      classNames={{ title: 'mm-modal-title' }}
    >
      {!org ? (
        <Stack gap="sm" maw={420}>
          <Text size="sm">
            Your teacher or school gives you a join code. Teachers and students have different codes.
          </Text>
          <Group align="flex-end" wrap="nowrap">
            <TextInput
              label="Join code"
              value={code}
              onChange={(e) => setCode(e.currentTarget.value.toUpperCase())}
              placeholder="ABCD2345"
              flex={1}
              data-testid="join-code"
            />
            <Button onClick={() => void join()} disabled={code.trim().length < 4} data-testid="join-class">
              Join
            </Button>
          </Group>
          {error && <Alert color="red">{error}</Alert>}
          <Text size="xs" c="dimmed">
            Is your school not on MathMe yet?{' '}
            <Text
              span
              c="violet"
              style={{ cursor: 'pointer' }}
              onClick={() => set({ classOpen: false, enquiry: 'campus' })}
            >
              Ask about a pilot
            </Text>
            .
          </Text>
        </Stack>
      ) : (
        <Stack gap="md" data-testid="class-page">
          <Group gap={6}>
            <Badge variant="light">{view?.role === 'teacher' ? 'Teacher' : 'Student'}</Badge>
            <Badge variant="light" color={org.active ? 'teal' : 'gray'}>
              {org.active
                ? `Licence until ${new Date(org.endsAt * 1000).toLocaleDateString('en-IN')}`
                : 'Licence ended'}
            </Badge>
            <Badge variant="light">
              {org.used.student}/{org.seats.student} students · {org.used.teacher}/{org.seats.teacher}{' '}
              teachers
            </Badge>
          </Group>
          {view?.codes && (
            <Group gap="md">
              {view.codes.map((c) => (
                <Group key={c.code} gap={4}>
                  <Text size="sm">{c.role === 'teacher' ? 'Teacher code' : 'Student code'}:</Text>
                  <Code data-testid={`code-${c.role}`}>{c.code}</Code>
                  <Tooltip label="Copy">
                    <ActionIcon
                      size="sm"
                      onClick={() => void navigator.clipboard?.writeText(c.code).catch(() => undefined)}
                    >
                      <IconCopy size={13} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              ))}
            </Group>
          )}
          <Text className="mm-label">Shared projects</Text>
          {view?.projects?.length ? (
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              {view.projects.map((p) => (
                <div key={p.id} className="mm-project" data-testid="class-project">
                  <div className="mm-project-thumb">
                    {p.has_thumb ? <img src={`/api/projects/${p.id}/thumb`} alt="" /> : null}
                  </div>
                  <div className="mm-project-meta">
                    <Text size="sm" fw={600} truncate>
                      {p.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      by {p.owner_name || 'a student'} · {p.objects} objects
                    </Text>
                    <Button
                      size="xs"
                      variant="light"
                      mt={6}
                      onClick={() => void openCopy(p.id, p.owner_name)}
                    >
                      Open a copy
                    </Button>
                  </div>
                </div>
              ))}
            </SimpleGrid>
          ) : (
            <Text size="sm" c="dimmed">
              Nothing shared yet. Students share a cloud project from its ⋯ menu on the home page.
            </Text>
          )}
          {view?.members && (
            <>
              <Text className="mm-label">Class list</Text>
              <Table verticalSpacing={4} data-testid="roster">
                <Table.Tbody>
                  {view.members.map((m) => (
                    <Table.Tr key={m.id}>
                      <Table.Td>{m.name || m.email}</Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {m.email}
                        </Text>
                      </Table.Td>
                      <Table.Td>{m.role}</Table.Td>
                      <Table.Td>
                        {m.role === 'student' && (
                          <Tooltip label="Remove from the class">
                            <ActionIcon
                              size="sm"
                              onClick={() => void remove(m.id)}
                              aria-label={`Remove ${m.email}`}
                            >
                              <IconUserMinus size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </>
          )}
        </Stack>
      )}
    </Modal>
  );
}

/** Campus pilot or Enterprise enquiry. */
export function EnquiryModal() {
  const kind = useAccountUi((s) => s.enquiry);
  const set = useAccountUi((s) => s.set);
  const [form, setForm] = useState({
    institution: '',
    contactName: '',
    email: '',
    phone: '',
    city: '',
    message: '',
  });
  const [students, setStudents] = useState<number | string>(100);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.currentTarget.value }),
  });
  const send = async () => {
    setError(null);
    try {
      await api('/api/enquiries', {
        method: 'POST',
        body: { kind, ...form, students: Number(students) || 0 },
      });
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };
  return (
    <Modal
      opened={kind !== null}
      onClose={() => {
        set({ enquiry: null });
        setSent(false);
      }}
      title={kind === 'enterprise' ? 'Enterprise enquiry' : 'MathMe for your school'}
      centered
      classNames={{ title: 'mm-modal-title' }}
    >
      {sent ? (
        <Text data-testid="enquiry-sent">Thank you! We will contact you within two working days.</Text>
      ) : (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            {kind === 'enterprise'
              ? 'Tell us about your team and what you would like to do with MathMe.'
              : 'Campus licences start with a pilot for your teachers and students. Tell us about your institution.'}
          </Text>
          <TextInput label="Institution or company" required {...field('institution')} />
          <TextInput label="Your name" required {...field('contactName')} />
          <TextInput label="Email" type="email" required {...field('email')} />
          <Group grow>
            <TextInput label="Phone" {...field('phone')} />
            <TextInput label="City" {...field('city')} />
          </Group>
          <NumberInput
            label={kind === 'enterprise' ? 'People' : 'Students'}
            value={students}
            onChange={setStudents}
            min={0}
          />
          <Textarea label="Anything else?" autosize minRows={2} {...field('message')} />
          {error && <Alert color="red">{error}</Alert>}
          <Button
            onClick={() => void send()}
            disabled={!form.institution || !form.contactName || !form.email}
            data-testid="send-enquiry"
          >
            Send
          </Button>
        </Stack>
      )}
    </Modal>
  );
}
