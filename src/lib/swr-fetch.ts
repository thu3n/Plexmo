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
  // A 200 that isn't JSON means a redirect was silently followed to an HTML
  // page (login, reverse-proxy interstitial). Raw parse errors are cryptic in
  // WebKit ("The string did not match the expected pattern") — say what
  // actually happened instead.
  return res.json().catch(() => {
    throw new Error(`Unexpected non-JSON response (${res.status})`);
  }) as Promise<T>;
};

/**
 * Mutation counterpart of fetchJsonOrThrow: sends a JSON body and throws with
 * the API's `error` message on non-OK responses. `fetch` itself only rejects
 * on network failure, so callers that skip the status check report failed
 * saves/deletes as successes.
 */
export const requestJson = async <T = unknown>(
  url: string,
  init: { method: "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown }
): Promise<T> => {
  const res = await fetch(url, {
    method: init.method,
    headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
};
