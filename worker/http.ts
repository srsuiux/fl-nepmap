export const USER_AGENT = "NepalFloodWatch/0.1 (contact: ssharma33@student.ysu.edu)";

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

// BIPAD's `count` is bogus (int64 max); always follow `next`.
export async function getAllPages<T>(url: string, maxPages = 50): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = url;
  for (let i = 0; next; i++) {
    if (i >= maxPages) throw new Error(`pagination exceeded ${maxPages} pages for ${url}`);
    const page: { results: T[]; next: string | null } = await getJson(next);
    out.push(...page.results);
    next = page.next && page.results.length ? page.next : null;
  }
  return out;
}
