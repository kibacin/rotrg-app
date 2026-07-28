import type { NextConfig } from "next";

const withPWA = require("next-pwa");

const nextConfig: NextConfig = {
  turbopack: {},
};

module.exports = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})(nextConfig);