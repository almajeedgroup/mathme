/**
 * Client for the Python geometry service (geometry-service/).
 * In development Vite forwards /api/* to it; in production set VITE_GEOMETRY_API_URL.
 */

const configured = import.meta.env.VITE_GEOMETRY_API_URL as string | undefined;
export const GEOMETRY_API_URL = (configured || '/api').replace(/\/$/, '');

export class ServiceError extends Error {}

export interface AnalyzeResult {
  parts: number;
  solid_parts: number;
  open_parts: number;
  triangles: number;
  volume: number | null;
  volume_sum: number;
  overlap_volume: number | null;
  surface_area: number;
  bounds: { min: number[]; max: number[]; size: number[] };
  is_watertight: boolean;
  bodies: number | null;
  notes: string[];
}

export type BooleanOperation = 'union' | 'difference' | 'intersection';
export type PrintFormat = 'stl' | '3mf' | 'obj' | 'ply';

async function call(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${GEOMETRY_API_URL}${path}`, { ...init, signal: controller.signal });
  } catch {
    throw new ServiceError('The geometry service is not answering. Is it running?');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = `The geometry service said no (error ${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body.detail === 'string') detail = body.detail;
      else if (Array.isArray(body.detail)) detail = body.detail.map((d: { msg?: string }) => d.msg).join(' ');
    } catch {
      /* not JSON */
    }
    throw new ServiceError(detail);
  }
  return res;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await call('/health', { method: 'GET' }, 3000);
    const body = await res.json();
    return body.status === 'ok';
  } catch {
    return false;
  }
}

function form(files: Record<string, Blob>, fields: Record<string, string> = {}): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(files)) fd.append(k, v, `${k}.glb`);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

export async function analyzeModel(glb: Blob): Promise<AnalyzeResult> {
  const res = await call('/analyze', { method: 'POST', body: form({ file: glb }) }, 90_000);
  return res.json();
}

export async function booleanModels(a: Blob, b: Blob, operation: BooleanOperation): Promise<ArrayBuffer> {
  const res = await call('/boolean', { method: 'POST', body: form({ a, b }, { operation }) }, 90_000);
  return res.arrayBuffer();
}

export async function printReadyExport(
  glb: Blob,
  opts: { format: PrintFormat; scale: number; name: string },
): Promise<{ blob: Blob; notes: string | null }> {
  const res = await call(
    '/export',
    {
      method: 'POST',
      body: form(
        { file: glb },
        { format: opts.format, scale: String(opts.scale), name: opts.name, union: 'true', repair: 'true' },
      ),
    },
    120_000,
  );
  return { blob: await res.blob(), notes: res.headers.get('X-Notes') };
}

/** Cut a model with a plane: a zip with both halves (GLB) and one STL per half. */
export async function sliceModel(
  glb: Blob,
  opts: { point: number[]; normal: number[]; scale: number; name: string },
): Promise<{ blob: Blob; notes: string | null }> {
  const res = await call(
    '/slice',
    {
      method: 'POST',
      body: form(
        { file: glb },
        {
          point: opts.point.map((v) => v.toFixed(5)).join(','),
          normal: opts.normal.map((v) => v.toFixed(6)).join(','),
          scale: String(opts.scale),
          name: opts.name,
        },
      ),
    },
    120_000,
  );
  return { blob: await res.blob(), notes: res.headers.get('X-Notes') };
}
