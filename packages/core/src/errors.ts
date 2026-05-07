export class DeepCodeError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DeepCodeError";
  }
}

export class ConfigError extends DeepCodeError {
  constructor(message: string, cause?: unknown) {
    super(message, "CONFIG_ERROR", cause);
    this.name = "ConfigError";
  }
}

export class PermissionDeniedError extends DeepCodeError {
  constructor(message: string) {
    super(message, "PERMISSION_DENIED");
    this.name = "PermissionDeniedError";
  }
}

export class PathNotAllowedError extends DeepCodeError {
  constructor(path: string, reason: string) {
    super(`Path is not allowed: ${path}. ${reason}`, "PATH_NOT_ALLOWED");
    this.name = "PathNotAllowedError";
  }
}

export class ToolExecutionError extends DeepCodeError {
  constructor(message: string, cause?: unknown) {
    super(message, "TOOL_EXECUTION_ERROR", cause);
    this.name = "ToolExecutionError";
  }
}

export class ProviderError extends DeepCodeError {
  constructor(
    message: string,
    readonly provider: string,
    cause?: unknown,
  ) {
    super(message, "PROVIDER_ERROR", cause);
    this.name = "ProviderError";
  }
}
