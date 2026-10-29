/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lunar-javascript'],
  serverExternalPackages: ['@mongodb-js/zstd'],
};

module.exports = nextConfig;
