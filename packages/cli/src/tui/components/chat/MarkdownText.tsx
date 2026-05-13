import React from "react";
import { Box, Text } from "ink";
import type { ThemeColors } from "../../themes.js";

// ── Inline segment types ───────────────────────────────────────────────────

interface Segment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strikethrough?: boolean;
  dim?: boolean;
}

/**
 * Tokenise a line into styled segments.
 * Handles: **bold**, *italic*, `code`, ~~strike~~, __bold__
 */
function parseInline(line: string): Segment[] {
  const segments: Segment[] = [];
  // Pattern: captures delimiters + content
  const re = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|(~~)(.*?)\5|(`+)(.*?)\7/gs;
  let last = 0;

  for (const match of line.matchAll(re)) {
    const start = match.index!;
    if (start > last) {
      segments.push({ text: line.slice(last, start) });
    }

    const boldMatch = match[1];
    const italicMatch = match[3];
    const strikeMatch = match[5];
    const codeDelim = match[7];

    if (boldMatch) {
      segments.push({ text: match[2]!, bold: true });
    } else if (italicMatch) {
      segments.push({ text: match[4]!, italic: true });
    } else if (strikeMatch) {
      segments.push({ text: match[6]!, strikethrough: true });
    } else if (codeDelim) {
      segments.push({ text: match[8]!, code: true });
    }

    last = start + match[0].length;
  }

  if (last < line.length) {
    segments.push({ text: line.slice(last) });
  }

  return segments.length === 0 ? [{ text: line }] : segments;
}

// ── Inline line component ──────────────────────────────────────────────────

function InlineLine({ text, theme, dimColor }: { text: string; theme: ThemeColors; dimColor?: boolean }) {
  const segments = parseInline(text);
  return (
    <Text dimColor={dimColor}>
      {segments.map((seg, i) => {
        if (seg.code) {
          return (
            <Text key={i} color={theme.accent} bold={false} italic={false}>
              {seg.text}
            </Text>
          );
        }
        return (
          <Text
            key={i}
            bold={seg.bold}
            italic={seg.italic}
            strikethrough={seg.strikethrough}
          >
            {seg.text}
          </Text>
        );
      })}
    </Text>
  );
}

// ── Code block ────────────────────────────────────────────────────────────

function CodeBlock({ lines, lang, theme }: { lines: string[]; lang: string; theme: ThemeColors }) {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={theme.border}
      marginTop={1}
      marginBottom={1}
      paddingX={1}
    >
      {lang && (
        <Text color={theme.accent} bold>
          {lang}
        </Text>
      )}
      {lines.map((line, i) => (
        <Text key={i} color={theme.fg} dimColor={false}>
          {line}
        </Text>
      ))}
    </Box>
  );
}

// ── Main MarkdownText component ───────────────────────────────────────────

interface MarkdownTextProps {
  text: string;
  theme: ThemeColors;
  dimColor?: boolean;
}

export function MarkdownText({ text, theme, dimColor }: MarkdownTextProps) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = "";
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trimEnd();

    // Code block delimiter
    if (trimmed.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
        codeLines = [];
      } else {
        inCodeBlock = false;
        nodes.push(
          <CodeBlock key={key++} lines={codeLines} lang={codeLang} theme={theme} />,
        );
        codeLines = [];
        codeLang = "";
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Empty line → spacer
    if (trimmed === "") {
      nodes.push(<Text key={key++}> </Text>);
      continue;
    }

    // Headings
    const h3 = trimmed.match(/^### (.+)$/);
    const h2 = trimmed.match(/^## (.+)$/);
    const h1 = trimmed.match(/^# (.+)$/);
    if (h1) {
      nodes.push(
        <Text key={key++} bold color={theme.primary}>
          {h1[1]}
        </Text>,
      );
      nodes.push(
        <Text key={key++} color={theme.border}>
          {"═".repeat(Math.min((h1[1]?.length ?? 0) + 2, 60))}
        </Text>,
      );
      continue;
    }
    if (h2) {
      nodes.push(
        <Text key={key++} bold color={theme.primary}>
          {h2[1]}
        </Text>,
      );
      nodes.push(
        <Text key={key++} color={theme.border}>
          {"─".repeat(Math.min((h2[1]?.length ?? 0) + 2, 60))}
        </Text>,
      );
      continue;
    }
    if (h3) {
      nodes.push(
        <Text key={key++} bold color={theme.accent}>
          {h3[1]}
        </Text>,
      );
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      nodes.push(
        <Text key={key++} color={theme.border}>
          {"─".repeat(60)}
        </Text>,
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      nodes.push(
        <Box key={key++} flexDirection="row" gap={1}>
          <Text color={theme.accent}>│</Text>
          <InlineLine text={trimmed.slice(2)} theme={theme} dimColor />
        </Box>,
      );
      continue;
    }

    // Unordered list
    const ulMatch = trimmed.match(/^[-*+] (.+)$/);
    if (ulMatch) {
      nodes.push(
        <Box key={key++} flexDirection="row" gap={1}>
          <Text color={theme.accent}>•</Text>
          <InlineLine text={ulMatch[1]!} theme={theme} dimColor={dimColor} />
        </Box>,
      );
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^(\d+)\. (.+)$/);
    if (olMatch) {
      nodes.push(
        <Box key={key++} flexDirection="row" gap={1}>
          <Text color={theme.accent}>{olMatch[1]}.</Text>
          <InlineLine text={olMatch[2]!} theme={theme} dimColor={dimColor} />
        </Box>,
      );
      continue;
    }

    // Regular line with inline formatting
    nodes.push(
      <InlineLine key={key++} text={trimmed} theme={theme} dimColor={dimColor} />,
    );
  }

  // Unclosed code block fallback
  if (inCodeBlock && codeLines.length > 0) {
    nodes.push(<CodeBlock key={key++} lines={codeLines} lang={codeLang} theme={theme} />);
  }

  return <Box flexDirection="column">{nodes}</Box>;
}
