// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: require('next-pwa/cache'),
  fallbacks: {
    document: '/_offline', // unsere Offline-Seite
  },
});

module.exports = withPWA({
  reactStrictMode: true,
});
