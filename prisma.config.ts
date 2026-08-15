import "dotenv/config";
import { defineConfig } from "prisma/config";

// Dùng process.env thay vì env() — prisma generate lúc build Railway
// không có DATABASE_URL. env() sẽ ném PrismaConfigEnvError và làm fail image.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
