/**
 * Shared SWR fetcher that THROWS on non-OK responses, so API errors land in
 * SWR's `error` instead of masquerading as data. A fetcher that returns the
 * error body as data is how a 401 once crashed the history page
 * ("activeSessions is not iterable" — spreading fields of {error: ...}).
 */
export const fetchJsonOrThrow = async <T = unknown>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
};
