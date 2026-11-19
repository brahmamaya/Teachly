import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Privacy guard: the app must not name any other website that it could load something from (fonts, scripts, pictures,
// analytics). When a visitor's device asks another site for a file, that site learns the device's address.
// Only these names may appear: XML namespace names (not addresses to visit) and Teachly's own website for links.
const ALLOWED = [/^https?:\/\/(www\.)?w3\.org\//, /^https?:\/\/schemas\.(openxmlformats|microsoft)\.org\//, /^https?:\/\/purl\.org\//, /^https:\/\/physica\.in\//, /^https:\/\/physica\.in$/];

function files(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(ts|css|html|js|webmanifest|json|svg)$/.test(f) && !/package-lock/.test(f)) out.push(p);
  }
  return out;
}

describe('no outside websites', () => {
  const roots = ['src', 'public', 'index.html', 'vite.config.ts'];
  const all = roots.flatMap((r) => (statSync(r).isDirectory() ? files(r) : [r]));

  it('source files only name allowed addresses', () => {
    const bad: string[] = [];
    for (const f of all) {
      if (/\/fonts\/OFL-/.test(f) || f === 'vite.config.ts') continue; // font licence texts; the build file that REMOVES an outside address names it
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/https?:\/\/[^\s'"`)<>\\]+/g)) if (!ALLOWED.some((a) => a.test(m[0]))) bad.push(`${f}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
  });

  it('fonts and styles are local (no @import of a web address, no font from the web)', () => {
    for (const f of all.filter((x) => /\.(css|html|ts)$/.test(x))) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toMatch(/@import\s+url\(\s*['"]?https?:/);
      expect(text, f).not.toMatch(/<link[^>]+href=["']https?:/);
      expect(text, f).not.toMatch(/<script[^>]+src=["']https?:/);
    }
  });

  it('the page policy only allows Teachly itself', () => {
    const cfg = readFileSync('vite.config.ts', 'utf8');
    const csp = /const CSP =\s*([\s\S]*?);\n(?:\/\*\*|function)/.exec(cfg)?.[1] ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self' data: blob:");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).not.toMatch(/https?:|\*/);
    expect(readFileSync('index.html', 'utf8')).toContain('name="referrer" content="no-referrer"');
  });
});
