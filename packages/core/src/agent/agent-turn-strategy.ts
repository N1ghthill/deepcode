import type { AgentMode, BuildTurnPolicy } from "@deepcode/shared";
import {
  BUILD_SYSTEM_PROMPT,
  BUILD_SYSTEM_PROMPT_ALWAYS_TOOLS,
  BUILD_SYSTEM_PROMPT_CONVERSATIONAL,
  CHAT_SYSTEM_PROMPT,
  PLAN_SYSTEM_PROMPT,
  UTILITY_SYSTEM_PROMPT,
} from "./agent-prompts.js";

export interface TurnStrategy {
  allowTools: boolean;
  shouldPlan: boolean;
  systemPrompt: string;
  kind: "chat" | "utility" | "task";
}

export interface ParsedUtilityRequest {
  kind: "pwd" | "date" | "list_dir";
  path?: string;
  rawPath?: string;
}

const DIRECT_SHELL_COMMAND_PATTERN = /^(?:ls|dir|pwd|date|tree|find|rg|grep|cat|stat|wc)\b/i;
const DIRECT_UTILITY_PATH_PATTERN = /(?:^|\s)(?:~\/|\.{1,2}\/|\/)[^\s]*/;
const DIRECT_UTILITY_VERB_PATTERN = /\b(?:list|lista|liste|listar|mostre|mostrar|show|display|open|abrir|abra|read|leia|print|imprima|exiba)\b/i;
const DATE_TIME_QUESTION_PATTERN = /\b(?:que dia e hoje|que dia é hoje|data de hoje|dia de hoje|what day is it|what day is today|today'?s date|current date|que horas sao|que horas são|hora atual|current time|what time is it)\b/i;
// Shell-style single-step commands (bypass planning phase)
const SIMPLE_SHELL_COMMAND_PATTERN = /^(?:mkdir|touch|rmdir|cp|mv|chmod|chown|echo|ln|git\s+(?:init|clone|add|commit|push|pull|checkout|branch|stash|tag))\b/i;
// Action verbs for single-step natural-language commands (after normalization)
const SIMPLE_ACTION_VERB_RE = /^(?:cria|crie|criar|apaga|apague|apagar|deleta|delete|deletar|remove|mova|move|renomeia|renomeie|renomear|create|rename|mkdir|make)\b/;
// Compound connectors that indicate multi-step intent
const COMPOUND_CONNECTOR_RE = /\b(?:entao|depois|tambem|alem|seguida|and then|also|afterwards|next step|subsequently)\b/;

export function resolveTurnStrategy(
  input: string,
  mode: AgentMode,
  policy: BuildTurnPolicy,
): TurnStrategy {
  if (mode === "build") {
    if (isDirectUtilityRequest(input, policy)) {
      return {
        allowTools: true,
        shouldPlan: false,
        systemPrompt: UTILITY_SYSTEM_PROMPT,
        kind: "utility",
      };
    }

    if (isConversationalTurn(input, policy)) {
      return {
        allowTools: true,
        shouldPlan: false,
        systemPrompt: BUILD_SYSTEM_PROMPT_CONVERSATIONAL,
        kind: "chat",
      };
    }

    if (policy.mode === "always-tools") {
      return {
        allowTools: true,
        shouldPlan: false,
        systemPrompt: BUILD_SYSTEM_PROMPT_ALWAYS_TOOLS,
        kind: "task",
      };
    }

    if (isSimpleDirectCommand(input)) {
      return {
        allowTools: true,
        shouldPlan: false,
        systemPrompt: BUILD_SYSTEM_PROMPT,
        kind: "task",
      };
    }

    const looksLikeWorkspace = looksLikeWorkspaceRequest(input, policy);
    return {
      allowTools: true,
      shouldPlan: looksLikeWorkspace,
      systemPrompt: looksLikeWorkspace ? BUILD_SYSTEM_PROMPT : BUILD_SYSTEM_PROMPT_CONVERSATIONAL,
      kind: looksLikeWorkspace ? "task" : "chat",
    };
  }

  if (isConversationalTurn(input, policy)) {
    return {
      allowTools: false,
      shouldPlan: false,
      systemPrompt: CHAT_SYSTEM_PROMPT,
      kind: "chat",
    };
  }

  if (mode === "plan") {
    return {
      allowTools: true,
      shouldPlan: false,
      systemPrompt: PLAN_SYSTEM_PROMPT,
      kind: "task",
    };
  }

  if (isDirectUtilityRequest(input, policy)) {
    return {
      allowTools: true,
      shouldPlan: false,
      systemPrompt: UTILITY_SYSTEM_PROMPT,
      kind: "utility",
    };
  }

  const allowTools = looksLikeWorkspaceRequest(input, policy);
  return {
    allowTools,
    shouldPlan: allowTools,
    systemPrompt: allowTools ? PLAN_SYSTEM_PROMPT : CHAT_SYSTEM_PROMPT,
    kind: allowTools ? "task" : "chat",
  };
}

export function parseUtilityRequest(input: string): ParsedUtilityRequest | undefined {
  const trimmed = input.trim();
  const normalizedInput = normalizeTurnInput(trimmed);

  if (normalizedInput === "pwd") {
    return { kind: "pwd" };
  }

  if (normalizedInput === "date" || DATE_TIME_QUESTION_PATTERN.test(normalizedInput)) {
    return { kind: "date" };
  }

  const shellListMatch = trimmed.match(/^(?:ls|dir)\s*(.+)?$/i);
  if (shellListMatch) {
    const rawPath = shellListMatch[1]?.trim() || ".";
    return { kind: "list_dir", path: rawPath, rawPath };
  }

  if (DIRECT_UTILITY_VERB_PATTERN.test(normalizedInput)) {
    const explicitPathMatch = trimmed.match(/((?:~\/|\.{1,2}\/|\/)[^\s]+)/);
    const rawPath = explicitPathMatch?.[1]?.trim() || ".";
    return { kind: "list_dir", path: rawPath, rawPath };
  }

  return undefined;
}

export function runtimeContextPrompt(worktree: string, toolsEnabled: boolean): string {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const localTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);

  return [
    "Runtime context:",
    `- Current local date: ${localDate}`,
    `- Current local time: ${localTime}`,
    `- Local timezone: ${timezone}`,
    `- Working directory: ${worktree}`,
    `- Tools enabled for this turn: ${toolsEnabled ? "yes" : "no"}`,
    toolsEnabled
      ? "- When useful, you can inspect files and run local commands through tools, subject to permissions and path restrictions."
      : "- Do not claim tools are globally unavailable; they are only disabled for this turn unless a future user request requires them.",
  ].join("\n");
}

