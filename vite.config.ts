import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/** Exposes the SAME domain core as Electron over a relative /api URL. */
function coreApiPlugin(): Plugin {
  return {
    name: 'merqo-core-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        try {
          const mod = await server.ssrLoadModule('/src/server/api.ts');
          const handled = await mod.handleApi(req, res);
          if (!handled) next();
        } catch (err) {
          console.error('[api]', err);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              ok: false,
              error: { code: 'INTERNAL', message: 'অনুরোধটি প্রক্রিয়া করা যায়নি।' },
            }),
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), coreApiPlugin()],
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@renderer': fileURLToPath(new URL('./src/renderer', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Arena preview host is proxied; browser code only ever calls relative /api.
    allowedHosts: true,
    fs: { strict: true },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'chrome140',
    chunkSizeWarningLimit: 900,
  },
  ssr: {
    external: ['better-sqlite3', 'pdfkit', 'exceljs', 'qrcode'],
  },
});
