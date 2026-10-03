import { Button, Group, Modal, Stepper, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';

import { useUiStore } from '../state/uiStore';

const TOUR_KEY = 'mathme.tour.done';

function tourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return true;
  }
}

function markTourDone() {
  try {
    localStorage.setItem(TOUR_KEY, '1');
  } catch {
    /* private mode: just don't remember */
  }
}

const STEPS = [
  {
    label: 'Shapes',
    icon: '🧊',
    title: '1. Add a shape',
    text: 'Pick a shape on the left (a cuboid, a sphere, a cone…) or draw your own with the pencil (press P). For flat geometry, switch to 2D at the top. Then change its width, height and depth on the right, using simple words and numbers.',
  },
  {
    label: 'Patterns',
    icon: '🌀',
    title: '2. Let maths copy it',
    text: 'Click a pattern (spiral, grid, circle, wave…) and your shape is copied hundreds of times. Or type a recipe at the top, like “100 spheres → spiral → radius 20”.',
  },
  {
    label: 'Learn & export',
    icon: '📐',
    title: '3. See the maths, then share',
    text: 'The Learn and Measure tabs show the formulas with your own numbers. When you are happy, Export a 3D model (GLB, STL), a picture (PNG) or a PDF sheet.',
  },
];

/** A short welcome shown the first time someone opens the app. */
export function WelcomeTour() {
  const [open, setOpen] = useState(() => !tourDone());
  const [step, setStep] = useState(0);
  const tourRequest = useUiStore((s) => s.tourRequest);
  useEffect(() => {
    if (tourRequest === 0) return;
    setStep(0);
    setOpen(true);
  }, [tourRequest]);
  const close = () => {
    markTourDone();
    setOpen(false);
  };
  const last = step === STEPS.length - 1;
  return (
    <Modal
      opened={open}
      onClose={close}
      size="lg"
      centered
      title="Welcome to MathMe 3D Studio"
      data-testid="welcome"
    >
      <Stepper active={step} onStepClick={setStep} size="sm" mb="md">
        {STEPS.map((s) => (
          <Stepper.Step key={s.label} label={s.label} icon={<span aria-hidden>{s.icon}</span>} />
        ))}
      </Stepper>
      <Title order={4} mb={6}>
        {STEPS[step].title}
      </Title>
      <Text size="sm" mb="lg">
        {STEPS[step].text}
      </Text>
      <Group justify="space-between">
        <Button variant="subtle" onClick={close}>
          Skip
        </Button>
        <Group gap="xs">
          {step > 0 && (
            <Button variant="default" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button onClick={() => (last ? close() : setStep(step + 1))}>
            {last ? 'Start making!' : 'Next'}
          </Button>
        </Group>
      </Group>
    </Modal>
  );
}
