import type { Context } from "hono";

export type AppVariables = {
  requestId: string;
  userId: string;
};

export function errorPayload(
  requestId: string,
  code: string,
  message: string,
  details?: unknown,
) {
  return {
    error: {
      code,
      message,
      requestId,
      ...(details === undefined ? {} : { details }),
    },
  };
}

export function jsonError(
  context: Context<{ Variables: AppVariables }>,
  status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 503,
  code: string,
  message: string,
  details?: unknown,
) {
  return context.json(
    errorPayload(context.get("requestId"), code, message, details),
    status,
  );
}
