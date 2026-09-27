import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prismaMigrateDeployCommand } from "@/backend/migrate-deploy";

describe("prismaMigrateDeployCommand", () => {
  it("uses the local prisma binary when node_modules/.bin exists", () => {
    const cmd = prismaMigrateDeployCommand(process.cwd());
    const localUnix = path.join(process.cwd(), "node_modules", ".bin", "prisma");
    const localWin = path.join(process.cwd(), "node_modules", ".bin", "prisma.cmd");
    if (existsSync(localUnix) || existsSync(localWin)) {
      expect(cmd.args).toEqual(["migrate", "deploy"]);
      expect(cmd.file).toMatch(/prisma(\.cmd)?$/);
    } else {
      expect(cmd).toEqual({ file: "npx", args: ["prisma", "migrate", "deploy"] });
    }
  });
});
