import { useUiStore } from '../state/uiStore';

/**
 * When MathMe runs as a published claude.ai artifact, the page can ask Claude through the viewer's own
 * account (the artifact `sample` capability). Anywhere else `window.claude` is missing and this does nothing.
 */
export type SampleJson = <T>(
  input: string,
  options?: { modelTier?: 'quick' | 'default' | 'complex' },
) => Promise<T>;

interface SampleFn {
  json: SampleJson;
}

interface ClaudeWindow {
  claude?: { use?: (name: string) => Promise<unknown> };
}

let pending: Promise<SampleFn | null> | null = null;

export function getClaudeSample(): Promise<SampleFn | null> {
  const claude = (window as unknown as ClaudeWindow).claude;
  if (typeof claude?.use !== 'function') return Promise.resolve(null);
  // call it as a method: the viewer's runtime may rely on `this`
  pending ??= claude
    .use('sample')
    .then((s) => (s && typeof (s as SampleFn).json === 'function' ? (s as SampleFn) : null))
    .catch(() => null);
  return pending;
}

/** Light up the AI chat when the artifact viewer offers Claude. */
export async function detectClaudeSample() {
  const sample = await getClaudeSample();
  useUiStore.setState({ claudeChat: Boolean(sample) });
}

/** Codes that mean "no Claude in this view": hide the AI and use the recipe reader. */
export const SAMPLE_GONE = new Set([
  'not_granted',
  'sampling_disabled',
  'not_declared',
  'capability_disabled',
  'capability_removed',
]);
