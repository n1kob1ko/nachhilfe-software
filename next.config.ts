import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The student links carry a secret token in the URL: never pass it on to other sites.
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // the public server is only reached over HTTPS; browsers ignore this header on plain http
          ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
        ],
      },
      { source: "/lernen/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      // the preview of an uploaded PDF is a frame of this site
      { source: "/material/:id/datei", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] },
    ];
  },
};

export default nextConfig;
