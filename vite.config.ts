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
      // app-update.json: what the Android app downloads to update itself
      // (only the app's own files; it never sends anything).
      const appFiles = [...new Set(['index.html', 'fonts/orbitron.woff2', 'fonts/exo2.woff2', 'icon.svg', ...files])].filter((f) => f !== 'precache.json');
      this.emitFile({
        type: 'asset',
        fileName: 'app-update.json',
        source: JSON.stringify({ version: Date.now().toString(36), nativeMin: 1, files: appFiles }),
      });
    },
  };
}

export default defineConfig({
  base: './',
  define: {
    __BUILD__: JSON.stringify(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })),
  },
  plugins: [precacheList()],
  build: {
    // Older Android boards run older browsers: translate newer syntax.
    target: ['es2019', 'chrome80', 'safari14'],
    chunkSizeWarningLimit: 1500,
  },
});
