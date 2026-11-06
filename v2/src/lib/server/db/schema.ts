import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* better-auth                                                          */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

/* ------------------------------------------------------------------ */
/* Career data                                                          */
/* ------------------------------------------------------------------ */

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name"),
  phone: text("phone"),
  linkedin: text("linkedin"),
  github: text("github"),
  portfolio: text("portfolio"),
  twitter: text("twitter"),
  website: text("website"),
  desiredTitles: jsonb("desired_titles").$type<string[]>().default([]).notNull(),
  workModes: jsonb("work_modes").$type<string[]>().default([]).notNull(),
  salaryTarget: integer("salary_target"),
  locationPreference: text("location_preference"),
  industries: jsonb("industries").$type<string[]>().default([]).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    company: text("company").notNull(),
    title: text("title").notNull(),
    location: text("location"),
    startedOn: text("started_on"),
    endedOn: text("ended_on"),
    current: boolean("current").default(false).notNull(),
    description: text("description"),
    highlights: jsonb("highlights").$type<string[]>().default([]).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("jobs_user_idx").on(t.userId)],
);

export const residences = pgTable("residences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  label: text("label"),
  street: text("street"),
  city: text("city"),
  region: text("region"),
  country: text("country"),
  postalCode: text("postal_code"),
  startedOn: text("started_on"),
  endedOn: text("ended_on"),
  notes: text("notes"),
});

export const credentials = pgTable("credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  issuer: text("issuer"),
  issuedOn: text("issued_on"),
  expiresOn: text("expires_on"),
  url: text("url"),
  notes: text("notes"),
});

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").default("other").notNull(),
    proficiency: integer("proficiency").default(3).notNull(),
    notes: text("notes"),
  },
  (t) => [index("skills_user_idx").on(t.userId)],
);

export const jobSkills = pgTable(
  "job_skills",
  {
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.jobId, t.skillId] })],
);

/* ------------------------------------------------------------------ */
/* Workflow                                                             */
/* ------------------------------------------------------------------ */

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    company: text("company").notNull(),
    title: text("title").notNull(),
    location: text("location"),
    workMode: text("work_mode"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryCurrency: text("salary_currency").default("USD").notNull(),
    sourceUrl: text("source_url"),
    jobDescription: text("job_description"),
    stage: text("stage").default("lead").notNull(),
    outcome: text("outcome"),
    nextActionType: text("next_action_type"),
    nextActionDueAt: timestamp("next_action_due_at", { withTimezone: true }),
    nextActionNote: text("next_action_note"),
    fitSummary: text("fit_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [index("applications_user_stage_idx").on(t.userId, t.stage)],
);

export const applicationEvents = pgTable(
  "application_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("events_user_app_idx").on(t.userId, t.applicationId, t.occurredAt)],
);

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  role: text("role"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const applicationContacts = pgTable(
  "application_contacts",
  {
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    relationship: text("relationship"),
    notes: text("notes"),
  },
  (t) => [primaryKey({ columns: [t.applicationId, t.contactId] })],
);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").references(() => applications.id, {
    onDelete: "set null",
  }),
  kind: text("kind").default("resume").notNull(),
  title: text("title").notNull(),
  bodyMarkdown: text("body_markdown").default("").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const interviews = pgTable("interviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").references(() => applications.id, {
    onDelete: "set null",
  }),
  round: text("round").default("screen").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  location: text("location"),
  meetingUrl: text("meeting_url"),
  interviewerName: text("interviewer_name"),
  interviewerEmail: text("interviewer_email"),
  prepNotes: text("prep_notes"),
  status: text("status").default("scheduled").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const researchNotes = pgTable("research_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").references(() => applications.id, {
    onDelete: "set null",
  }),
  company: text("company"),
  title: text("title").notNull(),
  body: text("body").default("").notNull(),
  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const followUps = pgTable("follow_ups", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").references(() => applications.id, {
    onDelete: "cascade",
  }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  status: text("status").default("draft").notNull(),
  subject: text("subject"),
  body: text("body"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const emailLog = pgTable("email_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").references(() => applications.id, {
    onDelete: "set null",
  }),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  provider: text("provider"),
  status: text("status").default("sent").notNull(),
  error: text("error"),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  valueEncrypted: text("value_encrypted").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
