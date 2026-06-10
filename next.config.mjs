/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Cache dynamic routes briefly so quick back-and-forth between tabs is
    // instant (no loading skeleton on every navigation). The short window
    // keeps data reasonably fresh, and mutations (logging, photo uploads)
    // already call router.refresh() to update the current route immediately.
    staleTimes: { dynamic: 30, static: 180 },
  },
};
export default nextConfig;
