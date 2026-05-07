import { describe, expect, it } from "vitest";
import { parseGitHubRemote } from "../src/github/github-client.js";

describe("parseGitHubRemote", () => {
  it("parses https remotes", () => {
    expect(parseGitHubRemote("https://github.com/acme/project.git")).toEqual({
      owner: "acme",
      repo: "project",
    });
  });

  it("parses ssh remotes", () => {
    expect(parseGitHubRemote("git@github.com:acme/project.git")).toEqual({
      owner: "acme",
      repo: "project",
    });
  });
});
