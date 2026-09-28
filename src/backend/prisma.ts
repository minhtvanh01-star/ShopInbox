import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { prismaPgConfig } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  /** Bump khi thêm model — buộc tạo lại client trong next dev (HMR giữ global cũ). */
  prismaSchemaEpoch: number | undefined;
};

/** Tăng khi schema Prisma thêm model/field mà next dev còn giữ client cũ. */
const PRISMA_SCHEMA_EPOCH = 5;

function createPrismaClient() {
  const pool = new Pool({
    ...prismaPgConfig(),
    connectionTimeoutMillis: 8_000,
  });
  pool.on("error", (error) => {
    console.error("[prisma] pool error", error);
  });
  return new PrismaClient({
    adapter: new PrismaPg(pool),
  });
}

function hasDelegate(
  client: PrismaClient,
  name: "productGroup" | "authLoginThrottle" | "platformSetting",
) {
  const delegate = (client as PrismaClient & Record<string, { findMany?: unknown; findUnique?: unknown }>)[
    name
  ];
  return typeof delegate?.findMany === "function" || typeof delegate?.findUnique === "function";
}

function isStaleClient(client: PrismaClient | undefined) {
  if (!client) return true;
  if (globalForPrisma.prismaSchemaEpoch !== PRISMA_SCHEMA_EPOCH) return true;
  return (
    !hasDelegate(client, "productGroup") ||
    !hasDelegate(client, "authLoginThrottle") ||
    !hasDelegate(client, "platformSetting")
  );
}

function getPrisma() {
  if (isStaleClient(globalForPrisma.prisma)) {
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaSchemaEpoch = PRISMA_SCHEMA_EPOCH;
  }
  return globalForPrisma.prisma!;
}

/**
 * Proxy: mỗi lần truy cập model đều kiểm tra client còn khớp schema.
 * Tránh next dev giữ PrismaClient cũ trên globalThis sau `prisma generate`.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
