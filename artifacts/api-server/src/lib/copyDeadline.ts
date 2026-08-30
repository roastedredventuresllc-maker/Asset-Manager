/**
 * Grok attempt wall. Preview FffLCyMhqR9LaR4V2TymR8rLYJcV aborted at 12s
 * and 504'd copy_timeout at 13.6s — briefing never got ads. 17s still
 * leaves persist + res.json under the 20s HTTP contract. On miss,
 * writeCampaignCopy fail-closes from the brief instead of 504.
 */
export const COPY_DEADLINE_MS = 17_000;

export async function withDeadline<T>(
  work: Promise<T>,
  ms: number,
  onTimeout: () => Error,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(onTimeout()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
