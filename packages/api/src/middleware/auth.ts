import { createMiddleware } from "hono/factory";

import type { AppVariables } from "../http.js";
import { jsonError } from "../http.js";
import {
  bearerToken,
  type SessionService,
} from "../domains/auth/session-service.js";

export function createAuthMiddleware(sessions: SessionService) {
  return createMiddleware<{ Variables: AppVariables }>(async (context, next) => {
    const token = bearerToken(context.req.header("Authorization"));
    const userId = token ? await sessions.userIdForAccessToken(token) : null;
    if (!userId) {
      context.header("WWW-Authenticate", "Bearer");
      return jsonError(context, 401, "unauthorized", "Authentication required");
    }
    context.set("userId", userId);
    await next();
  });
}
