// Typed fetch client for the GuB backend API.
//
// The base URL comes from NEXT_PUBLIC_API_URL (set in .env.local); it falls back
// to the local backend port (3001) so the app runs out of the box in dev. The
// browser only ever talks to this backend — never directly to the DB/Stripe.
// When a Supabase session exists (browser), the access token is attached as a
// Bearer header so the backend's auth guards see the user.

import { createClient } from '@/lib/supabase/client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Thrown on any non-2xx response; carries the HTTP status and the parsed error body.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');

  // Attach the Supabase access token when logged in (browser only). Public
  // endpoints ignore it; guarded ones (cart, orders) need it.
  if (typeof window !== 'undefined') {
    const {
      data: { session },
    } = await createClient().auth.getSession();
    if (session) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
    }
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch (err) {
    // The request was cancelled because the component unmounted / the page
    // navigated away (e.g. a guard redirect). Re-throw the AbortError so TanStack
    // Query treats it as a cancellation, NOT a surfaced error.
    if (
      init?.signal?.aborted ||
      (err instanceof DOMException && err.name === 'AbortError')
    ) {
      throw err;
    }
    // A genuine network failure (e.g. backend unreachable) — surface it as a
    // handled ApiError so the UI shows an error state instead of an uncaught
    // "Failed to fetch" TypeError.
    throw new ApiError(0, 'Network error: could not reach the API.', err);
  }

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => undefined);
    const message =
      (body as { message?: string } | undefined)?.message ??
      `Request to ${path} failed (HTTP ${res.status})`;
    throw new ApiError(res.status, message, body);
  }

  return res.json() as Promise<T>;
}
