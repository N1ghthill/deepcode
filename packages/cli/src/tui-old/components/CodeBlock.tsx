import React from "react";
import { Box, Text } from "ink";
import type { ThemeColors } from "../themes.js";

interface CodeBlockProps {
  code: string;
  language?: string;
  theme: ThemeColors;
  showLineNumbers?: boolean;
  maxLines?: number;
}

type TokenType = "keyword" | "string" | "comment" | "number" | "operator" | "plain";

interface Token {
  type: TokenType;
  text: string;
}

const TS_KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "class", "import", "export", "from", "type", "interface", "async", "await",
  "new", "this", "null", "undefined", "true", "false", "extends", "implements",
  "readonly", "public", "private", "protected", "static", "abstract", "enum",
  "namespace", "module", "declare", "as", "in", "of", "instanceof", "typeof",
  "void", "never", "any", "string", "number", "boolean", "object",
]);

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Single-line comment
    if (line[i] === "/" && line[i + 1] === "/") {
      tokens.push({ type: "comment", text: line.slice(i) });
      break;
    }

    // String
    if (line[i] === '"' || line[i] === "'" || line[i] === "`") {
      const quote = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === "\\") j++;
        j++;
      }
      tokens.push({ type: "string", text: line.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // Number
    if (/[0-9]/.test(line[i] ?? "")) {
      let j = i;
      while (j < line.length && /[0-9._]/.test(line[j] ?? "")) j++;
      tokens.push({ type: "number", text: line.slice(i, j) });
      i = j;
      continue;
    }

    // Word/keyword
    if (/[a-zA-Z_$]/.test(line[i] ?? "")) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j] ?? "")) j++;
      const word = line.slice(i, j);
      tokens.push({ type: TS_KEYWORDS.has(word) ? "keyword" : "plain", text: word });
      i = j;
      continue;
    }

    tokens.push({ type: "plain", text: line[i] ?? "" });
    i++;
  }

  return tokens;
}

function tokenColor(type: TokenType, theme: ThemeColors): string | undefined {
  switch (type) {
    case "keyword": return theme.warning;
    case "string": return theme.success;
    case "comment": return theme.fgMuted;
    case "number": return theme.accent;
    default: return undefined;
  }
}

export function CodeBlock({
  code,
  language,
  theme,
  showLineNumbers = false,
  maxLines = 50,
}: CodeBlockProps) {
  const lines = code.split("\n").slice(0, maxLines);
  const isHighlightable = !language || /^(ts|tsx|js|jsx|typescript|javascript)$/i.test(language);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.border}
    >
      {language && (
        <Box paddingX={1}>
          <Text color={theme.fgMuted} dimColor>{language}</Text>
        </Box>
      )}

      <Box flexDirection="column" paddingX={1}>
        {lines.map((line, lineIdx) => (
          <Box key={lineIdx} flexDirection="row">
            {showLineNumbers && (
              <Text color={theme.fgMuted} dimColor>
                {String(lineIdx + 1).padStart(3, " ")}│{" "}
              </Text>
            )}
            {isHighlightable ? (
              <Box flexDirection="row" flexWrap="wrap">
                {tokenizeLine(line).map((token, tIdx) => (
                  <Text key={tIdx} color={tokenColor(token.type, theme)}>
                    {token.text}
                  </Text>
                ))}
              </Box>
            ) : (
              <Text color={theme.fg}>{line}</Text>
            )}
          </Box>
        ))}
      </Box>

      {code.split("\n").length > maxLines && (
        <Box paddingX={1}>
          <Text color={theme.fgMuted} dimColor>
            ... {code.split("\n").length - maxLines} more lines
          </Text>
        </Box>
      )}
    </Box>
  );
}
