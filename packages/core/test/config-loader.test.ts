import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigError } from "../src/errors.js";
import { ConfigLoader } from "../src/config/config-loader.js";

let tempDir: string | undefined;

afterEach(async () => {
  delete process.env.DEEPCODE_PROVIDER;
  delete process.env.DEEPCODE_MODEL;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.GITHUB_TOKEN;
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("ConfigLoader", () => {
  it("loads file config separately from environment overrides", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-config-"));
    const configPath = path.join(tempDir, ".deepcode", "config.json");
    await new ConfigLoader().init(tempDir);
    await writeFile(
      configPath,
      `${JSON.stringify({ defaultProvider: "openrouter", defaultModel: "file-model", providers: { openrouter: { apiKey: "file-key" } } })}\n`,
      "utf8",
    );

    process.env.DEEPCODE_MODEL = "env-model";
    process.env.OPENROUTER_API_KEY = "env-key";

    const loader = new ConfigLoader();
    await expect(loader.loadFile({ cwd: tempDir })).resolves.toMatchObject({
      defaultModel: "file-model",
      providers: { openrouter: { apiKey: "file-key" } },
    });
    await expect(loader.load({ cwd: tempDir })).resolves.toMatchObject({
      defaultModel: "env-model",
      providers: { openrouter: { apiKey: "env-key" } },
    });
  });

  it("saves validated config without environment overrides", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-config-"));
    const loader = new ConfigLoader();
    const config = await loader.loadFile({ cwd: tempDir });
    process.env.OPENROUTER_API_KEY = "env-key";

    await loader.save(
      { cwd: tempDir },
      {
        ...config,
        defaultModel: "saved-model",
        providers: { ...config.providers, openrouter: { apiKey: "saved-key" } },
      },
    );

    const raw = await readFile(path.join(tempDir, ".deepcode", "config.json"), "utf8");
    expect(raw).toContain("saved-key");
    expect(raw).not.toContain("env-key");
  });

  it("ignores empty environment overrides", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-config-"));
    await new ConfigLoader().init(tempDir);
    process.env.DEEPCODE_MODEL = "";
    process.env.OPENROUTER_API_KEY = "";
    process.env.GITHUB_TOKEN = "";

    await expect(new ConfigLoader().load({ cwd: tempDir })).resolves.toMatchObject({
      providers: { openrouter: {} },
      github: {},
    });
  });

  it("rejects unknown config keys", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-config-"));
    await new ConfigLoader().init(tempDir);
    await writeFile(
      path.join(tempDir, ".deepcode", "config.json"),
      `${JSON.stringify({ typo: true })}\n`,
      "utf8",
    );
    await expect(new ConfigLoader().loadFile({ cwd: tempDir })).rejects.toBeInstanceOf(ConfigError);
  });
});
