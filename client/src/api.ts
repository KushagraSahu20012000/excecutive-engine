export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
  } catch (_error) {
    throw new ApiError('Backend is not reachable. Start the server and check MongoDB.', 0);
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