import { useState, useRef, useCallback, type MutableRefObject } from "react";
import {
  collectSecretValues,
  redactText,
  ConfigLoader,
  GitHubClient,
  GitHubOAuthDeviceFlow,
  loginWithGitHubCli,
} from "@deepcode/core";
import type { DeepCodeRuntime } from "../../runtime.js";
import type { GithubOAuthState } from "../app-config.js";
import type { Session } from "@deepcode/shared";
import { truncate } from "../utils/truncate.js";
import { parseGithubLoginClientId } from "../utils/misc-utils.js";
import { t } from "../i18n/index.js";

interface UseGithubOAuthOptions {
  cwd: string;
  configPath?: string;
  setNotice: (notice: string) => void;
  applyUpdatedConfig: (activeRuntime: DeepCodeRuntime, updatedConfig: DeepCodeRuntime["config"]) => void;
}

interface UseGithubOAuthReturn {
  githubOAuth: GithubOAuthState;
  abortRef: MutableRefObject<AbortController | null>;
  startGithubLogin: (command: string, activeRuntime: DeepCodeRuntime, activeSession: Session | null) => Promise<void>;
  cancelOAuth: () => void;
}

export function useGithubOAuth({ cwd, configPath, setNotice, applyUpdatedConfig }: UseGithubOAuthOptions): UseGithubOAuthReturn {
  const [githubOAuth, setGithubOAuth] = useState<GithubOAuthState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const cancelOAuth = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGithubOAuth({ status: "idle" });
    setNotice(t("githubOAuthCancelled"));
  }, [setNotice]);

  async function authorizeWithGitHubOAuthApp({
    activeRuntime,
    command,
    clientId,
    controller,
    effectiveConfig,
    explicitClientId,
    activeSession,
  }: {
    activeRuntime: DeepCodeRuntime;
    command: string;
    clientId: string;
    controller: AbortController;
    effectiveConfig: DeepCodeRuntime["config"];
    explicitClientId?: string;
    activeSession: Session | null;
  }) {
    const flow = new GitHubOAuthDeviceFlow({
      enterpriseUrl: effectiveConfig.github.enterpriseUrl,
      openBrowser: true,
      signal: controller.signal,
      onBrowserOpenError: (error) => {
        setGithubOAuth((current) => ({
          ...current,
          browserError: error.message,
        }));
        setNotice(t("couldNotOpenBrowser"));
      },
    });
    setNotice(t("openingGitHubAuthInBrowser"));
    return flow.authorize({
      clientId,
      scopes: effectiveConfig.github.oauthScopes,
      onVerification: (code) => {
        const expiresAt = new Date(Date.now() + code.expiresIn * 1000).toLocaleTimeString();
        setGithubOAuth({
          status: "waiting",
          verificationUri: code.verificationUri,
          userCode: code.userCode,
          expiresAt,
          message: t("waitingForGitHubAuth"),
        });
        if (!activeSession) return;
        activeRuntime.sessions.addMessage(activeSession.id, {
          role: "assistant",
          source: "ui",
          content: [
            t("githubOAuthInitiated"),
            `${t("url")}: ${code.verificationUri}`,
            t("code") + `: ${code.userCode}`,
            t("expires", { time: expiresAt }),
            explicitClientId ? t("githubOAuthAppFromCommand") : t("githubOAuthAppFromConfig"),
            command.startsWith("/github login") ? "/github login" : "/github-login",
          ].join("\n"),
        });
        setNotice(t("githubOAuthCopyCode", { code: code.userCode }));
      },
      onPoll: ({ attempt }) => {
        if (attempt === 1) setNotice(t("waitingForGitHubAuthEllipsis"));
      },
    });
  }

  async function startGithubCliLogin({
    activeRuntime,
    fileConfig,
    effectiveConfig,
    loader,
    loadOptions,
  }: {
    activeRuntime: DeepCodeRuntime;
    fileConfig: Awaited<ReturnType<ConfigLoader["loadFile"]>>;
    effectiveConfig: DeepCodeRuntime["config"];
    loader: ConfigLoader;
    loadOptions: { cwd: string; configPath?: string };
  }): Promise<void> {
    setGithubOAuth({
      status: "opening",
      message: t("openingGitHubLoginViaCLI"),
    });
    setNotice(t("openingGitHubLoginViaBrowser"));

    const outputBuffer: string[] = [];
    const token = await loginWithGitHubCli({
      cwd,
      enterpriseUrl: effectiveConfig.github.enterpriseUrl,
      scopes: effectiveConfig.github.oauthScopes,
      signal: abortRef.current?.signal,
      onOutput: (chunk) => {
        outputBuffer.push(chunk);
        const output = redactText(
          outputBuffer.join("").replace(/\s+/g, " ").trim(),
          collectSecretValues(activeRuntime.config),
        );
        setGithubOAuth({
          status: "waiting",
          message: output ? truncate(output, 220) : t("githubOAuthWaitingBrowser"),
        });
      },
    });

    await validateGithubToken(effectiveConfig, token);
    await saveGithubToken({
      activeRuntime,
      fileConfig,
      loader,
      loadOptions,
      token,
      oauthClientId: fileConfig.github?.oauthClientId,
      oauthScopes: effectiveConfig.github.oauthScopes,
    });
    setGithubOAuth({
      status: "success",
      message: t("githubLoginCompletedViaBrowser"),
    });
    setNotice(t("githubOAuthCompleted"));
  }

  async function validateGithubToken(
    effectiveConfig: DeepCodeRuntime["config"],
    token: string,
  ): Promise<void> {
    const client = new GitHubClient({
      token,
      enterpriseUrl: effectiveConfig.github.enterpriseUrl,
      worktree: cwd,
    });
    await client.getAuthenticatedUser();
  }

  async function saveGithubToken({
    activeRuntime,
    fileConfig,
    loader,
    loadOptions,
    token,
    oauthClientId,
    oauthScopes,
  }: {
    activeRuntime: DeepCodeRuntime;
    fileConfig: Awaited<ReturnType<ConfigLoader["loadFile"]>>;
    loader: ConfigLoader;
    loadOptions: { cwd: string; configPath?: string };
    token: string;
    oauthClientId?: string;
    oauthScopes: string[];
  }): Promise<void> {
    await loader.save(loadOptions, {
      ...fileConfig,
      github: {
        ...fileConfig.github,
        token,
        oauthClientId,
        oauthScopes,
      },
    });
    const loader2 = new ConfigLoader();
    const updatedConfig = await loader2.load(loadOptions);
    applyUpdatedConfig(activeRuntime, updatedConfig);
  }

  async function startGithubLogin(command: string, activeRuntime: DeepCodeRuntime, activeSession: Session | null): Promise<void> {
    if (abortRef.current) {
      setNotice(t("githubOAuthInProgress"));
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setGithubOAuth({ status: "opening", message: t("preparingGitHubOAuth") });
    try {
      const explicitClientId = parseGithubLoginClientId(command);
      const loader = new ConfigLoader();
      const loadOptions = { cwd, configPath };
      const fileConfig = await loader.loadFile(loadOptions);
      const effectiveConfig = await loader.load(loadOptions);
      const clientId = explicitClientId ?? effectiveConfig.github.oauthClientId;
      if (!clientId) {
        await startGithubCliLogin({
          activeRuntime,
          fileConfig,
          effectiveConfig,
          loader,
          loadOptions,
        });
        return;
      }
      const token = await authorizeWithGitHubOAuthApp({
        activeRuntime,
        command,
        clientId,
        controller,
        effectiveConfig,
        explicitClientId,
        activeSession,
      });
      setGithubOAuth((current) => ({
        ...current,
        status: "saving",
        message: t("authorizationReceived"),
      }));
      await validateGithubToken(effectiveConfig, token.accessToken);
      await saveGithubToken({
        activeRuntime,
        fileConfig,
        loader,
        loadOptions,
        token: token.accessToken,
        oauthClientId: explicitClientId ?? fileConfig.github?.oauthClientId,
        oauthScopes: effectiveConfig.github.oauthScopes,
      });
      setGithubOAuth((current) => ({
        ...current,
        status: "success",
        message: t("githubOAuthCompleted"),
      }));
      setNotice(t("githubOAuthCompleted"));
    } catch (err) {
      const message = redactText(
        err instanceof Error ? err.message : String(err),
        collectSecretValues(activeRuntime.config),
      );
      const cancelled = controller.signal.aborted || /cancelled|aborted/i.test(message);
      setGithubOAuth((current) => ({
        ...current,
        status: cancelled ? "cancelled" : "error",
        message: cancelled ? t("githubOAuthCancelled") : message,
      }));
      setNotice(cancelled ? t("githubOAuthCancelled") : t("githubOAuthFailed", { error: message }));
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }

  return {
    githubOAuth,
    abortRef,
    startGithubLogin,
    cancelOAuth,
  };
}
