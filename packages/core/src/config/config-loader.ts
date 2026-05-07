import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeepCodeConfigSchema, type DeepCodeConfig } from "@deepcode/shared";
import { ConfigError } from "../errors.js";

export interface LoadConfigOptions {
  cwd: string;
  configPath?: string;
}

export class ConfigLoader {
  async load(options: LoadConfigOptions): Promise<DeepCodeConfig> {
    const configPath = options.configPath ?? path.join(options.cwd, ".deepcode", "config.json");
    const rawFile = await this.readOptionalJson(configPath);
    const merged = {
      ...rawFile,
      defaultProvider: process.env.DEEPCODE_PROVIDER ?? rawFile.defaultProvider,
      defaultModel: process.env.DEEPCODE_MODEL ?? rawFile.defaultModel,
      cache: {
        ...rawFile.cache,
        enabled: parseOptionalBoolean(process.env.CACHE_ENABLED) ?? rawFile.cache?.enabled,
        ttlSeconds: parseOptionalNumber(process.env.CACHE_TTL_SECONDS) ?? rawFile.cache?.ttlSeconds,
      },
      providers: {
        ...rawFile.providers,
        openrouter: {
          ...rawFile.providers?.openrouter,
          apiKey: process.env.OPENROUTER_API_KEY ?? rawFile.providers?.openrouter?.apiKey,
        },
        anthropic: {
          ...rawFile.providers?.anthropic,
          apiKey: process.env.ANTHROPIC_API_KEY ?? rawFile.providers?.anthropic?.apiKey,
        },
        openai: {
          ...rawFile.providers?.openai,
          apiKey: process.env.OPENAI_API_KEY ?? rawFile.providers?.openai?.apiKey,
        },
        deepseek: {
          ...rawFile.providers?.deepseek,
          apiKey: process.env.DEEPSEEK_API_KEY ?? rawFile.providers?.deepseek?.apiKey,
        },
        opencode: {
          ...rawFile.providers?.opencode,
          apiKey: process.env.OPENCODE_API_KEY ?? rawFile.providers?.opencode?.apiKey,
        },
      },
      github: {
        ...rawFile.github,
        token: process.env.GITHUB_TOKEN ?? rawFile.github?.token,
      },
    };

    const parsed = DeepCodeConfigSchema.safeParse(merged);
    if (!parsed.success) {
      throw new ConfigError(`Invalid DeepCode config: ${parsed.error.message}`, parsed.error);
    }
    return parsed.data;
  }

  async init(cwd: string): Promise<string> {
    const dir = path.join(cwd, ".deepcode");
    const configPath = path.join(dir, "config.json");
    await mkdir(dir, { recursive: true });
    const config = DeepCodeConfigSchema.parse({});
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    return configPath;
  }

  private async readOptionalJson(filePath: string): Promise<Record<string, any>> {
    try {
      return JSON.parse(await readFile(filePath, "utf8")) as Record<string, any>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {};
      }
      throw new ConfigError(`Unable to read config at ${filePath}`, error);
    }
  }
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  return undefined;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
