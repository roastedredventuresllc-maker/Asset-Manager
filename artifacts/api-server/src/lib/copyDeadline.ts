/**
 * Hard wall for founder generate. Grok has no default timeout; preview
 * POST /generate sat 90s with 0 bytes because createCampaign awaited copy.
 * Well under 20s so the handler can always write JSON.
 */
export const COPY_DEADLINE_MS = 15_000;

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
