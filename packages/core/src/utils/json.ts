export function readJsonLines(input: string): unknown[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as unknown];
      } catch {
        return [];
      }
    });
}

export function stringifyStable(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort(), 2);
}
