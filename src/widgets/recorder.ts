import type { Board } from '../board';
import { download } from '../io/files';
import { icon } from '../ui/icons';
import { fadeOut, toast } from '../ui/panel';

// Lesson recording: the board (everything written, live) plus the teacher's
// voice, saved as a video file. Runs only while recording, so it costs
// nothing the rest of the time.

interface Rec {
  rec: MediaRecorder;
  chunks: Blob[];
  mic: MediaStream | null;
  timer: number;
  raf: number;
  pill: HTMLElement;
  start: number;
  type: string;
  board: Board;
  ui: UIShots | null;
}

let cur: Rec | null = null;
const listeners = new Set<() => void>();
/** True while a lesson is being recorded. */
export function isRecording(): boolean {
  return !!cur;
}
/** Called whenever recording starts or stops. */
export function onRecordingChange(fn: () => void): void {
  listeners.add(fn);
}
const changed = () => listeners.forEach((f) => f());
let hostEl: HTMLElement | null = null;

function pickType(): string {
  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return types.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t)) ?? '';
}

/** Video sizes offered before recording (the board's shape is kept inside this box). */
const QUALITIES = [
  { id: '720', label: '720p', sub: 'HD · small file', w: 1280, h: 720, bps: 5_000_000 },
  { id: '1080', label: '1080p', sub: 'Full HD', w: 1920, h: 1080, bps: 8_000_000 },
  { id: '1440', label: '2K', sub: '1440p · sharper', w: 2560, h: 1440, bps: 16_000_000 },
  { id: '2160', label: '4K', sub: 'Ultra HD · big file', w: 3840, h: 2160, bps: 35_000_000 },
] as const;
type Quality = (typeof QUALITIES)[number];
const QKEY = 'teachly.recQuality';

/** Ask which quality to record in (remembers the last choice). */
const UIKEY = 'teachly.recToolbar';

function chooseQuality(host: HTMLElement): Promise<{ q: Quality; ui: boolean } | null> {
  let last = '1080';
  let showUI = false;
  try {
    last = localStorage.getItem(QKEY) || last;
    showUI = localStorage.getItem(UIKEY) === '1';
  } catch {
    /* ignore */
  }
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'sv-back';
    back.innerHTML = `<div class="sv-box" role="dialog" aria-label="Record lesson">
      <h3>Record lesson</h3>
      <p class="sv-note">Your board and your voice are saved as a video on this device.</p>
      <div class="rq-grid">${QUALITIES.map((q) => `<button type="button" class="rq-opt ${q.id === last ? 'on' : ''}" data-q="${q.id}"><b>${q.label}</b><span>${q.sub}</span></button>`).join('')}</div>
      <label class="rq-check"><input type="checkbox" data-ui ${showUI ? 'checked' : ''}><span><b>Show the toolbar in the video</b><small>Buttons, menus and what is selected are recorded too</small></span></label>
      <p class="sv-note small">Higher quality is sharper but needs a faster device and more space.</p>
      <div class="sv-row"><button type="button" class="btn" data-x>Cancel</button><button type="button" class="btn primary rq-start" data-go>${icon('record', 18)} Start recording</button></div>
    </div>`;
    host.appendChild(back);
    let pick = last;
    const done = (v: { q: Quality; ui: boolean } | null) => {
      fadeOut(back);
      resolve(v);
    };
    back.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === back || t.closest('[data-x]')) return done(null);
      const b = t.closest('[data-q]') as HTMLElement | null;
      if (b) {
        pick = b.dataset.q!;
        back.querySelectorAll('[data-q]').forEach((x) => x.classList.toggle('on', x === b));
      }
      if (t.closest('[data-go]')) {
        const ui = (back.querySelector('[data-ui]') as HTMLInputElement).checked;
        try {
          localStorage.setItem(QKEY, pick);
          localStorage.setItem(UIKEY, ui ? '1' : '0');
        } catch {
          /* ignore */
        }
        done({ q: QUALITIES.find((q) => q.id === pick) ?? QUALITIES[1], ui });
      }
    });
  });
}

