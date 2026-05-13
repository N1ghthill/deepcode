/**
 * Wait long enough for React/ink to process state updates and re-render.
 * setTimeout(0) is insufficient in CI — use at least 20ms.
 */
export async function settleInk(ms = 20): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}
