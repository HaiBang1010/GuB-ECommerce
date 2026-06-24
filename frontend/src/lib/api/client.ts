// Typed fetch client for the GuB backend API.
//
// The base URL comes from NEXT_PUBLIC_API_URL (set in .env.local); it falls back
// to the local backend port (3001) so the app runs out of the box in dev. The
// browser only ever talks to this backend — never directly to the DB/Stripe.
// A later auth slice will attach `Authorization: Bearer <supabase-jwt>` here.

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
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => undefined);
    const message =
      (body as { message?: string } | undefined)?.message ??
      `Request to ${path} failed (HTTP ${res.status})`;
    throw new ApiError(res.status, message, body);
  }

  return res.json() as Promise<T>;
}