export function utilityDateResponse(): string {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  const localDate = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);
  const localTime = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  return `${localDate} (${timezone}, ${localTime})`;
}

export function formatUtilityResult(request: ParsedUtilityRequest, result: string): string {
  if (!result.trim()) {
    return request.kind === "list_dir" ? "Diretório vazio." : "Sem saída.";
  }

  if (!result.startsWith("Error running ")) {
    return result;
  }

  const message = result.replace(/^Error running [^:]+:\s*/, "");
  if (request.kind === "list_dir") {
    const target = request.rawPath ?? request.path ?? ".";
    return `Nao consegui listar ${target}: ${message}`;
  }
  return message;
}

export function isLegacyInternalTaskPrompt(content: string): boolean {
  return content.startsWith('You are working on the following objective: "')
    && content.includes("\nCurrent task (")
    && content.includes("\nExecute this task using the available tools. Return a summary of what was done.");
}

export function isLegacyUiOperationalMessage(content: string): boolean {
  return content.startsWith("Erro ao executar a tarefa:")
    || content.startsWith("GitHub OAuth iniciado.")
    || content.includes("ainda não está configurado. Abra o menu de providers")
    || content.startsWith("Nenhum modelo está configurado para ");
}

function isConversationalTurn(input: string, policy: BuildTurnPolicy): boolean {
  const normalizedInput = normalizeTurnInput(input);
  if (!normalizedInput) return false;
  return policy.conversationalPhrases.some(
    (phrase) => normalizeTurnInput(phrase) === normalizedInput,
  );
}

function looksLikeWorkspaceRequest(input: string, policy: BuildTurnPolicy): boolean {
  const normalizedInput = normalizeTurnInput(input);
  if (!normalizedInput) return false;
  if (containsConfiguredTerm(normalizedInput, policy.workspaceTerms) || hasConfiguredFileReference(input, policy)) {
    return true;
  }
  if (input.includes("\n") || input.includes("`")) {
    return true;
  }
  return containsConfiguredTerm(normalizedInput, policy.taskVerbs) && normalizedInput.split(/\s+/).length >= 3;
}

function isDirectUtilityRequest(input: string, policy: BuildTurnPolicy): boolean {
  const normalizedInput = normalizeTurnInput(input);
  if (!normalizedInput) return false;
  if (normalizedInput === "pwd" || normalizedInput === "date") {
    return true;
  }
  if (DIRECT_SHELL_COMMAND_PATTERN.test(input.trim())) {
    return true;
  }
  if (DIRECT_UTILITY_PATH_PATTERN.test(input) && DIRECT_UTILITY_VERB_PATTERN.test(normalizedInput)) {
    return true;
  }
  return DIRECT_UTILITY_VERB_PATTERN.test(normalizedInput) && (
    normalizedInput.includes(" directory")
    || normalizedInput.includes(" folder")
    || normalizedInput.includes(" pasta")
    || normalizedInput.includes(" diretorio")
    || normalizedInput.includes(" documents")
    || normalizedInput.includes(" documentos")
    || containsConfiguredTerm(normalizedInput, policy.fileExtensions)
  );
}

function containsConfiguredTerm(normalizedInput: string, terms: string[]): boolean {
  return terms.some((term) => {
    const normalizedTerm = normalizeTurnInput(term);
    if (!normalizedTerm) return false;
    return new RegExp(`(?:^| )${escapeRegex(normalizedTerm)}(?:$| )`, "u").test(normalizedInput);
  });
}

function hasConfiguredFileReference(input: string, policy: BuildTurnPolicy): boolean {
  const extensions = policy.fileExtensions
    .map((extension) => extension.trim().toLowerCase())
    .filter(Boolean)
    .map((extension) => extension.startsWith(".") ? extension : `.${extension}`);

  if (extensions.length === 0) return false;

  return new RegExp(
    `\\b[\\w./-]+(?:${extensions.map((extension) => escapeRegex(extension)).join("|")})\\b`,
    "i",
  ).test(input);
}

function normalizeTurnInput(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9./_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSimpleDirectCommand(input: string): boolean {
  const trimmed = input.trim();
  if (SIMPLE_SHELL_COMMAND_PATTERN.test(trimmed)) return true;

  const normalized = normalizeTurnInput(trimmed);
  if (!SIMPLE_ACTION_VERB_RE.test(normalized)) return false;
  if (COMPOUND_CONNECTOR_RE.test(normalized)) return false;

  return normalized.split(/\s+/).length <= 20;
}
