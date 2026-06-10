/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep each route's rendered data in the client router cache for a short
    // window, so flipping between tabs you've already visited is instant
    // instead of flashing a loading state every time. The feed stays live via
    // realtime, and logging/edits call router.refresh(), so data still feels
    // current. First visit to a route in a session still renders fresh.
    staleTimes: { dynamic: 60, static: 180 },
  },
};
export default nextConfig;
