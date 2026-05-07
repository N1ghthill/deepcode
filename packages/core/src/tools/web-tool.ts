import { Effect } from "effect";
import { z } from "zod";
import type { Activity } from "@deepcode/shared";
import type { ToolContext } from "./tool.js";
import { defineTool } from "./tool.js";

export const fetchWebTool = defineTool({
  name: "fetch_web",
  description: `Fetch content from a URL. Useful for reading documentation, API references, or web resources.
Returns the content as text. Supports HTTP and HTTPS URLs.
Use this to look up documentation, library APIs, or other web resources relevant to the task.`,
  parameters: z.object({
    url: z.string().url().describe("URL to fetch (must start with http:// or https://)"),
    maxLength: z
      .number()
      .int()
      .positive()
      .max(50000)
      .optional()
      .describe("Maximum content length to return (default: 10000)"),
  }),
  execute: (args, context: ToolContext): Effect.Effect<string, Error> =>
    Effect.gen(function* () {
      const url = args.url;
      const maxLength = args.maxLength ?? 10000;

      const activity: Omit<Activity, "id" | "createdAt"> = {
        type: "web_fetch",
        message: `Fetching ${url}`,
        metadata: { url, maxLength },
      };
      context.logActivity(activity);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      try {
        const response = yield* Effect.tryPromise({
          try: () =>
            fetch(url, {
              signal: controller.signal,
              headers: {
                "User-Agent": "DeepCode/1.0 (AI coding agent)",
                Accept: "text/html, text/plain, application/json, */*",
              },
            }),
          catch: (error) =>
            new Error(
              `Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`,
            ),
        });

        clearTimeout(timeout);

        if (!response.ok) {
          return `HTTP ${response.status} ${response.statusText} from ${url}`;
        }

        const contentType = response.headers.get("content-type") || "";
        let text = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: (error) =>
            new Error(
              `Failed to read response: ${error instanceof Error ? error.message : String(error)}`,
            ),
        });

        if (text.length > maxLength) {
          text = text.slice(0, maxLength) + "\n\n[Content truncated. Use maxLength to fetch more.]";
        }

        if (contentType.includes("text/html")) {
          text = extractTextFromHtml(text);
        }

        return `Fetched ${url} (${contentType})\n\n${text}`;
      } catch (error) {
        clearTimeout(timeout);
        return `Error fetching ${url}: ${error instanceof Error ? error.message : String(error)}`;
      }
    }),
});

function extractTextFromHtml(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/\s+/g, " ");
  return text.trim();
}
