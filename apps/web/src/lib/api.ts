export async function api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(typeof result.message === 'string' ? result.message : `${response.status}`);
  }
  return response.json();
}
export function localMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function localDate() {
  const d = new Date();
  return `${localMonth()}-${String(d.getDate()).padStart(2, '0')}`;
}
export function cents(value: FormDataEntryValue | null) {
  return Math.round(Number(value) * 100);
}
