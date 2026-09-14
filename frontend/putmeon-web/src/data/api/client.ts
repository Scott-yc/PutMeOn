export class ApiRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-PutMeOn-Request': '1', ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiRequestError(
      body?.error ??
        (response.status === 429
          ? 'Too many requests. Please wait and try again.'
          : 'The service is unavailable. Please try again.'),
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
