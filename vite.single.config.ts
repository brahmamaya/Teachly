import { defineConfig, type Plugin } from 'vite';

/**
 * Offline single-file build: `npm run build:single` writes dist-single/Teachly.html,
 * one HTML file with all code, styles and the PDF / PowerPoint readers inside.
 * Copy it to a pen drive or a digital board and open it in any browser —
 * no internet and no install needed.
 */
function inlineEverything(): Plugin {
  return {
    name: 'teachly-single-file',
    apply: 'build',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      const html = Object.values(bundle).find((f) => f.type === 'asset' && f.fileName.endsWith('.html'));
      if (!html || html.type !== 'asset') return;
      let page = String(html.source);
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type === 'chunk' && file.isEntry) {
          // Everything is already inside the file, so there is nothing to preload.
          const code = file.code.replace(/__VITE_PRELOAD__/g, 'void 0').replace(/<\/script/gi, '<\\/script');
          page = page.replace(new RegExp(`<script[^>]*src="[^"]*${escape(name)}"[^>]*></script>`), () => `<script type="module">${code}</script>`);
          delete bundle[name];
        } else if (file.type === 'asset' && name.endsWith('.css')) {
          page = page.replace(new RegExp(`<link[^>]*href="[^"]*${escape(name)}"[^>]*>`), () => `<style>${String(file.source)}</style>`);
          delete bundle[name];
        }
      }
      // Icons and the web-app manifest only make sense on the website.
      page = page.replace(/<link rel="(icon|manifest|apple-touch-icon)"[^>]*>\s*/g, '');
      html.source = page;
      html.fileName = 'Teachly.html';
    },
  };
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [inlineEverything()],
  build: {
    outDir: 'dist-single',
    // Older Android boards run older browsers: translate newer syntax.
    target: ['es2019', 'chrome80'],
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 20_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
