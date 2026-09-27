import { describe, expect, it } from "vitest";
import {
  classifyDatabaseError,
  databaseErrorMessage,
  inspectDatabaseUrl,
  prismaPgConfig,
  shouldUseDatabaseSsl,
  stripDatabaseUrl,
} from "@/lib/database-url";

describe("stripDatabaseUrl", () => {
  it("trims and unwraps quotes from panel pastes", () => {
    expect(stripDatabaseUrl('  "postgresql://u:p@db:5432/app"  ')).toBe(
      "postgresql://u:p@db:5432/app",
    );
    expect(stripDatabaseUrl("")).toBe("");
  });
});

describe("inspectDatabaseUrl", () => {
  it("classifies missing, invalid, loopback, and remote URIs", () => {
    expect(inspectDatabaseUrl("")).toEqual({ configured: false, kind: "unset", sslMode: null });
    expect(inspectDatabaseUrl("not-a-url").kind).toBe("invalid");
    expect(inspectDatabaseUrl("postgresql://u:p@127.0.0.1:5432/app").kind).toBe("loopback");
    expect(inspectDatabaseUrl("postgresql://u:p@db.example.com:5432/app?sslmode=require")).toEqual({
      configured: true,
      kind: "remote",
      sslMode: "require",
    });
  });
});

describe("shouldUseDatabaseSsl", () => {
  const remote = "postgresql://u:p@db.example.com:5432/app";

  it("honors DATABASE_SSL and sslmode", () => {
    expect(shouldUseDatabaseSsl(remote, {})).toBe(false);
    expect(shouldUseDatabaseSsl(remote, { DATABASE_SSL: "1" })).toBe(true);
    expect(shouldUseDatabaseSsl(`${remote}?sslmode=require`, {})).toBe(true);
    expect(shouldUseDatabaseSsl(`${remote}?sslmode=disable`, { DATABASE_SSL: "1" })).toBe(true);
    expect(shouldUseDatabaseSsl(`${remote}?sslmode=require`, { DATABASE_SSL: "0" })).toBe(false);
  });
});

describe("prismaPgConfig", () => {
  it("adds ssl with no-verify unless verify-* is set", () => {
    expect(() => prismaPgConfig("", {})).toThrow(/DATABASE_URL/);
    expect(prismaPgConfig("postgresql://u:p@db:5432/app", {})).toEqual({
      connectionString: "postgresql://u:p@db:5432/app",
    });
    expect(
      prismaPgConfig("postgresql://u:p@db:5432/app?sslmode=require", {}),
    ).toEqual({
      connectionString: "postgresql://u:p@db:5432/app?sslmode=require",
      ssl: { rejectUnauthorized: false },
    });
    expect(
      prismaPgConfig("postgresql://u:p@db:5432/app?sslmode=verify-full", {}),
    ).toEqual({
      connectionString: "postgresql://u:p@db:5432/app?sslmode=verify-full",
      ssl: { rejectUnauthorized: true },
    });
  });
});

describe("classifyDatabaseError", () => {
  it("maps driver codes and Prisma drift", () => {
    expect(classifyDatabaseError(Object.assign(new Error("x"), { code: "ECONNREFUSED" }))).toBe(
      "econnrefused",
    );
    expect(classifyDatabaseError(new Error("password authentication failed"))).toBe("auth");
    expect(classifyDatabaseError(new Error("The server does not support SSL connections"))).toBe(
      "ssl",
    );
    expect(classifyDatabaseError(new Error("P2022 column does not exist"))).toBe("schema");
  });
});

describe("databaseErrorMessage", () => {
  it("warns when production still points at localhost", () => {
    expect(
      databaseErrorMessage(Object.assign(new Error("x"), { code: "ECONNREFUSED" }), {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/app",
      }),
    ).toMatch(/localhost/);
  });
});