export async function toggleRecording(board: Board, host: HTMLElement): Promise<void> {
  if (cur) return stop();
  hostEl = host;
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
    toast('Recording is not available in this browser', 4000);
    return;
  }
  const choice = await chooseQuality(host);
  if (!choice) return;
  const q = choice.q;
  // The board's shape, as large as fits the chosen quality.
  const k = Math.min(q.w / board.w, q.h / board.h);
  const out = document.createElement('canvas');
  out.width = Math.round((board.w * k) / 2) * 2;
  out.height = Math.round((board.h * k) / 2) * 2;
  // Draw the board itself at the video size while recording (sharp text and lines).
  board.recordPixels = out.width * out.height;
  board.resize();
  const ctx = out.getContext('2d', { alpha: false })!;
  ctx.imageSmoothingQuality = 'high';
  const ui = choice.ui ? new UIShots(host, board, out.width / board.w) : null;
  const paint = () => {
    ctx.drawImage(board.bg, 0, 0, out.width, out.height);
    ctx.drawImage(board.ink, 0, 0, out.width, out.height);
    ctx.drawImage(board.wet, 0, 0, out.width, out.height);
    ctx.drawImage(board.overlay, 0, 0, out.width, out.height);
    ui?.draw(ctx);
  };
  paint();

  let mic: MediaStream | null = null;
  try {
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    toast('Microphone not allowed — recording without sound', 3500);
  }
  const stream = out.captureStream(30);
  mic?.getAudioTracks().forEach((t) => stream.addTrack(t));
  const type = pickType();
  let rec: MediaRecorder;
  try {
    rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: q.bps });
  } catch {
    mic?.getTracks().forEach((t) => t.stop());
    ui?.stop();
    board.recordPixels = null;
    board.resize();
    toast('Recording is not available on this device', 4000);
    return;
  }
  const pill = document.createElement('div');
  pill.className = 'rec-pill';
  pill.innerHTML = `<i class="rec-dot"></i><b data-t>0:00</b><span class="rec-q">${q.label}</span><button class="rec-btn stop" title="Stop recording" aria-label="Stop recording"><i class="rec-square"></i>Stop</button>`;
  pill.querySelector('button')!.addEventListener('click', () => stop());
  host.appendChild(pill);

  const r: Rec = { rec, chunks: [], mic, timer: 0, raf: 0, pill, start: Date.now(), type: rec.mimeType || type || 'video/webm', board, ui };
  rec.ondataavailable = (e) => e.data.size && r.chunks.push(e.data);
  rec.onstop = () => save(r);
  rec.start(1000);
  // Copy the board ~30 times a second.
  let last = 0;
  const loop = (t: number) => {
    if (t - last > 30) {
      paint();
      last = t;
    }
    r.raf = requestAnimationFrame(loop);
  };
  r.raf = requestAnimationFrame(loop);
  r.timer = window.setInterval(() => {
    const s = Math.floor((Date.now() - r.start) / 1000);
    (pill.querySelector('[data-t]') as HTMLElement).textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 500);
  cur = r;
  changed();
  toast(`Recording in ${q.label}…`);
}

function stop(): void {
  const r = cur;
  if (!r) return;
  cur = null;
  changed();
  cancelAnimationFrame(r.raf);
  clearInterval(r.timer);
  r.pill.remove();
  if (r.rec.state !== 'inactive') r.rec.stop();
  r.mic?.getTracks().forEach((t) => t.stop());
  r.ui?.stop();
  // Back to the normal (lighter) drawing size.
  r.board.recordPixels = null;
  r.board.resize();
}

