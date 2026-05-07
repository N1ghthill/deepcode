export async function* parseSse(response: Response): AsyncIterable<any> {
  if (!response.body) {
    return;
  }
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex >= 0) {
      const frame = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const data = frame
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");

      if (data && data !== "[DONE]") {
        try {
          yield JSON.parse(data);
        } catch {
          yield data;
        }
      }
      separatorIndex = buffer.indexOf("\n\n");
    }
  }
}
