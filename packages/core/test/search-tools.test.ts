import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { heuristicSymbolSearch } from "../src/tools/search-tools.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("heuristicSymbolSearch", () => {
  it("finds TypeScript functions and classes by query substring", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-search-"));
    await writeFile(
      path.join(tempDir, "index.ts"),
      [
        "export function getUserById(id: string) {}",
        "export function listUsers() {}",
        "export class UserService {}",
        "export interface UserRepo {}",
        "export const MAX_COUNT = 100;",
      ].join("\n"),
      "utf8",
    );

    const results = await heuristicSymbolSearch("user", tempDir, tempDir);
    const names = results.map((r) => r.name);

    expect(names).toContain("getUserById");
    expect(names).toContain("listUsers");
    expect(names).toContain("UserService");
    expect(names).toContain("UserRepo");
    expect(names).not.toContain("MAX_COUNT");
  });

  it("matches query case-insensitively", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-search-"));
    await writeFile(
      path.join(tempDir, "auth.ts"),
      "export function AuthHandler() {}\nexport class authProvider {}\n",
      "utf8",
    );

    const results = await heuristicSymbolSearch("AUTH", tempDir, tempDir);
    const names = results.map((r) => r.name);

    expect(names).toContain("AuthHandler");
    expect(names).toContain("authProvider");
  });

  it("assigns correct LSP kind numbers", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-search-"));
    await writeFile(
      path.join(tempDir, "kinds.ts"),
      [
        "export function myFunc() {}",
        "export class MyClass {}",
        "export interface MyInterface {}",
        "export enum MyEnum {}",
        "export const MY_CONST = 1;",
        "export type MyType = string;",
      ].join("\n"),
      "utf8",
    );

    const results = await heuristicSymbolSearch("my", tempDir, tempDir);
    const byName = Object.fromEntries(results.map((r) => [r.name, r.kind]));

    expect(byName["myFunc"]).toBe(12);       // Function
    expect(byName["MyClass"]).toBe(5);        // Class
    expect(byName["MyInterface"]).toBe(11);   // Interface
    expect(byName["MyEnum"]).toBe(10);        // Enum
    expect(byName["MY_CONST"]).toBe(14);      // Constant
    expect(byName["MyType"]).toBe(26);        // TypeParameter
  });

  it("finds Python def and class declarations", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-search-"));
    await writeFile(
      path.join(tempDir, "service.py"),
      "def get_user(user_id):\n    pass\n\nclass UserService:\n    pass\n",
      "utf8",
    );

    const results = await heuristicSymbolSearch("user", tempDir, tempDir);
    const names = results.map((r) => r.name);

    expect(names).toContain("get_user");
    expect(names).toContain("UserService");
  });

  it("searches recursively across multiple files", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-search-"));
    await mkdir(path.join(tempDir, "src"));
    await writeFile(
      path.join(tempDir, "src", "a.ts"),
      "export function parseToken() {}\n",
      "utf8",
    );
    await writeFile(
      path.join(tempDir, "src", "b.ts"),
      "export function validateToken() {}\n",
      "utf8",
    );

    const results = await heuristicSymbolSearch("token", tempDir, tempDir);
    const names = results.map((r) => r.name);

    expect(names).toContain("parseToken");
    expect(names).toContain("validateToken");
  });

  it("returns empty array when no symbols match", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-search-"));
    await writeFile(
      path.join(tempDir, "index.ts"),
      "export function doSomething() {}\n",
      "utf8",
    );

    const results = await heuristicSymbolSearch("zzznomatch", tempDir, tempDir);
    expect(results).toHaveLength(0);
  });

  it("includes file path and line number in results", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-search-"));
    await writeFile(
      path.join(tempDir, "router.ts"),
      "// header\nexport function handleRequest() {}\n",
      "utf8",
    );

    const results = await heuristicSymbolSearch("handleRequest", tempDir, tempDir);
    expect(results).toHaveLength(1);
    expect(results[0]!.file).toContain("router.ts");
    expect(results[0]!.line).toBe(2);
  });
});
