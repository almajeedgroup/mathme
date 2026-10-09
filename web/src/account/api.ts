/**
 * The MathMe account API (account-service/, a Cloudflare Worker on the same site as the app).
 * Built with VITE_ACCOUNTS=on for the hosted product; off for local use, self-hosting and the demo.
 */
export const ACCOUNTS_ON = import.meta.env.VITE_ACCOUNTS === 'on';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; raw?: BodyInit; headers?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'X-MathMe': '1', ...init.headers };
  let body: BodyInit | undefined = init.raw;
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body);
  }
  let res: Response;
  try {
    res = await fetch(path, { method: init.method ?? 'GET', headers, body, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'MathMe’s server is not answering. Check your internet connection.');
  }
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : typeof (detail as { message?: unknown })?.message === 'string'
          ? (detail as { message: string }).message
          : `Something went wrong (error ${res.status}).`;
    throw new ApiError(res.status, message, detail);
  }
  return data as T;
}
