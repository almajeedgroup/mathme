import { Center, Stack, Text, Title } from '@mantine/core';

export function App() {
  return (
    <Center h="100%">
      <Stack align="center" gap="xs">
        <Title order={1}>MathMe 3D Studio</Title>
        <Text c="dimmed">Build 3D art from simple shapes and math patterns.</Text>
      </Stack>
    </Center>
  );
}
