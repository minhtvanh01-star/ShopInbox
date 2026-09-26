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
    const common = {
      hsts: production,
      upgradeInsecureRequests: production,
      unsafeEval: !production,
    };
    const headers = productionSecurityHeaders(common);
    const embedHeaders = productionSecurityHeaders({ ...common, crossOriginResource: true });
    return [
      { source: "/", headers },
      { source: "/:path*", headers },
      { source: "/widget.js", headers: embedHeaders },
      { source: "/api/webhooks/web", headers: embedHeaders },
      { source: "/api/webhooks/web/:path*", headers: embedHeaders },
    ];
  },
};

export default nextConfig;
