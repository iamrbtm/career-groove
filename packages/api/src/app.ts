import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";

import type { ApiConfig } from "./config.js";
import type { Database } from "./db.js";

type Variables = {
  requestId: string;
  userId: string;
};

export interface AppDependencies {
  config: ApiConfig;
  database?: Database;
}

function errorPayload(
  requestIdValue: string,
  code: string,
  message: string,
  details?: unknown,
) {
  return {
    error: {
      code,
      message,
      requestId: requestIdValue,
      ...(details === undefined ? {} : { details }),
    },
  };
}

export function createApp({ config }: AppDependencies) {
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", requestId({ generator: () => randomUUID() }));
  app.use("*", secureHeaders());
  app.use(
    "*",
    cors({
      allowHeaders: ["Authorization", "Content-Type", "X-Request-ID"],
      allowMethods: ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"],
      credentials: true,
      maxAge: 86_400,
      origin: (origin) =>
        config.allowedOrigins.includes(origin) ? origin : undefined,
    }),
  );
  app.use(
    "*",
    bodyLimit({
      maxSize: config.bodyLimitBytes,
      onError: (context) =>
        context.json(
          errorPayload(
            context.get("requestId"),
            "payload_too_large",
            "Request body is too large",
          ),
          413,
        ),
    }),
  );

  app.get("/api/health", (context) =>
    context.json({
      service: "career-groove-api",
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
  );

  app.notFound((context) =>
    context.json(
      errorPayload(context.get("requestId"), "not_found", "Route not found"),
      404,
    ),
  );

  app.onError((error, context) => {
    if (config.nodeEnv !== "test") {
      console.error(
        JSON.stringify({
          error: error.message,
          requestId: context.get("requestId"),
          stack: config.nodeEnv === "development" ? error.stack : undefined,
        }),
      );
    }
    return context.json(
      errorPayload(
        context.get("requestId"),
        "internal_error",
        "An unexpected error occurred",
      ),
      500,
    );
  });

  return app;
}

export type CareerGrooveApp = ReturnType<typeof createApp>;
