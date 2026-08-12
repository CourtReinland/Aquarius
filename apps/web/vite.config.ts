import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Log every incoming request's source IP — handy when debugging device access. */
function requestLogger(): Plugin {
  return {
    name: 'aquarius-request-logger',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const ip = req.socket.remoteAddress?.replace('::ffff:', '');
        if (req.url === '/' || req.url?.startsWith('/?')) {
          console.log(`[lab] page load from ${ip} (host: ${req.headers.host})`);
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), requestLogger()],
  server: {
    host: true, // expose on LAN so phones can join the dev session
    allowedHosts: ['.local'], // allow Bonjour names like blues-macbook-air.local
    port: 5173,
    proxy: {
      // Forward API calls to the Hono server so the web app is origin-clean
      '/api': 'http://127.0.0.1:3001',
      '/health': 'http://127.0.0.1:3001',
    },
  },
});
