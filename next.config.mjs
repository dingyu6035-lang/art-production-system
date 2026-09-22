/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : false,
  },
  eslint: {
    // Preview-only branch: keep type checking enabled, but do not block the
    // playable game demo deployment on legacy project lint rules.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
