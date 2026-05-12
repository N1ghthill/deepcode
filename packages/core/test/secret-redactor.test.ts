import { afterEach, describe, expect, it } from "vitest";
import { collectSecretValues, redactSecrets, redactText } from "../src/security/secret-redactor.js";

afterEach(() => {
  delete process.env.DEEPCODE_TEST_API_KEY;
});

describe("secret redaction", () => {
  it("redacts secret object keys recursively", () => {
    expect(
      redactSecrets({
        provider: {
          apiKey: "sk-live-secret",
          baseUrl: "https://example.com",
        },
        github: {
          token: "ghp_live_secret",
        },
      }),
    ).toEqual({
      provider: {
        apiKey: "[redacted]",
        baseUrl: "https://example.com",
      },
      github: {
        token: "[redacted]",
      },
    });
  });

  it("redacts known secret values and inline credential assignments", () => {
    process.env.DEEPCODE_TEST_API_KEY = "env-secret-value";
    const secrets = collectSecretValues();
    const output = redactText(
      "authorization: Bearer env-secret-value\nOPENAI_API_KEY=another-secret\nsafe=value",
      secrets,
    );

    expect(output).toContain("authorization: Bearer [redacted]");
    expect(output).toContain("OPENAI_API_KEY=[redacted]");
    expect(output).toContain("safe=value");
    expect(output).not.toContain("env-secret-value");
    expect(output).not.toContain("another-secret");
  });

  it("does not treat apiKeyFile paths as secret values", () => {
    expect(redactSecrets({ apiKeyFile: "/tmp/key.txt" })).toEqual({
      apiKeyFile: "/tmp/key.txt",
    });
  });
});