async function save(r: Rec): Promise<void> {
  const ext = r.type.includes('mp4') ? 'mp4' : 'webm';
  const blob = new Blob(r.chunks, { type: r.type.split(';')[0] });
  const d = new Date();
  const name = `Teachly lesson ${d.toISOString().slice(0, 10)} ${d.getHours()}-${String(d.getMinutes()).padStart(2, '0')}.${ext}`;
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  const mobile = /iPad|iPhone|Android|Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  if (!mobile || !nav.canShare?.({ files: [file] })) {
    download(blob, name);
    toast('Lesson video saved to Downloads', 3500);
    return;
  }
  // iPad / phones: sharing needs a fresh tap, so offer a Save button.
  const pill = document.createElement('div');
  pill.className = 'rec-pill ready';
  pill.innerHTML = `<b>Video ready</b><button class="rec-btn save">${icon('download', 18)}<span>Save video</span></button><button class="rec-btn round" aria-label="Close" title="Close">${icon('close', 18)}</button>`;
  const [saveBtn, closeBtn] = pill.querySelectorAll('button');
  saveBtn.addEventListener('click', () => {
    navigator.share({ files: [file], title: name }).catch(() => download(blob, name));
    pill.remove();
  });
  closeBtn.addEventListener('click', () => pill.remove());
  hostEl?.appendChild(pill);
}

/**
 * "Show the toolbar in the video": pictures of the toolbar, menus, the
 * selection bar and panels, laid over the board in the video. A new picture
 * is taken only when they change (never while writing), so it costs nothing
 * during handwriting.
 */
class UIShots {
  private shots: { img: HTMLCanvasElement; x: number; y: number; w: number; h: number; bar: boolean }[] = [];
  private obs: MutationObserver;
  private timer = 0;
  private busy = false;
  private again = false;
  private stopped = false;

  constructor(
    private host: HTMLElement,
    private board: Board,
    private scale: number,
  ) {
    this.obs = new MutationObserver((list) => {
      // The recording bar's clock and the board canvases do not count.
      if (list.every((m) => m.target === host || (m.target as Element).closest?.('.rec-pill, #board') || m.target.parentElement?.closest('.rec-pill'))) return;
      this.soon();
    });
    this.obs.observe(host, { subtree: true, childList: true, attributes: true, characterData: true });
    this.soon(0);
  }

  private soon(ms = 120): void {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.take(), ms);
  }

  private async take(): Promise<void> {
    if (this.stopped) return;
    if (this.busy) {
      this.again = true;
      return;
    }
    this.busy = true;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const b = this.board.el.getBoundingClientRect();
      const els = [...this.host.querySelectorAll<HTMLElement>('.toolbar, .popover, .props, .panel, .pages-panel, .toasts .toast, .zoom-pill, .corner')].filter(
        (e) => !e.classList.contains('leaving') && !e.hidden && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden',
      );
      const next: typeof this.shots = [];
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const img = await html2canvas(el, {
          backgroundColor: null,
          scale: this.scale,
          logging: false,
          // Never copy the big board canvases (slow): the video has them already.
          ignoreElements: (n) => n.tagName === 'CANVAS' && !!n.closest('#board'),
          // Picture the bars at full strength; the video fades them while writing.
          onclone: (doc) => {
            doc.querySelectorAll('.drawing').forEach((n) => n.classList.remove('drawing'));
            doc.querySelectorAll<HTMLElement>('.toolbar').forEach((n) => {
              n.style.opacity = '1';
              n.style.translate = 'none';
              n.style.animation = 'none';
            });
          },
        });
        next.push({ img, x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height, bar: el.classList.contains('toolbar') });
      }
      if (!this.stopped) this.shots = next;
    } catch {
      /* a picture could not be made: the video still has the board */
    } finally {
      this.busy = false;
      if (this.again) {
        this.again = false;
        this.soon();
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const k = this.scale;
    // While writing the bars fade (as on screen).
    const fade = this.host.classList.contains('drawing') ? 0.35 : 1;
    for (const s of this.shots) {
      ctx.globalAlpha = s.bar ? fade : 1;
      ctx.drawImage(s.img, s.x * k, s.y * k, s.w * k, s.h * k);
    }
    ctx.globalAlpha = 1;
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    this.obs.disconnect();
    this.shots = [];
  }
}
