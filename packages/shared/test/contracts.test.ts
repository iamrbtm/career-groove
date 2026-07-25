import { describe, expect, it } from "vitest";

import {
  createJobSchema,
  applicationCreateSchema,
  contactCreateSchema,
  credentialCreateSchema,
  databaseJobSchema,
  documentCreateSchema,
  residenceCreateSchema,
  serializeJob,
  settingsUpdateSchema,
  skillCreateSchema,
  tokenPairSchema,
  updateJobSchema,
} from "../src/index.js";

describe("job contracts", () => {
  it("serializes database column names to the public camelCase contract", () => {
    const row = databaseJobSchema.parse({
      id: "04b7b02a-5d7e-4b39-a054-3d78f38238ac",
      user_id: "987b1606-803f-481d-8f08-2737252a3dd0",
      company: "Acme",
      title: "Staff Engineer",
      location: null,
      started_on: "2026-01-02",
      ended_on: null,
      current: true,
      raw_notes: null,
      achievements: [],
      metadata: {},
      created_at: new Date("2026-01-02T03:04:05.000Z"),
      updated_at: new Date("2026-01-03T03:04:05.000Z"),
    });

    expect(serializeJob(row)).toEqual({
      id: "04b7b02a-5d7e-4b39-a054-3d78f38238ac",
      userId: "987b1606-803f-481d-8f08-2737252a3dd0",
      company: "Acme",
      title: "Staff Engineer",
      location: null,
      startedOn: "2026-01-02",
      endedOn: null,
      current: true,
      rawNotes: null,
      achievements: [],
      metadata: {},
      createdAt: "2026-01-02T03:04:05.000Z",
      updatedAt: "2026-01-03T03:04:05.000Z",
    });
  });

  it("rejects an end date before the start date", () => {
    const result = createJobSchema.safeParse({
      company: "Acme",
      title: "Engineer",
      startedOn: "2026-02-02",
      endedOn: "2026-02-01",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a truly partial update", () => {
    expect(updateJobSchema.parse({ title: "Principal Engineer" })).toEqual({
      title: "Principal Engineer",
    });
  });
});

describe("authentication contracts", () => {
  it("requires prefixed access and refresh tokens", () => {
    expect(
      tokenPairSchema.safeParse({
        accessToken: "not-prefixed",
        refreshToken: "also-not-prefixed",
        accessTokenExpiresAt: "2026-07-25T12:00:00.000Z",
        refreshTokenExpiresAt: "2026-08-25T12:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});

describe("domain input contracts", () => {
  it("normalizes optional contact fields without accepting unknown data", () => {
    expect(
      contactCreateSchema.parse({
        name: "  Ada Lovelace ",
        email: "",
      }),
    ).toMatchObject({ name: "Ada Lovelace", email: null });
    expect(
      contactCreateSchema.safeParse({ name: "Ada", administrator: true }).success,
    ).toBe(false);
  });

  it("validates constrained persisted values", () => {
    expect(skillCreateSchema.safeParse({ name: "TypeScript", proficiency: 6 }).success).toBe(
      false,
    );
    expect(
      credentialCreateSchema.safeParse({
        kind: "degree",
        name: "Computer Science",
      }).success,
    ).toBe(false);
  });

  it("validates nested residence and document data", () => {
    expect(
      residenceCreateSchema.safeParse({
        label: "Home",
        address: {
          street: "1 Main Street",
          city: "Portland",
          country: "US",
        },
      }).success,
    ).toBe(true);
    expect(
      documentCreateSchema.safeParse({
        kind: "resume",
        title: "Staff resume",
        text: "",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid application salary ranges and empty settings patches", () => {
    expect(
      applicationCreateSchema.safeParse({
        title: "Engineer",
        company: "Acme",
        description: "Build things",
        salaryMin: 200_000,
        salaryMax: 100_000,
      }).success,
    ).toBe(false);
    expect(settingsUpdateSchema.safeParse({}).success).toBe(false);
  });
});
