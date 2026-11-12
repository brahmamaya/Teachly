// Notebook covers: optional looks for a notebook card in My notebooks (like
// the cover of a real notebook, with its spine, elastic band and a name
// label). Drawn with CSS only: no pictures, nothing to download.

export interface Cover {
  id: string;
  name: string;
  /** CSS background of the cover. */
  bg: string;
  /** Colour of the elastic band. */
  band: string;
}

const stars = 'radial-gradient(1.2px 1.2px at 18% 22%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 72% 12%, #fff 50%, transparent 51%), radial-gradient(1.4px 1.4px at 60% 48%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 28% 70%, #fff 50%, transparent 51%), radial-gradient(1.2px 1.2px at 84% 78%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 44% 90%, #fff 50%, transparent 51%)';

export const COVERS: Cover[] = [
  { id: 'ocean', name: 'Ocean', bg: 'linear-gradient(150deg, #5fe0fa, #14a3d6)', band: '#0b7fa8' },
  { id: 'sunset', name: 'Sunset', bg: 'linear-gradient(150deg, #ffbe5c, #ff5a80)', band: '#c92d58' },
  { id: 'royal', name: 'Royal', bg: 'linear-gradient(150deg, #7384ff, #8d3df5)', band: '#4b1fb0' },
  { id: 'forest', name: 'Forest', bg: 'linear-gradient(150deg, #4fdc86, #0b8a5a)', band: '#075c3d' },
  { id: 'ruby', name: 'Ruby', bg: 'linear-gradient(150deg, #ff6166, #aa0f2d)', band: '#6f0820' },
  { id: 'midnight', name: 'Midnight', bg: 'linear-gradient(150deg, #20263a, #07080c)', band: '#d9ad4f' },
  { id: 'rose', name: 'Rose', bg: 'linear-gradient(150deg, #ffc8d8, #ee86a6)', band: '#cf5f86' },
  { id: 'mint', name: 'Mint', bg: 'linear-gradient(150deg, #c2f5e6, #52c9ad)', band: '#2c9e85' },
  { id: 'graphite', name: 'Graphite', bg: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 10px), linear-gradient(150deg, #535a6e, #1f222b)', band: '#8b93a8' },
  { id: 'galaxy', name: 'Galaxy', bg: `${stars}, radial-gradient(circle at 25% 18%, #7a45ee, transparent 55%), radial-gradient(circle at 85% 88%, #e8509f, transparent 52%), #140a35`, band: '#b58cff' },
  { id: 'blueprint', name: 'Blueprint', bg: 'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px) 0 0 / 12px 12px, linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px) 0 0 / 12px 12px, linear-gradient(150deg, #1a63d6, #0a3a8f)', band: '#ffd24a' },
  { id: 'aurora', name: 'Aurora', bg: 'linear-gradient(160deg, #00d0ff, #7b5cff 52%, #ff5ec4)', band: '#3b2a9c' },
];

export function coverById(id: string | undefined): Cover | undefined {
  return id ? COVERS.find((c) => c.id === id) : undefined;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** The notebook cover as HTML (the name label shows `title`, if given). */
export function coverHTML(c: Cover, title = ''): string {
  return `<span class="nbc" style="--cv:${c.bg};--cb:${c.band}">${title ? `<span class="nbc-label">${esc(title)}</span>` : ''}<i class="nbc-star"></i></span>`;
}
