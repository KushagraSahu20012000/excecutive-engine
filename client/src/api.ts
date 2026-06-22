export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function buildApiUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  if (!API_BASE) return path;

  if (typeof window !== 'undefined') {
    const isLocalHost = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
    if (!isLocalHost) return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  const hasBody = typeof options.body !== 'undefined' && options.body !== null;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && hasBody && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    response = await fetch(buildApiUrl(path), {
      credentials: 'include',
      headers,
      ...options
    });
  } catch (_error) {
    throw new ApiError('Backend is not reachable. Check VITE_API_BASE_URL and backend deployment status.', 0);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const fallback = response.status >= 500 ? 'Server error. Check backend logs and MongoDB connection.' : 'Request failed';
    throw new ApiError(body.message || fallback, response.status);
  }

  return response.json() as Promise<T>;
}

export function jsonBody(body: unknown): RequestInit {
  return { body: JSON.stringify(body) };
}