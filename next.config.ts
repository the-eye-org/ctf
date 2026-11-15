import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/ctf",
  async redirects() {
    return [{
      source: "/ctf/ctf/:path*",
      destination: "/ctf/:path*",
      basePath: false,
      permanent: false,
    }];
  },
};

export default nextConfig;
