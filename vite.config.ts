import { defineConfig, type Plugin } from 'vite';

/**
 * Writes precache.json: every file of the build, so the service worker can
 * download the whole app on install and it keeps working fully offline
 * (PDF and PowerPoint import included).
 */
function precacheList(): Plugin {
  return {
    name: 'teachly-precache',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const extra = ['./', 'index.html', 'download.html', 'qr.svg', 'fonts/orbitron.woff2', 'fonts/exo2.woff2', 'manifest.webmanifest', 'icon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'];
      this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify([...new Set([...extra, ...files])]) });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [precacheList()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
});
