import { describe, expect, it } from "vitest";
import {
  classifyDatabaseError,
  databaseErrorMessage,
  inspectDatabaseUrl,
  normalizeDatabaseUrl,
  prismaPgConfig,
  shouldUseDatabaseSsl,
  stripDatabaseUrl,
} from "@/lib/database-url";

describe("stripDatabaseUrl", () => {
  it("trims and unwraps quotes from panel pastes", () => {
    expect(stripDatabaseUrl('  "postgresql://u:p@db:5432/app"  ')).toBe(
      "postgresql://u:p@db:5432/app",
    );
    expect(stripDatabaseUrl("DATABASE_URL=postgresql://u:p@db:5432/app")).toBe(
      "postgresql://u:p@db:5432/app",
    );
    expect(stripDatabaseUrl("")).toBe("");
  });
});

describe("normalizeDatabaseUrl", () => {
  it("accepts jdbc, prisma, keyword, and scheme-less panel formats", () => {
    expect(normalizeDatabaseUrl("jdbc:postgresql://u:p@db:5432/app")).toBe(
      "postgresql://u:p@db:5432/app",
    );
    expect(normalizeDatabaseUrl("prisma+postgres://u:p@db:5432/app")).toBe(
      "postgresql://u:p@db:5432/app",
    );
    expect(normalizeDatabaseUrl("u:p@db.example.com:5432/app")).toBe(
      "postgresql://u:p@db.example.com:5432/app",
    );
    expect(
      normalizeDatabaseUrl("host=db.example.com port=5432 user=u password=p#x dbname=app"),
    ).toBe("postgresql://u:p%23x@db.example.com:5432/app");
  });
});

describe("inspectDatabaseUrl", () => {
  it("classifies missing, invalid, loopback, and remote URIs", () => {
    expect(inspectDatabaseUrl("")).toEqual({
      configured: false,
      kind: "unset",
      sslMode: null,
      hint: "empty",
    });
    expect(inspectDatabaseUrl("not-a-url")).toMatchObject({
      kind: "invalid",
      hint: "unparseable",
    });
    expect(inspectDatabaseUrl("https://shopinbox.n2.tinhgon.xyz")).toMatchObject({
      kind: "invalid",
      hint: "not_postgres_scheme",
    });
    expect(inspectDatabaseUrl("postgresql://u:p@127.0.0.1:5432/app").kind).toBe("loopback");
    expect(inspectDatabaseUrl("postgresql://u:p@db.example.com:5432/app?sslmode=require")).toEqual({
      configured: true,
      kind: "remote",
      sslMode: "require",
      hint: "ok",
    });
    expect(inspectDatabaseUrl("u:p@db.example.com:5432/app").kind).toBe("remote");
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
    expect(prismaPgConfig("postgresql://u:p@db:5432/app?sslmode=require", {})).toEqual({
      connectionString: "postgresql://u:p@db:5432/app?sslmode=require",
      ssl: { rejectUnauthorized: false },
    });
    expect(prismaPgConfig("postgresql://u:p@db:5432/app?sslmode=verify-full", {})).toEqual({
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
