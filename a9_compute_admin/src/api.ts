import type { ApiEnvelope, ComputePayload } from './types';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const payload = (await response.json()) as T & { err_code?: number; error?: string };
  if (typeof payload.err_code === 'number' && payload.err_code !== 0) {
    throw new Error(payload.error || `api err_code=${payload.err_code}`);
  }
  return payload;
}

export const api = {
  computeConsole: () => getJson<ApiEnvelope<ComputePayload>>('/api/compute/autodl/console'),
};
