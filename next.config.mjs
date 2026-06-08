/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Don't reuse the client-side router cache for dynamic routes. Every
    // navigation refetches the server data, so freshly uploaded photos and
    // other changes show immediately instead of staying stale until the app is
    // killed and reopened. Paired with loading.tsx skeletons, navigation still
    // feels instant.
    staleTimes: { dynamic: 0, static: 30 },
  },
};
export default nextConfig;
