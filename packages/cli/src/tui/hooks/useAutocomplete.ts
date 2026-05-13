import { useMemo } from "react";

const FILE_TRIGGER_PATTERNS = [
  /(?:ler|abrir|mostrar|ver|read|open|show|edit|editar)\s+(.+)/i,
  /(?:arquivo|file)\s+(.+)/i,
];

const TEST_FILE_PATTERN = /(?:testar|test|rodar testes|run tests?)\s*(.*)/i;

export interface AutocompleteSuggestion {
  value: string;
  label: string;
  type: "file" | "test-file" | "command";
}

export function useAutocomplete(
  input: string,
  files: string[],
): AutocompleteSuggestion[] {
  return useMemo(() => {
    if (!input.trim() || input.startsWith("/")) return [];

    // Test file suggestions
    const testMatch = TEST_FILE_PATTERN.exec(input);
    if (testMatch) {
      const query = testMatch[1]?.trim().toLowerCase() ?? "";
      const testFiles = files.filter(
        (f) => f.includes(".test.") || f.includes(".spec."),
      );
      const filtered = query
        ? testFiles.filter((f) => f.toLowerCase().includes(query))
        : testFiles;
      return filtered.slice(0, 8).map((f) => ({
        value: f,
        label: f,
        type: "test-file" as const,
      }));
    }

    // File path suggestions
    for (const pattern of FILE_TRIGGER_PATTERNS) {
      const match = pattern.exec(input);
      if (match) {
        const query = match[1]?.trim().toLowerCase() ?? "";
        if (query.length < 2) break;
        const filtered = files.filter((f) => f.toLowerCase().includes(query));
        return filtered.slice(0, 8).map((f) => ({
          value: f,
          label: f,
          type: "file" as const,
        }));
      }
    }

    // Partial path match if input looks like a path
    if (input.includes("/") || input.includes(".")) {
      const query = input.trim().toLowerCase();
      const filtered = files.filter((f) => f.toLowerCase().includes(query));
      return filtered.slice(0, 6).map((f) => ({
        value: f,
        label: f,
        type: "file" as const,
      }));
    }

    return [];
  }, [input, files]);
}
