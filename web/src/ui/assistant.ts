import { parseCommand, type ParsedCommand } from '../engine/command/parser';
import { countObjects } from '../engine/evaluate';
import { emptyProject } from '../engine/project/defaults';
import { PRESETS } from '../engine/project/presets';
import type { Project } from '../engine/types';
import { getClaudeSample, SAMPLE_GONE } from '../services/claudeSample';
import { assist } from '../services/geometryApi';
import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { applyCommand, loadProject, openHeart } from './actions';
import { assistantPrompt } from './assistantPrompt';
import { openCutTool } from './CutPanel';
import { startNewProject } from './navigation';

/** Words that pick a ready-made idea. The heart needs "real" or "human" so a heart-shaped outline still works. */
const IDEA_WORDS: Record<string, RegExp> = {
  spec: /\bspiral of spheres\b/,
  sunflower: /\bsunflower\b/,
  staircase: /\bstair(case|s)?\b/,
  dna: /\b(dna|double helix)\b/,
  atom: /\batom\b/,
  'wave-field': /\bwave field\b/,
  snowflake: /\bsnowflakes?\b/,
  'spiky-ball': /\bspiky\b/,
  pottery: /\bpott(ery|s)\b/,
  mobius: /\bm(o|ö)bius\b/,
  landscape: /\b(maths?|math) landscape\b/,
  heart: /\b(real|human|anatomical)\s+heart\b/,
};

export interface AskResult {
  reply: string;
  ok: boolean;
  /** Who answered: the AI model, or MathMe's own recipe reader. */
  by: 'ai' | 'recipes';
}

interface Plan {
  reply: string;
  idea: string | null;
  commands: ParsedCommand[];
  name: string | null;
  by: AskResult['by'];
}

function sceneSummary(project: Project): string {
  const top = project.nodes.filter((n) => n.parentId === null).slice(0, 20);
  if (!top.length) return 'The scene is empty.';
  return (
    `${countObjects(project)} objects. ` +
    top
      .map((n) =>
        n.kind === 'pattern'
          ? `${n.name}: ${n.count} copies in a ${n.pattern.type} pattern`
          : `${n.name}: one ${n.kind === 'group' ? 'group' : 'object'}`,
      )
      .join('; ')
  );
}

function projectName(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  const short = t.length > 40 ? `${t.slice(0, 38).trimEnd()}…` : t;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

/** MathMe's own reader: ready-made ideas plus the recipe language, one recipe per line or "then". */
function localPlan(text: string): Plan {
  const lower = text.toLowerCase();
  const idea = Object.entries(IDEA_WORDS).find(([, re]) => re.test(lower))?.[0] ?? null;
  const parts = text
    .split(/\n|;|\bthen\b|\band then\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const commands: ParsedCommand[] = [];
  let firstError: string | null = null;
  for (const part of parts) {
    const result = parseCommand(part);
    if (result.ok) {
      if (result.shape || result.pattern || result.count) commands.push(result);
    } else firstError ??= result.error;
  }
  if (idea && !commands.length) {
    const title = idea === 'heart' ? 'Human heart' : PRESETS.find((p) => p.id === idea)?.title;
    return {
      reply: `Here is “${title}”. Change any number on the right.`,
      idea,
      commands,
      name: null,
      by: 'recipes',
    };
  }
  if (!commands.length) {
    return {
      reply:
        (firstError ? `${firstError} ` : '') +
        'Try something like “200 rainbow cubes in a wave”, “50 red spheres in a circle” or “DNA”.',
      idea: null,
      commands,
      name: null,
      by: 'recipes',
    };
  }
  return { reply: '', idea, commands, name: projectName(text), by: 'recipes' };
}

interface AiAnswer {
  reply?: unknown;
  commands?: unknown;
  idea?: unknown;
  name?: unknown;
}

const IDEA_IDS = [...PRESETS.map((p) => p.id), 'heart'];

/** Keep only recipes MathMe's own reader accepts, and only real idea ids. */
function planFromAnswer(answer: AiAnswer): Plan {
  const commands: ParsedCommand[] = [];
  for (const c of Array.isArray(answer.commands) ? answer.commands.slice(0, 8) : []) {
    const r = parseCommand(String(c));
    if (r.ok && (r.shape || r.pattern || r.count)) commands.push(r);
  }
  const idea = typeof answer.idea === 'string' && IDEA_IDS.includes(answer.idea) ? answer.idea : null;
  const name = typeof answer.name === 'string' && answer.name.trim() ? answer.name.slice(0, 40) : null;
  return { reply: typeof answer.reply === 'string' ? answer.reply : '', idea, commands, name, by: 'ai' };
}

async function aiPlan(text: string, scene: string): Promise<Plan | null> {
  const ui = useUiStore.getState();
  if (ui.assistantOnline) {
    try {
      return planFromAnswer(await assist(text, scene, IDEA_IDS));
    } catch {
      /* fall through */
    }
  }
  if (ui.claudeChat) {
    const sample = await getClaudeSample();
    if (sample) {
      try {
        return planFromAnswer(
          await sample.json<AiAnswer>(assistantPrompt(text, scene, IDEA_IDS), { modelTier: 'quick' }),
        );
      } catch (e) {
        const code = (e as { code?: string })?.code ?? '';
        if (SAMPLE_GONE.has(code)) useUiStore.setState({ claudeChat: false });
      }
    }
  }
  return null; // use the recipe reader
}

async function startIdea(idea: string, inStudio: boolean) {
  if (idea === 'heart') {
    if (inStudio) await openHeart();
    else {
      const { buildHeartProject } = await import('../services/modelAssets');
      startNewProject(await buildHeartProject());
    }
    setTimeout(openCutTool, 400);
    return;
  }
  const preset = PRESETS.find((p) => p.id === idea);
  if (!preset) return;
  if (inStudio) loadProject(preset.build());
  else startNewProject(preset.build());
}

/**
 * Turn a request into a scene. On the home page it starts a new project; in the studio it changes the open one.
 * Uses an AI model when one is reachable (the geometry service, or Claude in the claude.ai viewer),
 * otherwise MathMe's recipe reader.
 */
export async function askMathMe(text: string): Promise<AskResult> {
  const inStudio = useUiStore.getState().view === 'studio';
  const scene = inStudio ? sceneSummary(useProjectStore.getState().project) : 'No project is open yet.';
  const plan = (await aiPlan(text, scene)) ?? localPlan(text);
  if (!plan.idea && !plan.commands.length) return { reply: plan.reply, ok: false, by: plan.by };

  if (plan.idea) await startIdea(plan.idea, inStudio);
  else if (!inStudio) startNewProject(emptyProject(plan.name ?? projectName(text)));

  const made: string[] = [];
  for (const cmd of plan.commands) {
    // on a fresh project each recipe adds its own pattern; in the studio a recipe can change the selection
    if (!inStudio || plan.commands.length > 1) useUiStore.getState().select(null);
    made.push(applyCommand(cmd));
  }
  const reply = plan.reply || `Made ${made.join(', then ')}.`;
  return { reply, ok: true, by: plan.by };
}
