import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";

import type { ApiConfig } from "./config.js";
import type { Database } from "./db.js";
import {
  createBillingStatusRoutes,
  createProfileRoutes,
  createPushDeviceRoutes,
  createRegistrationRoutes,
} from "./domains/account/routes.js";
import { createAuthRoutes } from "./domains/auth/routes.js";
import { createApplicationRoutes } from "./domains/applications/routes.js";
import {
  createApplicationAnalyticsRoutes,
  createApplicationPreferenceRoutes,
} from "./domains/applications/support-routes.js";
import { SessionService } from "./domains/auth/session-service.js";
import { createJobRoutes } from "./domains/jobs/routes.js";
import { createProviderRoutes } from "./domains/providers/routes.js";
import {
  createContactRoutes,
  createCredentialRoutes,
  createDocumentRoutes,
  createResidenceRoutes,
  createSettingsRoutes,
  createSkillRoutes,
} from "./domains/core/routes.js";
import type { AppVariables } from "./http.js";
import { errorPayload } from "./http.js";

export interface AppDependencies {
  config: ApiConfig;
  database?: Database;
  sessions?: SessionService;
}

export function createApp({ config, database, sessions }: AppDependencies) {
  const app = new Hono<{ Variables: AppVariables }>();

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

  if (database) {
    const sessionService = sessions ?? new SessionService(database);
    app.route("/api/register", createRegistrationRoutes({ database }));
    app.route(
      "/api/mobile/auth",
      createAuthRoutes({
        database,
        sessions: sessionService,
      }),
    );
    app.route(
      "/api/jobs",
      createJobRoutes({ database, sessions: sessionService }),
    );
    const coreDependencies = { database, sessions: sessionService };
    app.route("/api/contacts", createContactRoutes(coreDependencies));
    app.route("/api/residences", createResidenceRoutes(coreDependencies));
    app.route("/api/credentials", createCredentialRoutes(coreDependencies));
    app.route("/api/skills", createSkillRoutes(coreDependencies));
    app.route("/api/documents", createDocumentRoutes(coreDependencies));
    app.route("/api/settings", createSettingsRoutes(coreDependencies));
    app.route(
      "/api/applications",
      createApplicationRoutes(coreDependencies),
    );
    app.route(
      "/api/application-analytics",
      createApplicationAnalyticsRoutes(coreDependencies),
    );
    app.route(
      "/api/application-preferences",
      createApplicationPreferenceRoutes(coreDependencies),
    );
    app.route(
      "/api/providers",
      createProviderRoutes({ config, ...coreDependencies }),
    );
    app.route("/api/profile", createProfileRoutes(coreDependencies));
    app.route(
      "/api/mobile/billing/status",
      createBillingStatusRoutes(coreDependencies),
    );
    app.route(
      "/api/mobile/push-devices",
      createPushDeviceRoutes(coreDependencies),
    );
  }

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
