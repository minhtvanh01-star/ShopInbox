import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  /** Bump khi thêm model — buộc tạo lại client trong next dev (HMR giữ global cũ). */
  prismaSchemaEpoch: number | undefined;
};

/** Tăng khi schema Prisma có model mới mà code runtime phụ thuộc. */
const PRISMA_SCHEMA_EPOCH = 3;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Thiếu DATABASE_URL. Copy .env.example thành .env.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

function isStaleClient(client: PrismaClient | undefined) {
  if (!client) return true;
  if (globalForPrisma.prismaSchemaEpoch !== PRISMA_SCHEMA_EPOCH) return true;
  const delegate = (client as PrismaClient & { productGroup?: { findMany?: unknown } })
    .productGroup;
  return typeof delegate?.findMany !== "function";
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
  get(_target, prop, _receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
