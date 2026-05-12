export function traverseErrorChain(error: unknown): string[] {
  const messages: string[] = [];
  let current: unknown = error;
  let depth = 0;

  while (current && depth < 6) {
    if (current instanceof Error) {
      messages.push(current.message);
      current = "cause" in current ? current.cause : undefined;
      depth += 1;
      continue;
    }
    if (typeof current === "object" && current !== null && "message" in current) {
      const message = (current as { message?: unknown }).message;
      if (typeof message === "string") {
        messages.push(message);
      }
      current = "cause" in current ? (current as { cause?: unknown }).cause : undefined;
      depth += 1;
      continue;
    }
    break;
  }

  return messages.filter((message, index) => messages.indexOf(message) === index);
}

export function formatErrorChain(error: unknown): string {
  const messages = traverseErrorChain(error);
  return messages.length > 0 ? messages.join(": ") : String(error);
}
