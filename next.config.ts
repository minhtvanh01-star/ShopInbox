import type { NextConfig } from "next";
import { productionSecurityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "bcryptjs"],
  experimental: {
    serverActions: {
      // Hơi lớn hơn MAX_UPLOAD_BYTES để còn chỗ cho multipart.
      bodySizeLimit: "105mb",
    },
  },
  async headers() {
    const production = process.env.NODE_ENV === "production";
    const headers = productionSecurityHeaders({
      hsts: production,
      upgradeInsecureRequests: production,
      unsafeEval: !production,
    });
    return [
      { source: "/", headers },
      { source: "/:path*", headers },
    ];
  },
};

export default nextConfig;
