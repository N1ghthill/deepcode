// DeepSeek DSML (DeepSeek Model Language) tool call format parser.
// Some DeepSeek models output tool calls as DSML in the content stream
// instead of using the standard OpenAI-compatible tool_calls delta field.
//
// Format example:
//   <｜｜DSML｜｜tool_calls>
//   <｜｜DSML｜｜invoke name="read_file">
//   <｜｜DSML｜｜parameter name="path" string="true">/path/to/file</｜｜DSML｜｜parameter>
//   </｜｜DSML｜｜invoke>
//   </｜｜DSML｜｜tool_calls>

// DeepSeek uses fullwidth vertical lines (U+FF5C) as token delimiters, but some
// API proxies or model variants may use regular ASCII pipes. Match both.
const PIPE_PAT = "[｜|]{1,2}"; // one or two of ｜ (U+FF5C) or | (U+007C)
// Fast-path hint: unique substring present in every DSML response.
// Used by the provider to skip parsing when content has no DSML at all.
export const DSML_HINT = "DSML";

const TOOL_CALLS_OPEN_RE = new RegExp(`<${PIPE_PAT}DSML${PIPE_PAT}tool_calls>`, "i");
const TOOL_CALLS_CLOSE_RE = new RegExp(`<\\/${PIPE_PAT}DSML${PIPE_PAT}tool_calls>`, "i");
const INVOKE_RE_SRC = `<${PIPE_PAT}DSML${PIPE_PAT}invoke name="([^"]+)">(.*?)<\\/${PIPE_PAT}DSML${PIPE_PAT}invoke>`;
const PARAM_RE_SRC = `<${PIPE_PAT}DSML${PIPE_PAT}parameter name="([^"]+)"([^>]*)>(.*?)<\\/${PIPE_PAT}DSML${PIPE_PAT}parameter>`;

export interface DSMLParseResult {
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
  remainder: string;
}

export function parseDSMLToolCalls(content: string): DSMLParseResult | null {
  const openMatch = TOOL_CALLS_OPEN_RE.exec(content);
  if (!openMatch) return null;
  const startIdx = openMatch.index;
  const blockStart = startIdx + openMatch[0].length;

  const closeMatch = TOOL_CALLS_CLOSE_RE.exec(content.slice(blockStart));
  if (!closeMatch) return null; // block not yet complete
  const blockEnd = blockStart + closeMatch.index;
  const closeEnd = blockEnd + closeMatch[0].length;

  const remainder = (content.slice(0, startIdx) + content.slice(closeEnd)).trim();
  const block = content.slice(blockStart, blockEnd);

  const toolCalls: DSMLParseResult["toolCalls"] = [];
  const invokeRe = new RegExp(INVOKE_RE_SRC, "gis");

  let invokeMatch: RegExpExecArray | null;
  while ((invokeMatch = invokeRe.exec(block)) !== null) {
    const toolName = invokeMatch[1]!;
    const paramBlock = invokeMatch[2]!;
    const args: Record<string, unknown> = {};

    const paramRe = new RegExp(PARAM_RE_SRC, "gis");
    let paramMatch: RegExpExecArray | null;
    while ((paramMatch = paramRe.exec(paramBlock)) !== null) {
      const paramName = paramMatch[1]!;
      const paramAttrs = paramMatch[2]!;
      const rawValue = paramMatch[3]!.trim();
      args[paramName] = coerceDSMLParam(rawValue, paramAttrs);
    }

    toolCalls.push({ name: toolName, arguments: args });
  }

  return { toolCalls, remainder };
}

function coerceDSMLParam(value: string, attrs: string): unknown {
  if (/\bstring="true"/i.test(attrs)) return value;
  if (/\bnumber="true"/i.test(attrs)) {
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  }
  if (/\bboolean="true"/i.test(attrs)) {
    return value.toLowerCase() === "true";
  }
  // Try JSON for objects/arrays, fall back to raw string.
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
