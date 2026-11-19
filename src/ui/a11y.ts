// Small accessibility helpers shared by the interface.

/** Every icon-only button gets an accessible name from its tooltip (when it has no name yet). */
export function nameControls(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('button[title]:not([aria-label]), [role=button][title]:not([aria-label])').forEach((b) => b.setAttribute('aria-label', b.getAttribute('title') ?? ''));
}

/**
 * Selected state for assistive technology (and a second cue besides colour): tool buttons say whether they are
 * the active tool, menu buttons say whether their menu is open.
 */
export function syncToolbarState(bar: HTMLElement, tool: string, open: string, pagesOpen: boolean): void {
  bar.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
  bar.querySelectorAll<HTMLElement>('[data-pop]').forEach((b) => {
    b.setAttribute('aria-haspopup', 'true');
    b.setAttribute('aria-expanded', String(open === b.dataset.pop));
  });
  const pages = bar.querySelector<HTMLElement>('[data-act=pages]');
  if (pages) pages.setAttribute('aria-expanded', String(pagesOpen));
}
