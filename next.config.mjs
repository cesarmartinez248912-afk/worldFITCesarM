/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ["lucide-react"]
  }
};

export default nextConfig;
