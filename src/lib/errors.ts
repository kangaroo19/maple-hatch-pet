export type ErrorCode =
  | "INVALID_REQUEST"
  | "CHARACTER_NOT_FOUND"
  | "UNUSABLE_CHARACTER_FRAMES"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    public readonly retryable: boolean,
    public readonly publicMessage: string,
  ) {
    super(`${code}: ${publicMessage}`);
    this.name = "AppError";
  }
}

export function invalidRequest(message = "요청을 확인해 주세요.") {
  return new AppError("INVALID_REQUEST", 400, false, message);
}

export function internalError(message = "Pet을 만들지 못했습니다.") {
  return new AppError("INTERNAL_ERROR", 500, true, message);
}
