import type { NextConfig } from "next";

const withPWA = require("next-pwa");

const nextConfig: NextConfig = {
  turbopack: {}, // ISKLJUČI TURBOPACK (webpack je stabilniji)
  async headers() {
    return [
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET' },
        ],
      },
    ];
  },
};

module.exports = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})(nextConfig);