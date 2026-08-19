/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production';

const securityHeaders = [
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  },
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
];

const privateNoStoreHeaders = [
  { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
  { key: 'Pragma', value: 'no-cache' },
];

const nextConfig = {
  poweredByHeader: false,
  transpilePackages: [
    '@cornermaximo/db',
    '@cornermaximo/providers',
    '@cornermaximo/shared',
    '@cornermaximo/stats',
    '@cornermaximo/sync',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.api-sports.io', pathname: '/football/**', search: '' },
      { protocol: 'https', hostname: 'media-1.api-sports.io', pathname: '/football/**', search: '' },
      { protocol: 'https', hostname: 'media-2.api-sports.io', pathname: '/football/**', search: '' },
      { protocol: 'https', hostname: 'media-3.api-sports.io', pathname: '/football/**', search: '' },
    ],
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      { source: '/auth/:path*', headers: privateNoStoreHeaders },
      { source: '/cuenta/:path*', headers: privateNoStoreHeaders },
      { source: '/admin/:path*', headers: privateNoStoreHeaders },
      { source: '/api/admin/:path*', headers: privateNoStoreHeaders },
    ];
  },
};

export default nextConfig;
